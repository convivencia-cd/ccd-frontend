import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { resolverCuentaCobroCentral } from '@/lib/mercadopago/org-account'
import { getPublicOrigin } from '@/lib/http'

export async function POST(request: Request) {
  let body: { evento_participante_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const eventoParticipanteId = body.evento_participante_id
  if (typeof eventoParticipanteId !== 'string' || !eventoParticipanteId) {
    return NextResponse.json({ error: 'Falta la inscripción.' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: participante } = await supabaseAdmin
    .from('evento_participantes')
    .select('id, evento:eventos!evento_id(id, nombre, precio)')
    .eq('id', eventoParticipanteId)
    .single()

  if (!participante) {
    return NextResponse.json({ error: 'No se encontró la inscripción.' }, { status: 404 })
  }

  const evento = participante.evento as unknown as {
    id: string
    nombre: string
    precio: number | null
  } | null
  const monto = Number(evento?.precio ?? 0)

  if (!evento || monto <= 0) {
    return NextResponse.json({ error: 'Este evento no requiere pago de inscripción.' }, { status: 400 })
  }

  // Todas las inscripciones se cobran en la cuenta central, sin importar qué
  // confraternidad/fraternidad organice el evento.
  const cuenta = await resolverCuentaCobroCentral()
  if (!cuenta) {
    return NextResponse.json(
      { error: 'El pago online no está disponible en este momento. Contactate con los organizadores.' },
      { status: 409 }
    )
  }

  // Un pago ya confirmado (o un comprobante de transferencia esperando
  // verificación) sí bloquea. Un intento de Mercado Pago que quedó pendiente,
  // en cambio, se reusa: el link del mail tiene que poder reintentarse cuando
  // la persona abandona el checkout.
  const { data: pagosPrevios } = await supabaseAdmin
    .from('pagos')
    .select('id, estado_pago, medio_pago')
    .eq('evento_participante_id', eventoParticipanteId)
    .eq('concepto', 'inscripcion')
    .in('estado_pago', ['pendiente', 'confirmado'])

  const pagoConfirmado = (pagosPrevios ?? []).find((p) => p.estado_pago === 'confirmado')
  if (pagoConfirmado) {
    return NextResponse.json({ error: 'Esta inscripción ya está paga.' }, { status: 409 })
  }

  const comprobanteEnRevision = (pagosPrevios ?? []).find((p) => p.medio_pago === 'transferencia')
  if (comprobanteEnRevision) {
    return NextResponse.json(
      { error: 'Ya recibimos un comprobante para esta inscripción. Nos comunicamos para verificarlo.' },
      { status: 409 }
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const pagoPendiente = (pagosPrevios ?? []).find((p) => p.medio_pago === 'mercadopago')

  let pago: { id: string } | null = pagoPendiente ? { id: pagoPendiente.id as string } : null

  if (pago) {
    // El monto del evento pudo cambiar entre un intento y el siguiente.
    await supabaseAdmin
      .from('pagos')
      .update({ monto, fecha_pago: today, mp_organizacion_id: cuenta.organizacionId })
      .eq('id', pago.id)
  } else {
    const { data: pagoNuevo, error: pagoError } = await supabaseAdmin
      .from('pagos')
      .insert({
        evento_participante_id: eventoParticipanteId,
        concepto: 'inscripcion',
        monto,
        medio_pago: 'mercadopago',
        estado_pago: 'pendiente',
        fecha_pago: today,
        mp_organizacion_id: cuenta.organizacionId,
      })
      .select('id')
      .single()

    if (pagoError || !pagoNuevo) {
      return NextResponse.json({ error: 'No se pudo registrar el pago. Intentá de nuevo.' }, { status: 400 })
    }
    pago = pagoNuevo
  }

  const origin = getPublicOrigin(request)
  const client = new MercadoPagoConfig({ accessToken: cuenta.accessToken })
  const preference = new Preference(client)

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: pago.id,
            title: `Inscripción — ${evento.nombre}`,
            quantity: 1,
            unit_price: monto,
            currency_id: 'ARS',
          },
        ],
        external_reference: pago.id,
        // Vuelve al stepper de pago, que es donde arrancó el checkout.
        back_urls: {
          success: `${origin}/pago/${eventoParticipanteId}?pago=success`,
          pending: `${origin}/pago/${eventoParticipanteId}?pago=pending`,
          failure: `${origin}/pago/${eventoParticipanteId}?pago=failure`,
        },
        notification_url: `${origin}/api/public/pagos/mercadopago/webhook?pago_id=${pago.id}`,
        auto_return: 'approved',
      },
    })

    await supabaseAdmin.from('pagos').update({ mp_preference_id: result.id }).eq('id', pago.id)

    // En producción siempre el checkout real; sandbox_init_point queda solo
    // para cuando se prueba localmente con credenciales de prueba.
    const checkoutUrl = process.env.VERCEL_ENV === 'production'
      ? result.init_point
      : (result.sandbox_init_point ?? result.init_point)

    return NextResponse.json({ checkout_url: checkoutUrl })
  } catch {
    // Solo se limpia la fila si la creamos en esta llamada; una reusada ya
    // existía antes y puede tener historial (mp_preference_id previo).
    if (!pagoPendiente) await supabaseAdmin.from('pagos').delete().eq('id', pago.id)
    return NextResponse.json({ error: 'No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.' }, { status: 502 })
  }
}

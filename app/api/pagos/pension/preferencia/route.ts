import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'
import { valorPensionEfectivo, calcularSaldoPension } from '@/lib/eventos/pension'
import { resolverCuentaEvento } from '@/lib/mercadopago/org-account'
import { getPublicOrigin } from '@/lib/http'

// Genera un link de pago de Mercado Pago para la pensión de un participante.
// A diferencia de la inscripción (checkout público en la landing), esto lo
// invoca un Centralizador/Responsable/Enlace/Delegado EqT desde el panel
// interno de Pagos, para compartir el link con el conviviente.
export async function POST(request: Request) {
  const ctx = await getUserContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { evento_participante_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const eventoParticipanteId = body.evento_participante_id
  if (typeof eventoParticipanteId !== 'string' || !eventoParticipanteId) {
    return NextResponse.json({ error: 'Falta el participante.' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: participante } = await supabaseAdmin
    .from('evento_participantes')
    .select(
      'id, valor_pension, beca_pension, evento:eventos!evento_id(id, nombre, pension, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id)'
    )
    .eq('id', eventoParticipanteId)
    .single()

  if (!participante) {
    return NextResponse.json({ error: 'No se encontró el participante.' }, { status: 404 })
  }

  const evento = participante.evento as unknown as {
    id: string
    nombre: string
    pension: number | null
    organizacion_id: string | null
    fraternidad_id: string | null
    centralizador_1_persona_id: string | null
    centralizador_2_persona_id: string | null
    centralizador_3_persona_id: string | null
  } | null

  if (!evento) {
    return NextResponse.json({ error: 'No se encontró el evento.' }, { status: 404 })
  }

  const autorizado =
    canPerform(ctx, 'event.update', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false) ||
    esCentralizadorDeEvento(ctx, evento)

  if (!autorizado) {
    return NextResponse.json({ error: 'No tenés permiso para generar pagos de pensión de este evento' }, { status: 403 })
  }

  // Se cobra el Saldo de Pensión del participante (valor propio o precio del
  // evento, menos la beca), no el precio general.
  const valorPension = valorPensionEfectivo(participante.valor_pension, evento.pension)
  if (valorPension <= 0) {
    return NextResponse.json({ error: 'Este evento no tiene precio de pensión configurado.' }, { status: 400 })
  }
  const monto = calcularSaldoPension(valorPension, Number(participante.beca_pension || 0))
  if (monto <= 0) {
    return NextResponse.json(
      { error: 'La beca cubre toda la pensión de este participante: no hay saldo para cobrar.' },
      { status: 400 }
    )
  }

  const cuenta = await resolverCuentaEvento(evento.organizacion_id, evento.fraternidad_id)
  if (!cuenta) {
    return NextResponse.json(
      { error: 'Este evento no tiene Mercado Pago configurado. Contactate con los organizadores.' },
      { status: 409 }
    )
  }

  // Pagos de pensión en curso (scopeado por concepto: un pago de inscripción
  // confirmado no debe bloquear la pensión).
  const { data: pagosExistentes } = await supabaseAdmin
    .from('pagos')
    .select('id, estado_pago, medio_pago, monto, mp_preference_id, mp_organizacion_id')
    .eq('evento_participante_id', eventoParticipanteId)
    .eq('concepto', 'pension')
    .in('estado_pago', ['pendiente', 'confirmado'])

  const existentes = pagosExistentes ?? []
  if (existentes.some((p) => p.estado_pago === 'confirmado')) {
    return NextResponse.json(
      { error: 'Este participante ya tiene un pago de pensión confirmado.' },
      { status: 409 }
    )
  }
  if (existentes.some((p) => p.medio_pago !== 'mercadopago')) {
    return NextResponse.json(
      { error: 'Este participante ya tiene un pago de pensión pendiente de verificación.' },
      { status: 409 }
    )
  }

  const origin = getPublicOrigin(request)
  const client = new MercadoPagoConfig({ accessToken: cuenta.accessToken })
  const preference = new Preference(client)

  const urlDe = (pref: { init_point?: string; sandbox_init_point?: string }) =>
    process.env.VERCEL_ENV === 'production' ? pref.init_point : (pref.sandbox_init_point ?? pref.init_point)

  const crearPreferencia = (pagoId: string) =>
    preference.create({
      body: {
        items: [
          {
            id: pagoId,
            title: `Pensión — ${evento.nombre}`,
            quantity: 1,
            unit_price: monto,
            currency_id: 'ARS',
          },
        ],
        external_reference: pagoId,
        notification_url: `${origin}/api/public/pagos/mercadopago/webhook?pago_id=${pagoId}`,
      },
    })

  // Ya hay un link pendiente: se devuelve el mismo si el monto y la cuenta siguen
  // vigentes; si cambiaron (p. ej. se cargó una beca), se regenera sobre el mismo pago.
  const pendiente = existentes[0]
  if (pendiente) {
    try {
      const vigente =
        pendiente.mp_preference_id &&
        Number(pendiente.monto) === monto &&
        pendiente.mp_organizacion_id === cuenta.organizacionId

      if (vigente) {
        const actual = await preference.get({ preferenceId: pendiente.mp_preference_id })
        return NextResponse.json({ checkout_url: urlDe(actual) })
      }

      const result = await crearPreferencia(pendiente.id)
      await supabaseAdmin
        .from('pagos')
        .update({ monto, mp_preference_id: result.id, mp_organizacion_id: cuenta.organizacionId })
        .eq('id', pendiente.id)
      return NextResponse.json({ checkout_url: urlDe(result) })
    } catch {
      return NextResponse.json({ error: 'No se pudo recuperar el link de Mercado Pago. Intentá de nuevo.' }, { status: 502 })
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: pago, error: pagoError } = await supabaseAdmin
    .from('pagos')
    .insert({
      evento_participante_id: eventoParticipanteId,
      concepto: 'pension',
      monto,
      medio_pago: 'mercadopago',
      estado_pago: 'pendiente',
      fecha_pago: today,
      mp_organizacion_id: cuenta.organizacionId,
    })
    .select('id')
    .single()

  if (pagoError || !pago) {
    return NextResponse.json({ error: 'No se pudo registrar el pago. Intentá de nuevo.' }, { status: 400 })
  }

  try {
    const result = await crearPreferencia(pago.id)

    await supabaseAdmin.from('pagos').update({ mp_preference_id: result.id }).eq('id', pago.id)

    return NextResponse.json({ checkout_url: urlDe(result) })
  } catch {
    await supabaseAdmin.from('pagos').delete().eq('id', pago.id)
    return NextResponse.json({ error: 'No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.' }, { status: 502 })
  }
}

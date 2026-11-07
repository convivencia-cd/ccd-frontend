import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { obtenerAccessTokenVigente } from '@/lib/mercadopago/org-account'
import { getPublicOrigin } from '@/lib/http'
import { sendTemplateEmail, templates } from '@/lib/email'
import { QR_INSCRIPCION_CID, adjuntoQrInscripcion } from '@/lib/inscripciones/qr'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type SupabaseAdmin = SupabaseClient<any>

/**
 * Avisa al que pagó que la inscripción quedó confirmada y le manda el QR de
 * ingreso (el mismo que lee el check-in de asistencia) para que lo presente al
 * llegar. Nunca corta el webhook: si algo falla, se loguea y listo, porque el
 * pago ya quedó registrado en la base.
 */
async function enviarConfirmacionConQr(
  supabaseAdmin: SupabaseAdmin,
  pago: { id: string; evento_participante_id: string | null; monto: number | null; fecha_pago: string | null },
  origin: string
) {
  if (!pago.evento_participante_id) return

  try {
    const { data: participante } = await supabaseAdmin
      .from('evento_participantes')
      .select('id, persona:personas!persona_id(nombre, email), evento:eventos!evento_id(id, nombre)')
      .eq('id', pago.evento_participante_id)
      .maybeSingle()

    const persona = (participante?.persona ?? null) as { nombre: string; email: string | null } | null
    const evento = (participante?.evento ?? null) as { id: string; nombre: string } | null

    if (!participante || !persona?.email) return

    const resultado = await sendTemplateEmail(
      templates.pagoConfirmado,
      {
        nombre: persona.nombre,
        evento: evento?.nombre ?? 'tu retiro',
        monto: Number(pago.monto ?? 0),
        medioPago: 'Mercado Pago',
        fechaPago: pago.fecha_pago,
        qrCid: QR_INSCRIPCION_CID,
        ...(evento ? { detalleUrl: `${origin}/e/${evento.id}` } : {}),
      },
      {
        to: persona.email,
        attachments: [await adjuntoQrInscripcion(participante.id as string)],
        // El webhook puede repetirse: Resend descarta el duplicado.
        idempotencyKey: `pago-confirmado-${pago.id}`,
      }
    )

    if (!resultado.ok) {
      console.error('[mp-webhook] no se pudo enviar la confirmación con QR:', resultado.error)
    }
  } catch (err) {
    console.error('[mp-webhook] error al preparar la confirmación con QR:', err)
  }
}

/**
 * Pasa al participante a cancelado y le manda el mail de baja con la
 * devolución. Si ya estaba cancelado (lo dio de baja un centralizador), solo
 * reintenta el mail: la misma clave de idempotencia que usa "Dar de baja"
 * evita que le llegue dos veces. Nunca corta el webhook.
 */
async function darDeBajaPorDevolucion(
  supabaseAdmin: SupabaseAdmin,
  pago: { id: string; evento_participante_id: string | null; monto: number | null }
) {
  if (!pago.evento_participante_id) return
  try {
    const { data: participante } = await supabaseAdmin
      .from('evento_participantes')
      .select('id, estado_participacion, persona:personas!persona_id(nombre, email), evento:eventos!evento_id(nombre)')
      .eq('id', pago.evento_participante_id)
      .maybeSingle()
    if (!participante) return

    if (participante.estado_participacion !== 'cancelado') {
      const { error } = await supabaseAdmin
        .from('evento_participantes')
        .update({ estado_participacion: 'cancelado' })
        .eq('id', participante.id)
      if (error) {
        console.error('[mp-webhook] no se pudo dar de baja por devolución:', error)
        return
      }
    }

    const persona = participante.persona as unknown as { nombre: string; email: string | null } | null
    const evento = participante.evento as unknown as { nombre: string } | null
    if (!persona?.email) return

    const envio = await sendTemplateEmail(
      templates.bajaRetiro,
      {
        nombre: persona.nombre?.split(' ')[0] || 'hermano/a',
        evento: evento?.nombre ?? 'el retiro',
        devolucion: { tipo: 'mercadopago', monto: Number(pago.monto ?? 0) },
      },
      { to: persona.email, idempotencyKey: `baja-retiro-${participante.id}` }
    )
    if (!envio.ok) console.error('[mp-webhook] no se pudo enviar el aviso de baja:', envio.error)
  } catch (err) {
    console.error('[mp-webhook] error al dar de baja por devolución:', err)
  }
}

function isValidSignature(request: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Sin secret no hay forma de saber que el aviso viene de Mercado Pago:
    // en producción se rechaza; solo se tolera en local/preview.
    if (process.env.VERCEL_ENV === 'production') {
      console.error('[mp-webhook] falta MP_WEBHOOK_SECRET: se rechazan todas las notificaciones')
      return false
    }
    return true
  }

  const signatureHeader = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  if (!signatureHeader || !requestId) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    })
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(v1)
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}

/**
 * Estado de Mercado Pago → pagos.estado_pago. `reembolsado` es el que usan los
 * triggers 082/089 para anular el movimiento del informe económico.
 */
function mapearEstado(status: string | undefined): 'confirmado' | 'rechazado' | 'reembolsado' | 'pendiente' {
  switch (status) {
    case 'approved':
      return 'confirmado'
    case 'rejected':
    case 'cancelled':
      return 'rechazado'
    case 'refunded':
    case 'charged_back':
      return 'reembolsado'
    default:
      // pending, in_process, authorized, in_mediation
      return 'pendiente'
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  let body: { type?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = await request.json()
  } catch {
    // algunas notificaciones no traen body (ej. pruebas manuales)
  }

  const type = body.type ?? url.searchParams.get('type') ?? undefined
  const dataId = body.data?.id ?? url.searchParams.get('data.id') ?? undefined

  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true })
  }

  if (!isValidSignature(request, dataId)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  // Cada organización tiene su propio access_token de Mercado Pago, y un pago solo
  // puede consultarse con el token de la cuenta que lo recibió. Por eso al crear la
  // preferencia embebemos nuestro pagos.id en notification_url: nos permite ubicar
  // la organización ANTES de llamar a payment.get (no alcanza con external_reference,
  // que recién conocemos después de esa llamada).
  const pagoId = url.searchParams.get('pago_id')
  if (!pagoId) {
    return NextResponse.json({ ok: true })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: pago } = await supabaseAdmin
    .from('pagos')
    .select('id, estado_pago, mp_payment_id, mp_organizacion_id, evento_participante_id, concepto, monto, fecha_pago')
    .eq('id', pagoId)
    .maybeSingle()

  if (!pago || !pago.mp_organizacion_id) {
    return NextResponse.json({ ok: true })
  }

  const accessToken = await obtenerAccessTokenVigente(pago.mp_organizacion_id)
  if (!accessToken) {
    return NextResponse.json({ ok: true })
  }

  const client = new MercadoPagoConfig({ accessToken })
  const paymentClient = new Payment(client)

  let payment
  try {
    payment = await paymentClient.get({ id: dataId })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el pago' }, { status: 502 })
  }

  // El pago tiene que ser de ESTE registro: pago_id viaja en la URL y la firma
  // de Mercado Pago no lo cubre. external_reference lo fijamos nosotros al
  // crear la preferencia (= pagos.id).
  if (String(payment.external_reference ?? '') !== pago.id) {
    console.error('[mp-webhook] external_reference no coincide', {
      pago_id: pago.id,
      mp_payment_id: payment.id,
      external_reference: payment.external_reference,
    })
    return NextResponse.json({ ok: true })
  }

  const estadoPago = mapearEstado(payment.status)
  const mismoPagoMp = pago.mp_payment_id != null && String(pago.mp_payment_id) === String(payment.id)

  // Un registro ya confirmado no lo pisa otro intento: los avisos llegan
  // desordenados y un rechazo viejo anularía el ingreso en el informe económico.
  // Si el otro intento también se aprobó, la persona pagó dos veces.
  if (pago.estado_pago === 'confirmado' && !mismoPagoMp) {
    if (estadoPago === 'confirmado') {
      console.error('[mp-webhook] posible pago duplicado: revisar devolución', {
        pago_id: pago.id,
        mp_payment_id_registrado: pago.mp_payment_id,
        mp_payment_id_nuevo: payment.id,
      })
    }
    return NextResponse.json({ ok: true })
  }

  // Un confirmado tampoco vuelve a pendiente (p. ej. in_mediation por un
  // reclamo): sigue confirmado hasta que MP lo resuelva como devolución.
  if (pago.estado_pago === 'confirmado' && estadoPago === 'pendiente') {
    return NextResponse.json({ ok: true })
  }

  // Idempotencia por (pago de MP, estado): el mismo pago puede pasar de
  // pendiente a aprobado (efectivo, revisión de tarjeta) y ese cambio se aplica.
  if (mismoPagoMp && pago.estado_pago === estadoPago) {
    return NextResponse.json({ ok: true })
  }

  if (estadoPago === 'confirmado') {
    const montoPagado = Number(payment.transaction_amount ?? 0)
    const montoEsperado = Number(pago.monto ?? 0)
    if (payment.currency_id !== 'ARS' || montoPagado + 0.01 < montoEsperado) {
      console.error('[mp-webhook] monto o moneda no coinciden: no se confirma', {
        pago_id: pago.id,
        mp_payment_id: payment.id,
        esperado: montoEsperado,
        pagado: montoPagado,
        moneda: payment.currency_id,
      })
      return NextResponse.json({ ok: true })
    }
  }

  // Primero la inscripción y después el pago: si algo falla se responde 500 y
  // Mercado Pago reintenta; el reintento no se corta en la idempotencia porque
  // el pago todavía no quedó guardado con su estado nuevo.
  if (estadoPago === 'confirmado' && pago.concepto === 'inscripcion' && pago.evento_participante_id) {
    const { error: inscripcionError } = await supabaseAdmin
      .from('evento_participantes')
      .update({ estado_participacion: 'inscripto' })
      .eq('id', pago.evento_participante_id)
      .eq('estado_participacion', 'interesado')

    if (inscripcionError) {
      console.error('[mp-webhook] no se pudo inscribir al participante:', inscripcionError)
      return NextResponse.json({ error: 'No se pudo registrar la inscripción' }, { status: 500 })
    }
  }

  const { error: pagoError } = await supabaseAdmin
    .from('pagos')
    .update({ estado_pago: estadoPago, mp_payment_id: payment.id })
    .eq('id', pago.id)

  if (pagoError) {
    console.error('[mp-webhook] no se pudo actualizar el pago:', pagoError)
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 })
  }

  if (estadoPago === 'confirmado' && pago.concepto === 'inscripcion') {
    await enviarConfirmacionConQr(supabaseAdmin, pago, getPublicOrigin(request))
  }

  // Inscripción devuelta (desde "Dar de baja" o a mano en Mercado Pago): la
  // persona queda dada de baja y se le avisa (card #104).
  if (estadoPago === 'reembolsado' && pago.concepto === 'inscripcion' && pago.evento_participante_id) {
    await darDeBajaPorDevolucion(supabaseAdmin, pago)
  }

  return NextResponse.json({ ok: true })
}

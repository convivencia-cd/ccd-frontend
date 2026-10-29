import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth/context'
import { puedeRegistrarPagoEnEvento } from '@/lib/pagos/permisos'

const CONCEPTOS = ['inscripcion', 'pension'] as const
const MEDIOS = ['efectivo', 'transferencia', 'mercadopago', 'otro'] as const
const ESTADOS = ['pendiente', 'confirmado', 'rechazado', 'reembolsado'] as const
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

function textoOpcional(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Registro manual de un pago (formulario Nuevo Pago). Desde la migración 101
 * la tabla pagos no admite escrituras con la sesión del usuario: todo pasa por
 * acá, que valida permisos sobre el evento del participante.
 */
export async function POST(request: Request) {
  const ctx = await getUserContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const eventoParticipanteId = body.evento_participante_id
  const concepto = body.concepto
  const medioPago = body.medio_pago
  const estadoPago = body.estado_pago
  const fechaPago = body.fecha_pago
  const monto = Number(body.monto)

  if (typeof eventoParticipanteId !== 'string' || !eventoParticipanteId) {
    return NextResponse.json({ error: 'Elegí el participante.' }, { status: 400 })
  }
  if (!CONCEPTOS.includes(concepto as (typeof CONCEPTOS)[number])) {
    return NextResponse.json({ error: 'Concepto inválido.' }, { status: 400 })
  }
  if (!MEDIOS.includes(medioPago as (typeof MEDIOS)[number])) {
    return NextResponse.json({ error: 'Medio de pago inválido.' }, { status: 400 })
  }
  if (!ESTADOS.includes(estadoPago as (typeof ESTADOS)[number])) {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'El monto tiene que ser mayor a cero.' }, { status: 400 })
  }
  if (typeof fechaPago !== 'string' || !FECHA_RE.test(fechaPago)) {
    return NextResponse.json({ error: 'Fecha de pago inválida.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: participante } = await supabaseAdmin
    .from('evento_participantes')
    .select(
      'id, evento:eventos!evento_id(organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id)'
    )
    .eq('id', eventoParticipanteId)
    .maybeSingle()

  const evento = (participante?.evento ?? null) as unknown as {
    organizacion_id: string | null
    fraternidad_id: string | null
    centralizador_1_persona_id: string | null
    centralizador_2_persona_id: string | null
    centralizador_3_persona_id: string | null
  } | null

  if (!participante || !evento) {
    return NextResponse.json({ error: 'No se encontró el participante.' }, { status: 404 })
  }

  if (!puedeRegistrarPagoEnEvento(ctx, evento)) {
    return NextResponse.json({ error: 'No tenés permiso para registrar pagos de este retiro.' }, { status: 403 })
  }

  const { data: pago, error: pagoError } = await supabaseAdmin
    .from('pagos')
    .insert({
      evento_participante_id: eventoParticipanteId,
      concepto,
      monto: Math.round(monto * 100) / 100,
      medio_pago: medioPago,
      estado_pago: estadoPago,
      fecha_pago: fechaPago,
      referencia: textoOpcional(body.referencia, 200),
      notas: textoOpcional(body.notas, 2000),
    })
    .select('id')
    .single()

  if (pagoError || !pago) {
    console.error('[pagos] no se pudo registrar el pago:', pagoError)
    return NextResponse.json({ error: 'No se pudo registrar el pago. Intentá de nuevo.' }, { status: 400 })
  }

  if (estadoPago === 'confirmado' && concepto === 'inscripcion') {
    const { error: inscripcionError } = await supabaseAdmin
      .from('evento_participantes')
      .update({ estado_participacion: 'inscripto' })
      .eq('id', eventoParticipanteId)
      .eq('estado_participacion', 'interesado')

    if (inscripcionError) {
      console.error('[pagos] pago registrado pero no se pudo inscribir al participante:', inscripcionError)
    }
  }

  return NextResponse.json({ id: pago.id })
}

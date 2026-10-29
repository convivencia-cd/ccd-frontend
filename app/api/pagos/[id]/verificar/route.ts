import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .select(`
      id, estado_pago, evento_participante_id, notas, concepto,
      participante:evento_participantes!evento_participante_id(
        id, estado_participacion,
        evento:eventos!evento_id(organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id)
      )
    `)
    .eq('id', id)
    .single()

  if (pagoError || !pago) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  }

  const participante = pago.participante as unknown as
    | {
        id: string
        estado_participacion: string
        evento: {
          organizacion_id: string | null
          fraternidad_id: string | null
          centralizador_1_persona_id: string | null
          centralizador_2_persona_id: string | null
          centralizador_3_persona_id: string | null
        } | null
      }
    | null
  const evento = participante?.evento ?? null
  const organizacionId = evento?.organizacion_id ?? null
  const fraternidadId = evento?.fraternidad_id ?? null

  const autorizado =
    canPerform(ctx, 'payment.verify', organizacionId) ||
    (fraternidadId ? canPerform(ctx, 'payment.verify', fraternidadId) : false) ||
    (evento ? esCentralizadorDeEvento(ctx, evento) : false)

  if (!autorizado) {
    return NextResponse.json({ error: 'No tenés permiso para verificar este pago' }, { status: 403 })
  }

  if (pago.estado_pago !== 'pendiente') {
    return NextResponse.json(
      { error: `El pago ya fue ${pago.estado_pago}` },
      { status: 422 }
    )
  }

  const body = (await request.json()) as { accion?: string; notas?: string }

  // Desde la migración 101 pagos no admite UPDATE con la sesión del usuario:
  // el permiso ya se validó arriba, se escribe con service-role.
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (body.accion === 'aprobar') {
    const today = new Date().toISOString().split('T')[0]
    const { error: updateError } = await supabaseAdmin
      .from('pagos')
      .update({ estado_pago: 'confirmado', fecha_pago: today })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    if (pago.concepto === 'inscripcion' && participante?.estado_participacion === 'interesado') {
      await supabase
        .from('evento_participantes')
        .update({ estado_participacion: 'inscripto' })
        .eq('id', participante.id)
        .eq('estado_participacion', 'interesado')
    }

    return NextResponse.json({ ok: true })
  }

  if (body.accion === 'rechazar') {
    const notas = body.notas?.trim()
      ? `${pago.notas ? pago.notas + '\n' : ''}Rechazado: ${body.notas.trim()}`
      : pago.notas
    const { error: updateError } = await supabaseAdmin
      .from('pagos')
      .update({ estado_pago: 'rechazado', notas })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}

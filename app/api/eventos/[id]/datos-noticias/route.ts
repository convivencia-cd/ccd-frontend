import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

type DatosNoticias = {
  casa_retiro_id?: string | null
  precio?: number | null
  pension?: number | null
  centralizador_1_persona_id?: string | null
  centralizador_1_nombre?: string | null
  centralizador_1_email?: string | null
  centralizador_1_telefono?: string | null
  centralizador_2_persona_id?: string | null
  centralizador_2_nombre?: string | null
  centralizador_2_email?: string | null
  centralizador_2_telefono?: string | null
  centralizador_3_persona_id?: string | null
  centralizador_3_nombre?: string | null
  centralizador_3_email?: string | null
  centralizador_3_telefono?: string | null
  manuales_stock?: number | null
  manuales_necesarios?: number | null
  notas_noticias?: string | null
}

const CAMPOS_NOTICIAS = [
  'casa_retiro_id',
  // Los valores se cargan en esta etapa, ya no al solicitar el evento.
  'precio', 'pension',
  'centralizador_1_persona_id', 'centralizador_1_nombre', 'centralizador_1_email', 'centralizador_1_telefono',
  'centralizador_2_persona_id', 'centralizador_2_nombre', 'centralizador_2_email', 'centralizador_2_telefono',
  'centralizador_3_persona_id', 'centralizador_3_nombre', 'centralizador_3_email', 'centralizador_3_telefono',
  'manuales_stock', 'manuales_necesarios',
  'notas_noticias',
] as const

async function getEventoAndCheckPermission(id: string) {
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return { error: 'No autenticado', status: 401, ctx: null, supabase: null, evento: null }

  const { data: evento, error } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, solicitado_por')
    .eq('id', id)
    .single()

  if (error || !evento) return { error: 'Retiro no encontrado', status: 404, ctx: null, supabase: null, evento: null }

  if (evento.estado !== 'pendiente_datos_noticias') {
    return { error: `El retiro en estado "${evento.estado}" no permite editar datos de noticias`, status: 422, ctx: null, supabase: null, evento: null }
  }

  // Permission: solicitante, confra approver, or EqT
  const esSolicitante = ctx.persona_id && ctx.persona_id === evento.solicitado_por
  const puedeConfra = canPerform(ctx, 'event.approve_confra', evento.organizacion_id ?? null)
  const puedeEqt = canPerform(ctx, 'event.approve_eqt')

  if (!esSolicitante && !puedeConfra && !puedeEqt) {
    return { error: 'No tenés permiso para editar estos datos', status: 403, ctx: null, supabase: null, evento: null }
  }

  return { error: null, status: 200, ctx, supabase, evento }
}

// PATCH — guardar datos sin cambiar estado
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, status, supabase, evento } = await getEventoAndCheckPermission(id)

  if (error || !supabase || !evento) {
    return NextResponse.json({ error }, { status })
  }

  const body = (await request.json()) as DatosNoticias

  // Filter to only allowed campos
  const updates: Record<string, unknown> = {}
  for (const campo of CAMPOS_NOTICIAS) {
    if (campo in body) {
      updates[campo] = body[campo as keyof DatosNoticias] ?? null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// POST — guardar datos y confirmar (transiciona a 'aprobado')
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, status, ctx, supabase, evento } = await getEventoAndCheckPermission(id)

  if (error || !ctx || !supabase || !evento) {
    return NextResponse.json({ error }, { status })
  }

  const body = (await request.json()) as DatosNoticias

  // Validate at least 1 centralizador with nombre
  if (!body.centralizador_1_nombre?.trim()) {
    return NextResponse.json(
      { error: 'Se requiere al menos un centralizador (Nombre del centralizador 1)' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = { estado: 'pendiente_aprobacion_final' }
  for (const campo of CAMPOS_NOTICIAS) {
    updates[campo] = body[campo as keyof DatosNoticias] ?? null
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ estado: 'pendiente_aprobacion_final' })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

const ESTADOS_TERMINALES = ['suspendido', 'cancelado', 'finalizado', 'rechazado']

async function getEventoAndCheckPermission(id: string) {
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return { error: 'No autenticado', status: 401, ctx: null, supabase: null, evento: null }

  const { data: evento, error } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, solicitado_por')
    .eq('id', id)
    .single()

  if (error || !evento) return { error: 'Retiro no encontrado', status: 404, ctx: null, supabase: null, evento: null }

  if (ESTADOS_TERMINALES.includes(evento.estado)) {
    return {
      error: `El retiro en estado "${evento.estado}" no puede tener solicitudes de suspensión`,
      status: 422, ctx: null, supabase: null, evento: null,
    }
  }

  // Puede solicitar quien tenga el permiso en la confraternidad y/o en la fraternidad del evento
  const puedeSolicitar =
    canPerform(ctx, 'event.request_suspend', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.request_suspend', evento.fraternidad_id) : false)

  if (!puedeSolicitar) {
    return { error: 'No tenés permiso para solicitar la suspensión de este retiro', status: 403, ctx: null, supabase: null, evento: null }
  }

  return { error: null, status: 200, ctx, supabase, evento }
}

// POST — solicitar suspensión
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, status, ctx, supabase, evento } = await getEventoAndCheckPermission(id)

  if (error || !ctx || !supabase || !evento) {
    return NextResponse.json({ error }, { status })
  }

  const body = await request.json() as { notas?: string }

  if (!body.notas?.trim()) {
    return NextResponse.json({ error: 'El motivo de la solicitud es obligatorio' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      solicitud_suspension_notas: body.notas.trim(),
      solicitud_suspension_por: ctx.persona_id,
      solicitud_suspension_fecha: today,
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// DELETE — cancelar solicitud de suspensión
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, status, supabase, evento } = await getEventoAndCheckPermission(id)

  if (error || !supabase || !evento) {
    return NextResponse.json({ error }, { status })
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      solicitud_suspension_notas: null,
      solicitud_suspension_por: null,
      solicitud_suspension_fecha: null,
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

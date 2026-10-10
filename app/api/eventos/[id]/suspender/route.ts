import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

const ESTADOS_TERMINALES = ['suspendido', 'cancelado', 'finalizado']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!canPerform(ctx, 'event.suspend')) {
    return NextResponse.json({ error: 'Solo el Equipo Timón puede suspender retiros' }, { status: 403 })
  }

  const { data: evento, error: fetchError } = await supabase
    .from('eventos')
    .select('id, estado')
    .eq('id', id)
    .single()

  if (fetchError || !evento) {
    return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  }

  if (ESTADOS_TERMINALES.includes(evento.estado)) {
    return NextResponse.json(
      { error: `El retiro ya está en estado "${evento.estado}" y no puede suspenderse` },
      { status: 422 }
    )
  }

  const body = await request.json() as { notas_suspension?: string }

  if (!body.notas_suspension?.trim()) {
    return NextResponse.json({ error: 'Las notas de suspensión son obligatorias' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      estado: 'suspendido',
      suspendido_por: ctx.persona_id,
      fecha_suspension: today,
      notas_suspension: body.notas_suspension.trim(),
      // Clear any pending suspension request
      solicitud_suspension_notas: null,
      solicitud_suspension_por: null,
      solicitud_suspension_fecha: null,
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ estado: 'suspendido' })
}

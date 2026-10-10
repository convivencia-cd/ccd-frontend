import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id')
    .eq('id', id)
    .single()

  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  }

  if (evento.estado !== 'aprobado') {
    return NextResponse.json(
      { error: `Solo se pueden publicar retiros en estado "aprobado". Estado actual: "${evento.estado}".` },
      { status: 422 }
    )
  }

  if (!canPerform(ctx, 'event.publish', evento.organizacion_id ?? null)) {
    return NextResponse.json(
      { error: 'No tenés permiso para publicar este retiro' },
      { status: 403 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      estado: 'publicado',
      publicado_por: ctx.persona_id ?? null,
      fecha_publicacion: today,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ estado: 'publicado' })
}

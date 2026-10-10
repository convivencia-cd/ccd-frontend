import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'

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
    .select('id, estado, organizacion_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()

  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  }

  if (evento.estado !== 'publicado') {
    return NextResponse.json(
      { error: `Solo se pueden iniciar retiros en estado "publicado". Estado actual: "${evento.estado}".` },
      { status: 422 }
    )
  }

  // El Centralizador del evento lo arranca en el terreno, sin necesitar el
  // permiso de conducción (mismo criterio que la ficha del evento).
  if (
    !canPerform(ctx, 'event.publish', evento.organizacion_id ?? null) &&
    !esCentralizadorDeEvento(ctx, evento)
  ) {
    return NextResponse.json(
      { error: 'No tenés permiso para iniciar este retiro' },
      { status: 403 }
    )
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      estado: 'en_curso',
      fecha_inicio_real: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ estado: 'en_curso' })
}

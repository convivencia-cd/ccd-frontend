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

  if (evento.estado !== 'en_curso') {
    return NextResponse.json(
      { error: `Solo se pueden finalizar retiros en curso. Estado actual: "${evento.estado}".` },
      { status: 422 }
    )
  }

  // Igual que iniciar: el Centralizador cierra el evento en el terreno.
  if (
    !canPerform(ctx, 'event.publish', evento.organizacion_id ?? null) &&
    !esCentralizadorDeEvento(ctx, evento)
  ) {
    return NextResponse.json(
      { error: 'No tenés permiso para finalizar este retiro' },
      { status: 403 }
    )
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update({ estado: 'finalizado' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ estado: 'finalizado' })
}

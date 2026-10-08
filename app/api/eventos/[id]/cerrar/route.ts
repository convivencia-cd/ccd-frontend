import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canCerrarConvivencia, MIN_FOTOS_CIERRE } from '@/lib/eventos/cierre'
import { contarFotosCierre } from '@/lib/eventos/fotos-cierre'

// Cierra la convivencia: finalizado → cerrado. Solo Equipo Timón.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()

  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, coordinador_asignado_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()

  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  }

  if (evento.estado !== 'finalizado') {
    return NextResponse.json(
      { error: `Solo se pueden cerrar eventos finalizados. Estado actual: "${evento.estado}".` },
      { status: 422 }
    )
  }

  if (!canCerrarConvivencia(ctx, evento)) {
    return NextResponse.json(
      { error: 'Solo el Equipo Timón puede cerrar la convivencia' },
      { status: 403 }
    )
  }

  // Tarjeta #44: el centralizador tiene que haber adjuntado al menos MIN_FOTOS_CIERRE fotos.
  try {
    const fotos = await contarFotosCierre(id)
    if (fotos < MIN_FOTOS_CIERRE) {
      return NextResponse.json(
        { error: `Faltan fotos: hay ${fotos} y se necesitan al menos ${MIN_FOTOS_CIERRE} para cerrar la convivencia.` },
        { status: 422 }
      )
    }
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message ?? 'No se pudieron contar las fotos'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update({
      estado: 'cerrado',
      fecha_cierre: new Date().toISOString(),
      cerrado_por: ctx.persona_id,
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ estado: 'cerrado' })
}

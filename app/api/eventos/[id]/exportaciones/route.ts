import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canGestionarParticipantes } from '@/lib/eventos/equipo'
import { canVerDatosSensiblesInscripcion, type EventoInscripcionScope } from '@/lib/eventos/inscripcion-datos'
import { cargarDietasDeParticipantes } from '@/lib/eventos/inscripcion-datos-server'
import type { FilaExportacion } from '@/lib/eventos/exportaciones'

// GET — datos para los exports de Gestión del Evento (card #54): cartelitos
// (apodo + localidad) y dietas. Entra todo el que va a estar en la casa:
// participantes inscriptos/conviventes y el equipo. Quedan afuera interesados
// y cancelados. El detalle de la dieta solo viaja si quien pide puede verlo,
// igual que en la ficha de inscripción.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: evento } = await supabase
    .from('eventos')
    .select(
      'id, nombre, organizacion_id, fraternidad_id, coordinador_asignado_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id'
    )
    .eq('id', id)
    .single()

  if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

  const scope = evento as unknown as EventoInscripcionScope
  if (!canGestionarParticipantes(ctx, scope)) {
    return NextResponse.json({ error: 'No tenés permiso para exportar los datos de este evento' }, { status: 403 })
  }

  const { data: participantesData, error } = await supabase
    .from('evento_participantes')
    .select('id, rol_en_evento, estado_participacion, persona:personas!persona_id(nombre, apellido, apodo, localidad)')
    .eq('evento_id', id)
    .not('estado_participacion', 'in', '(interesado,cancelado)')

  if (error) {
    console.error('[exportaciones] error leyendo participantes:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los participantes' }, { status: 500 })
  }

  const participantes = ((participantesData ?? []) as unknown as {
    id: string
    rol_en_evento: string
    persona: { nombre: string; apellido: string; apodo: string | null; localidad: string | null } | null
  }[]).filter(p => p.persona)

  let dietas
  try {
    dietas = await cargarDietasDeParticipantes(participantes.map(p => p.id))
  } catch (err) {
    console.error('[exportaciones] error leyendo las dietas:', err)
    return NextResponse.json({ error: 'No se pudieron cargar las dietas' }, { status: 500 })
  }

  const verSensibles = canVerDatosSensiblesInscripcion(ctx, scope)

  const filas: FilaExportacion[] = participantes.map(p => {
    const dieta = dietas.get(p.id)
    return {
      nombre: p.persona!.nombre,
      apellido: p.persona!.apellido,
      apodo: p.persona!.apodo,
      localidad: p.persona!.localidad,
      rol_en_evento: p.rol_en_evento,
      completo_inscripcion: !!dieta,
      restricciones_alimentarias: dieta?.restricciones_alimentarias ?? [],
      dieta_detalle: verSensibles ? dieta?.dieta_detalle ?? null : null,
    }
  })

  return NextResponse.json({ evento: { nombre: evento.nombre }, filas, verSensibles })
}

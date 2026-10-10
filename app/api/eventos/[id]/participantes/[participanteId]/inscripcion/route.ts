import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canGestionarParticipantes } from '@/lib/eventos/equipo'
import { canVerDatosSensiblesInscripcion, type EventoInscripcionScope } from '@/lib/eventos/inscripcion-datos'
import { cargarInscripcionDatos } from '@/lib/eventos/inscripcion-datos-server'
import { nombreLegible } from '@/lib/personas/eventos-realizados'

// GET — ficha de inscripción de un participante: los datos personales que
// completó al inscribirse y sus respuestas para este evento. La dieta y las
// observaciones de salud solo viajan si quien pide puede verlas
// (canVerDatosSensiblesInscripcion); si no, ni salen del servidor.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; participanteId: string }> }
) {
  const { id, participanteId } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: evento } = await supabase
    .from('eventos')
    .select(
      'id, organizacion_id, fraternidad_id, coordinador_asignado_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id'
    )
    .eq('id', id)
    .single()

  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })

  const scope = evento as unknown as EventoInscripcionScope
  if (!canGestionarParticipantes(ctx, scope)) {
    return NextResponse.json(
      { error: 'No tenés permiso para ver las inscripciones de este retiro' },
      { status: 403 }
    )
  }

  // .eq('evento_id', id): un id de participante de otro evento no pasa con el
  // permiso chequeado sobre ESTE evento.
  const { data: participante } = await supabase
    .from('evento_participantes')
    .select(
      `id, persona_id, persona:personas!persona_id(
        nombre, apellido, apodo, email, telefono, tipo_documento, documento, fecha_nacimiento,
        direccion, direccion_nro, localidad, codigo_postal, provincia, pais,
        sexo, estado_vida, nacionalidad, nivel_estudios, ocupacion, diocesis,
        estado_eclesial, estado_eclesial_rango, institucion_religiosa,
        formacion_religiosa, participacion_grupos_iglesia, accion_social
      )`
    )
    .eq('id', participanteId)
    .eq('evento_id', id)
    .maybeSingle()

  if (!participante) return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 })

  let inscripcion
  try {
    inscripcion = await cargarInscripcionDatos(participanteId)
  } catch (err) {
    console.error('[participantes/inscripcion] error leyendo los datos de la inscripción:', err)
    return NextResponse.json({ error: 'No se pudo cargar la ficha de inscripción' }, { status: 500 })
  }

  // Historial de convivencias/retiros/talleres: es de la persona (misma tabla que el perfil).
  const { data: realizadosData } = await supabase
    .from('persona_eventos_realizados')
    .select('anio, tipo:tipos_eventos!tipo_evento_id(nombre)')
    .eq('persona_id', participante.persona_id)
    .order('anio', { ascending: true, nullsFirst: false })
  const realizados = ((realizadosData ?? []) as unknown as { anio: number | null; tipo: { nombre: string } | null }[])
    .filter(r => r.tipo)
    .map(r => ({ nombre: nombreLegible(r.tipo!.nombre), anio: r.anio }))

  const verSensibles = canVerDatosSensiblesInscripcion(ctx, scope)
  if (inscripcion && !verSensibles) {
    inscripcion = { ...inscripcion, dieta_detalle: null, salud_observaciones: null }
  }

  return NextResponse.json({ persona: participante.persona, inscripcion, realizados, verSensibles })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import {
  canExportarFichasInscripcion,
  canVerDatosSensiblesInscripcion,
  type EventoInscripcionScope,
} from '@/lib/eventos/inscripcion-datos'
import { cargarInscripcionDatosDeParticipantes } from '@/lib/eventos/inscripcion-datos-server'
import { nombreLegible } from '@/lib/personas/eventos-realizados'
import type { FichaExport } from '@/lib/eventos/fichas-inscripcion'

const CAMPOS_PERSONA = `
  nombre, apellido, apodo, email, telefono, tipo_documento, documento, fecha_nacimiento,
  direccion, direccion_nro, localidad, codigo_postal, provincia, pais,
  sexo, estado_vida, nacionalidad, nivel_estudios, ocupacion, diocesis,
  estado_eclesial, estado_eclesial_rango, institucion_religiosa,
  formacion_religiosa, participacion_grupos_iglesia, accion_social
`

// GET — fichas de inscripción de todos los participantes del evento, para
// exportarlas en PDF/Excel (card #97). Mismo contenido que la ficha que se abre
// de a una; la dieta y la salud solo viajan si quien pide puede verlas.
// Entran los conviventes no cancelados; los interesados solo si ya completaron
// la planilla (preinscriptos).
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

  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })

  const scope = evento as unknown as EventoInscripcionScope
  if (!canExportarFichasInscripcion(ctx, scope)) {
    return NextResponse.json({ error: 'No tenés permiso para exportar las fichas de este retiro' }, { status: 403 })
  }

  const { data: participantesData, error } = await supabase
    .from('evento_participantes')
    .select(`id, persona_id, estado_participacion, persona:personas!persona_id(${CAMPOS_PERSONA})`)
    .eq('evento_id', id)
    .eq('rol_en_evento', 'convivente')
    .neq('estado_participacion', 'cancelado')

  if (error) {
    console.error('[fichas] error leyendo participantes:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los participantes' }, { status: 500 })
  }

  const participantes = ((participantesData ?? []) as unknown as {
    id: string
    persona_id: string
    estado_participacion: string
    persona: Record<string, string | null> | null
  }[]).filter(p => p.persona)

  let datos
  try {
    datos = await cargarInscripcionDatosDeParticipantes(participantes.map(p => p.id))
  } catch (err) {
    console.error('[fichas] error leyendo los datos de inscripción:', err)
    return NextResponse.json({ error: 'No se pudieron cargar las fichas' }, { status: 500 })
  }

  // Interesados sin planilla quedan afuera: todavía no tienen ficha.
  const conFicha = participantes.filter(p => p.estado_participacion !== 'interesado' || datos.has(p.id))

  const personaIds = [...new Set(conFicha.map(p => p.persona_id))]
  const realizadosPorPersona = new Map<string, { nombre: string; anio: number | null }[]>()
  if (personaIds.length > 0) {
    const { data: realizadosData } = await supabase
      .from('persona_eventos_realizados')
      .select('persona_id, anio, tipo:tipos_eventos!tipo_evento_id(nombre)')
      .in('persona_id', personaIds)
      .order('anio', { ascending: true, nullsFirst: false })
    for (const r of (realizadosData ?? []) as unknown as {
      persona_id: string
      anio: number | null
      tipo: { nombre: string } | null
    }[]) {
      if (!r.tipo) continue
      const lista = realizadosPorPersona.get(r.persona_id) ?? []
      lista.push({ nombre: nombreLegible(r.tipo.nombre), anio: r.anio })
      realizadosPorPersona.set(r.persona_id, lista)
    }
  }

  const verSensibles = canVerDatosSensiblesInscripcion(ctx, scope)

  const fichas: FichaExport[] = conFicha
    .map(p => {
      let inscripcion = datos.get(p.id) ?? null
      if (inscripcion && !verSensibles) {
        inscripcion = { ...inscripcion, dieta_detalle: null, salud_observaciones: null }
      }
      return {
        estado: p.estado_participacion === 'interesado' ? 'preinscripto' : p.estado_participacion,
        persona: p.persona!,
        inscripcion,
        realizados: realizadosPorPersona.get(p.persona_id) ?? [],
      }
    })
    .sort((a, b) =>
      `${a.persona.apellido ?? ''} ${a.persona.nombre ?? ''}`.localeCompare(
        `${b.persona.apellido ?? ''} ${b.persona.nombre ?? ''}`,
        'es'
      )
    )

  return NextResponse.json({ evento: { nombre: evento.nombre }, fichas, verSensibles })
}

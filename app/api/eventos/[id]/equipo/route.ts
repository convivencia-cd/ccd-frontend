import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canGestionarAsignaciones } from '@/lib/eventos/equipo'
import {
  avisarEquipo,
  centralizadoresNuevos,
  coordinadorYAsesorNuevos,
  COLUMNAS_CENTRALIZADORES_AVISO,
  COLUMNAS_COORDINADOR_ASESOR_AVISO,
  ESTADOS_CENTRALIZADORES_AVISADOS,
  ESTADOS_COORDINADOR_ASESOR_AVISADOS,
} from '@/lib/eventos/avisos-equipo'
import { getPublicOrigin } from '@/lib/http'

/**
 * Asignaciones de personas que viven como columnas de `eventos`: coordinador y
 * asesor designados por el Equipo Timón, y los hasta 3 centralizadores.
 *
 * El panel "Datos para Noticias" (/api/eventos/[id]/datos-noticias) ya escribe
 * los centralizadores, pero solo mientras el evento está en
 * `pendiente_datos_noticias`. Esta ruta existe para poder corregirlos después
 * —evento publicado o en curso— desde Editar evento y desde Gestión.
 */
const CAMPOS_ASIGNACION = [
  'coordinador_asignado_id',
  'asesor_asignado_id',
  'centralizador_1_persona_id', 'centralizador_1_nombre', 'centralizador_1_email', 'centralizador_1_telefono',
  'centralizador_2_persona_id', 'centralizador_2_nombre', 'centralizador_2_email', 'centralizador_2_telefono',
  'centralizador_3_persona_id', 'centralizador_3_nombre', 'centralizador_3_email', 'centralizador_3_telefono',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: evento } = await supabase
    .from('eventos')
    .select(
      `id, estado, organizacion_id, fraternidad_id, ${COLUMNAS_CENTRALIZADORES_AVISO}, ${COLUMNAS_COORDINADOR_ASESOR_AVISO}`
    )
    .eq('id', id)
    .single()

  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })

  if (!canGestionarAsignaciones(ctx, evento)) {
    return NextResponse.json({ error: 'No tenés permiso para cambiar las asignaciones del retiro' }, { status: 403 })
  }

  const body = (await request.json()) as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  for (const campo of CAMPOS_ASIGNACION) {
    if (campo in body) {
      const valor = body[campo]
      updates[campo] = valor === '' || valor === undefined ? null : valor
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar' }, { status: 400 })
  }

  // Un mismo cecista no puede ocupar dos casilleros de centralizador: el evento
  // lo tomaría dos veces en los avisos y en los listados de "Soy Centralizador".
  const centralizadores = ([1, 2, 3] as const)
    .map(n => {
      const campo = `centralizador_${n}_persona_id`
      return campo in updates
        ? (updates[campo] as string | null)
        : ((evento as Record<string, unknown>)[campo] as string | null)
    })
    .filter(Boolean)
  if (new Set(centralizadores).size !== centralizadores.length) {
    return NextResponse.json(
      { error: 'No se puede asignar a la misma persona como centralizador más de una vez' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase.from('eventos').update(updates).eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  // Aviso por mail (card #21) solo a quien entra nuevo, y solo si a ese rol ya
  // se le avisó (antes de eso se avisa en el paso que corresponde).
  const anterior = evento as Record<string, unknown>
  await avisarEquipo(supabase, id, getPublicOrigin(request), [
    ...(ESTADOS_COORDINADOR_ASESOR_AVISADOS.includes(evento.estado) ? coordinadorYAsesorNuevos(anterior, updates) : []),
    ...(ESTADOS_CENTRALIZADORES_AVISADOS.includes(evento.estado)
      ? centralizadoresNuevos(anterior, updates).map(c => ({ ...c, rol: 'centralizador' as const }))
      : []),
  ])

  return NextResponse.json({ ok: true })
}

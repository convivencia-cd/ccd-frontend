import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Card #47 — Coordinadores por Tipo de Evento (migración 103).
 *
 * Habilitado para coordinar el tipo T = asignación vigente del ministerio
 * Coordinador (COOR) que tiene T tildado en asignacion_ministerio_tipos_evento.
 */

export const CODIGO_MINISTERIO_COORDINADOR = 'COOR'

export type CoordinadorHabilitado = {
  id: string
  nombre: string
  apellido: string
  apodo: string | null
}

type Fila = {
  asignacion: {
    estado: string
    fecha_fin: string | null
    ministerio: { codigo_interno: string | null } | null
    persona: (CoordinadorHabilitado & { fecha_baja: string | null }) | null
  } | null
}

/** Personas habilitadas para coordinar el tipo de evento, ordenadas por apellido. */
export async function coordinadoresHabilitados(
  supabase: SupabaseClient,
  tipoEventoId: string | null | undefined,
): Promise<CoordinadorHabilitado[]> {
  if (!tipoEventoId) return []

  const { data, error } = await supabase
    .from('asignacion_ministerio_tipos_evento')
    .select(
      'asignacion:asignaciones_ministerio!inner(estado, fecha_fin, ministerio:ministerios!inner(codigo_interno), persona:personas!persona_id(id, nombre, apellido, apodo, fecha_baja))',
    )
    .eq('tipo_evento_id', tipoEventoId)

  if (error) {
    console.error('[coordinadoresHabilitados]', error.message)
    return []
  }

  const porId = new Map<string, CoordinadorHabilitado>()
  for (const fila of (data ?? []) as unknown as Fila[]) {
    const a = fila.asignacion
    if (!a || a.estado !== 'activo' || a.fecha_fin !== null) continue
    if (a.ministerio?.codigo_interno !== CODIGO_MINISTERIO_COORDINADOR) continue
    const p = a.persona
    if (!p || p.fecha_baja) continue
    porId.set(p.id, { id: p.id, nombre: p.nombre, apellido: p.apellido, apodo: p.apodo })
  }

  return [...porId.values()].sort(
    (a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'),
  )
}

/**
 * Valida un cambio de coordinador_asignado_id. Devuelve el mensaje de error o
 * null si está bien. Vaciar el campo o dejar el mismo coordinador que ya tenía
 * siempre se permite (eventos cargados antes de la card #47).
 */
export async function validarCoordinadorAsignado(
  supabase: SupabaseClient,
  tipoEventoId: string | null | undefined,
  coordinadorNuevo: unknown,
  coordinadorAnterior: string | null | undefined,
): Promise<string | null> {
  if (coordinadorNuevo === undefined || coordinadorNuevo === null || coordinadorNuevo === '') return null
  if (coordinadorNuevo === coordinadorAnterior) return null
  if (typeof coordinadorNuevo !== 'string') return 'Coordinador inválido'

  const habilitados = await coordinadoresHabilitados(supabase, tipoEventoId)
  if (habilitados.some(p => p.id === coordinadorNuevo)) return null
  return 'La persona elegida no está habilitada como coordinadora de este tipo de evento. Se habilita desde Ministerios › Asignaciones (ministerio Coordinador).'
}

/**
 * Valida un cambio de coordinadores_propuestos ("Nombre Apellido, Nombre Apellido").
 * Los nombres que ya estaban se conservan; cada nombre nuevo tiene que ser el de
 * un coordinador habilitado para el tipo de evento.
 */
export async function validarCoordinadoresPropuestos(
  supabase: SupabaseClient,
  tipoEventoId: string | null | undefined,
  propuestosNuevos: unknown,
  propuestosAnteriores: string | null | undefined,
): Promise<string | null> {
  if (propuestosNuevos === undefined || propuestosNuevos === null) return null
  if (typeof propuestosNuevos !== 'string') return 'Coordinadores propuestos inválidos'

  const normalizar = (s: string) => s.trim().toLowerCase()
  const separar = (s: string | null | undefined) => (s ?? '').split(',').map(normalizar).filter(Boolean)

  const anteriores = new Set(separar(propuestosAnteriores))
  const agregados = separar(propuestosNuevos).filter(n => !anteriores.has(n))
  if (agregados.length === 0) return null

  const habilitados = new Set(
    (await coordinadoresHabilitados(supabase, tipoEventoId)).map(p => normalizar(`${p.nombre} ${p.apellido}`)),
  )
  if (agregados.every(n => habilitados.has(n))) return null
  return 'Algún coordinador propuesto no está habilitado para este tipo de evento. Se habilita desde Ministerios › Asignaciones (ministerio Coordinador).'
}

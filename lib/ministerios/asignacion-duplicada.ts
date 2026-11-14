import type { SupabaseClient } from '@supabase/supabase-js'
import { nombreCompletoConApodo } from '@/lib/personas/nombre'

/**
 * Card #124 — una persona no puede tener dos asignaciones ACTIVAS del mismo
 * rol en la misma organización (sí puede tenerlo en organizaciones distintas:
 * p. ej. Delegado de dos fraternidades).
 *
 * La regla la garantiza el índice único `uq_asignaciones_ministerio_activa`
 * (migración 106). Este chequeo previo existe solo para mostrar un mensaje
 * claro antes de llegar al error de la base.
 */

export const INDICE_ASIGNACION_ACTIVA = 'uq_asignaciones_ministerio_activa'

export const MENSAJE_ASIGNACION_DUPLICADA_GENERICO =
  'La persona ya tiene ese rol activo en esa organización. Si querés modificarla, editá la asignación existente.'

interface Params {
  personaId: string
  ministerioId: string
  organizacionId: string | null
  /** Al editar, la propia asignación no cuenta como duplicado. */
  excluirId?: string
}

/**
 * Devuelve el mensaje a mostrar si ya existe una asignación activa igual,
 * o null si se puede guardar.
 */
export async function verificarAsignacionDuplicada(
  supabase: SupabaseClient,
  { personaId, ministerioId, organizacionId, excluirId }: Params,
): Promise<string | null> {
  let query = supabase
    .from('asignaciones_ministerio')
    .select(
      `id, fecha_inicio,
       persona:personas!persona_id(nombre, apellido, apodo),
       ministerio:ministerios!ministerio_id(nombre),
       organizacion:organizaciones!organizacion_id(nombre)`,
    )
    .eq('persona_id', personaId)
    .eq('ministerio_id', ministerioId)
    .eq('estado', 'activo')
    .limit(1)

  query = organizacionId
    ? query.eq('organizacion_id', organizacionId)
    : query.is('organizacion_id', null)
  if (excluirId) query = query.neq('id', excluirId)

  const { data } = await query
  const existente = data?.[0] as any
  if (!existente) return null

  const persona = existente.persona ? nombreCompletoConApodo(existente.persona) : 'La persona'
  const rol = existente.ministerio?.nombre ?? 'ese rol'
  const org = existente.organizacion?.nombre
    ? ` en ${existente.organizacion.nombre}`
    : ' (sin organización)'
  const desde = existente.fecha_inicio
    ? ` desde el ${existente.fecha_inicio.split('-').reverse().join('/')}`
    : ''

  return `${persona} ya tiene el rol ${rol} activo${org}${desde}. Si querés modificarla, editá la asignación existente.`
}

/** True si el error de Supabase es el del índice de asignaciones activas. */
export function esErrorAsignacionDuplicada(message: string | undefined | null): boolean {
  return !!message && message.includes(INDICE_ASIGNACION_ACTIVA)
}

import { canPerform, type UserContext } from '@/lib/auth/context'
import type { Permission } from '@/lib/auth/permissions'
import { eventoIdsComoCoordinadorOCentralizador } from '@/lib/eventos/roles'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type AccesoPorEvento = {
  /** true si el usuario puede ver la sección (aunque sea para un solo evento). */
  hasAccess: boolean
  /**
   * Eventos que el usuario puede ver. `null` = sin restricción (admin general).
   * Un array vacío significa que no alcanza ningún evento.
   */
  allowedEventoIds: string[] | null
}

/**
 * Acceso a las secciones de listado de Retiros (Interesados, Inscriptos): el
 * permiso de catálogo indicado, scopeado a las organizaciones del usuario, o
 * ser coordinador/centralizador de un evento puntual (columnas en `eventos`,
 * ver lib/eventos/roles.ts), que alcanza solo a ese evento.
 */
export async function resolverAccesoPorEvento(
  supabase: SupabaseServerClient,
  ctx: UserContext,
  permiso: Permission,
): Promise<AccesoPorEvento> {
  if (ctx.is_admin) return { hasAccess: true, allowedEventoIds: null }

  const canViewOrg = canPerform(ctx, permiso)

  const eventoIdsPropios = ctx.persona_id
    ? await eventoIdsComoCoordinadorOCentralizador(supabase, ctx.persona_id)
    : []

  let eventoIdsPorOrg: string[] = []
  if (canViewOrg && ctx.org_ids.length > 0) {
    const orFilter = ctx.org_ids.map((id) => `organizacion_id.eq.${id},fraternidad_id.eq.${id}`).join(',')
    const { data: eventosOrg } = await supabase.from('eventos').select('id').or(orFilter)
    eventoIdsPorOrg = (eventosOrg ?? []).map((e) => e.id as string)
  }

  const allowedEventoIds = [...new Set([...eventoIdsPropios, ...eventoIdsPorOrg])]

  return { hasAccess: canViewOrg || allowedEventoIds.length > 0, allowedEventoIds }
}

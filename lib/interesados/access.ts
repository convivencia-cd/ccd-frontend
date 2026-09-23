import { canPerform, type UserContext } from '@/lib/auth/context'
import { eventoIdsComoCoordinadorOCentralizador } from '@/lib/eventos/roles'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type AccesoInteresados = {
  /** true si el usuario puede ver la sección (aunque sea para un solo evento). */
  hasAccess: boolean
  /**
   * Eventos que el usuario puede ver/gestionar. `null` = sin restricción
   * (admin general). Un array vacío significa que no alcanza ningún evento.
   */
  allowedEventoIds: string[] | null
}

/**
 * Quién puede trabajar el seguimiento de interesados: el permiso de catálogo
 * `view.interesados` (scopeado a las organizaciones del usuario) o ser
 * coordinador/centralizador de un evento puntual (columnas en `eventos`, ver
 * lib/eventos/roles.ts). Lo usan tanto la página /interesados como el route
 * handler que guarda el seguimiento, para que no se separen.
 */
export async function resolverAccesoInteresados(
  supabase: SupabaseServerClient,
  ctx: UserContext,
): Promise<AccesoInteresados> {
  const canViewAll = canPerform(ctx, 'view.interesados')

  if (ctx.is_admin) return { hasAccess: true, allowedEventoIds: null }

  const eventoIdsPropios = ctx.persona_id
    ? await eventoIdsComoCoordinadorOCentralizador(supabase, ctx.persona_id)
    : []

  let eventoIdsPorOrg: string[] = []
  if (canViewAll && ctx.org_ids.length > 0) {
    const orFilter = ctx.org_ids.map((id) => `organizacion_id.eq.${id},fraternidad_id.eq.${id}`).join(',')
    const { data: eventosOrg } = await supabase.from('eventos').select('id').or(orFilter)
    eventoIdsPorOrg = (eventosOrg ?? []).map((e) => e.id as string)
  }

  const allowedEventoIds = [...new Set([...eventoIdsPropios, ...eventoIdsPorOrg])]

  return { hasAccess: canViewAll || allowedEventoIds.length > 0, allowedEventoIds }
}

/** ¿Puede este usuario gestionar el seguimiento de un interesado de `eventoId`? */
export async function puedeGestionarInteresado(
  supabase: SupabaseServerClient,
  ctx: UserContext,
  eventoId: string,
): Promise<boolean> {
  const { hasAccess, allowedEventoIds } = await resolverAccesoInteresados(supabase, ctx)
  if (!hasAccess) return false
  if (allowedEventoIds === null) return true
  return allowedEventoIds.includes(eventoId)
}

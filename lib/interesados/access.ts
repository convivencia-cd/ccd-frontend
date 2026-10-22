import type { UserContext } from '@/lib/auth/context'
import { resolverAccesoPorEvento, type AccesoPorEvento } from '@/lib/eventos/acceso-por-evento'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type AccesoInteresados = AccesoPorEvento

/**
 * Quién puede trabajar el seguimiento de interesados: el permiso de catálogo
 * `view.interesados` (scopeado a las organizaciones del usuario) o ser
 * coordinador/centralizador de un evento puntual. Lo usan tanto la página
 * /interesados como el route handler que guarda el seguimiento, para que no
 * se separen.
 */
export function resolverAccesoInteresados(
  supabase: SupabaseServerClient,
  ctx: UserContext,
): Promise<AccesoInteresados> {
  return resolverAccesoPorEvento(supabase, ctx, 'view.interesados')
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

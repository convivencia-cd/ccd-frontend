import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicOrigin } from '@/lib/http'
import { notificarCambioEstadoRetiro } from './notificar-estado'

/**
 * Los callers validan permisos y transición. El filtro por estado anterior evita
 * pisar cambios concurrentes y enviar dos notificaciones por la misma transición.
 */
export async function actualizarEstadoEvento(
  supabase: SupabaseClient,
  request: Request,
  id: string,
  estadoAnterior: string,
  updates: Record<string, unknown> & { estado: string },
) {
  const { data: evento, error } = await supabase.from('eventos')
    .update(updates)
    .eq('id', id)
    .eq('estado', estadoAnterior)
    .select('id, nombre, estado, organizacion_id, fraternidad_id, coordinador_asignado_id')
    .maybeSingle()
  if (error) return { error }
  if (!evento) return { error: { message: 'El retiro cambió de estado o no tenés permiso para modificarlo. Recargá la página y volvé a intentar.' } }
  if (estadoAnterior !== evento.estado) {
    await notificarCambioEstadoRetiro(evento, getPublicOrigin(request))
  }
  return { error: null }
}

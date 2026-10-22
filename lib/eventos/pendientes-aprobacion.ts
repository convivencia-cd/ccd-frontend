import { canPerform, type UserContext } from '@/lib/auth/context'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type EventoPendiente = {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  organizacion_id: string | null
  fraternidad_id: string | null
  organizacion: { id: string; nombre: string } | null
}

/**
 * Retiros que esperan una acción de ESTE usuario (discernimiento o aprobación).
 * Única fuente para el indicador "Pendientes" del Panel de Inicio y para la
 * sección "Pendientes de tu aprobación" de /eventos, así el número y el
 * listado coinciden (card #78).
 */
export async function cargarPendientesDeAprobacion(
  supabase: SupabaseServerClient,
  ctx: UserContext,
): Promise<EventoPendiente[]> {
  const canApproveConfra = canPerform(ctx, 'event.approve_confra')
  const canApproveEqt = canPerform(ctx, 'event.approve_eqt')
  if (!canApproveConfra && !canApproveEqt) return []

  const estados = new Set<string>()
  if (canApproveConfra) estados.add('solicitud')
  if (canApproveEqt) {
    estados.add('solicitud')
    estados.add('discernimiento_confra')
    estados.add('discernimiento_eqt')
    estados.add('pendiente_aprobacion_final')
  }

  const { data } = await supabase
    .from('eventos')
    .select(
      'id, nombre, tipo, estado, fecha_inicio, fecha_fin, organizacion_id, fraternidad_id, requiere_discernimiento_confra, requiere_discernimiento_eqt, organizacion:organizaciones!organizacion_id(id, nombre)',
    )
    .in('estado', [...estados])
    .order('fecha_solicitud', { ascending: true })

  type Fila = EventoPendiente & {
    requiere_discernimiento_confra: boolean | null
    requiere_discernimiento_eqt: boolean | null
  }

  return ((data ?? []) as unknown as Fila[])
    .filter(ev => {
      const requiereConfra = ev.requiere_discernimiento_confra ?? false
      const requiereEqt = ev.requiere_discernimiento_eqt ?? false
      // discernimiento_confra = la confra ya discernió, le toca a EqT.
      // discernimiento_eqt = estado legacy, también turno de EqT.
      // pendiente_aprobacion_final = espera la aprobación final de EqT.
      if (
        ['discernimiento_confra', 'discernimiento_eqt', 'pendiente_aprobacion_final'].includes(ev.estado) &&
        canApproveEqt
      ) {
        return true
      }
      if (ev.estado === 'solicitud') {
        // Sin paso de confra, EqT actúa directo.
        if (!requiereConfra && requiereEqt && canApproveEqt) return true
        // La confra actúa sobre la solicitud de su organización.
        if (requiereConfra && canApproveConfra) {
          if (ctx.is_admin) return true
          return ev.organizacion?.id ? ctx.org_ids.includes(ev.organizacion.id) : false
        }
      }
      return false
    })
    .map(({ requiere_discernimiento_confra: _c, requiere_discernimiento_eqt: _e, ...ev }) => ev)
}

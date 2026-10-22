import type { UserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'
import { esCentralizadorDeEvento } from './cierre'

export type PensionEvento = {
  estado: string
  organizacion_id: string | null
  fraternidad_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

/** Estados del evento durante los cuales tiene sentido gestionar becas de pensión. */
export const ESTADOS_PENSION_VISIBLE = ['publicado', 'en_curso', 'finalizado'] as const

/**
 * Ver y editar becas de pensión: mismos roles que gestionan el pago de pensión
 * (Centralizador del evento, Responsable de Confraternidad, Enlace de Fraternidad,
 * Delegado del Equipo Timón vía is_admin). Mismo criterio que "Gestionar retiro"
 * (Becas vive en esa pantalla): event.manage scopeado + esCentralizadorDeEvento.
 */
export function canGestionarPension(ctx: UserContext | null, evento: PensionEvento): boolean {
  if (!ctx || !(ESTADOS_PENSION_VISIBLE as readonly string[]).includes(evento.estado)) return false
  return (
    canPerform(ctx, 'event.manage', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.manage', evento.fraternidad_id) : false) ||
    esCentralizadorDeEvento(ctx, evento)
  )
}

/** Valor de inscripción efectivo: override del participante o el precio general del evento. */
export function valorInscripcionEfectivo(valorParticipante: number | null, precioEvento: number | null): number {
  return valorParticipante ?? precioEvento ?? 0
}

/** Valor de pensión efectivo: override del participante o el precio general del evento. */
export function valorPensionEfectivo(valorParticipante: number | null, precioEvento: number | null): number {
  return valorParticipante ?? precioEvento ?? 0
}

/** Saldo de Pensión = Valor Pensión efectivo − Beca Pensión (no descuenta pagos ya realizados). */
export function calcularSaldoPension(valorPensionEfectivoVal: number, becaPension: number): number {
  return Math.max(0, valorPensionEfectivoVal - (becaPension || 0))
}

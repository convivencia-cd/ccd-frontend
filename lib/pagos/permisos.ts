import { canPerform, type UserContext } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'

type EventoPago = {
  organizacion_id: string | null
  fraternidad_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

/**
 * Registrar un pago a mano en un evento: payment.register en la org del
 * evento (o su fraternidad), o ser Centralizador del evento.
 */
export function puedeRegistrarPagoEnEvento(ctx: UserContext, evento: EventoPago): boolean {
  return (
    canPerform(ctx, 'payment.register', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'payment.register', evento.fraternidad_id) : false) ||
    esCentralizadorDeEvento(ctx, evento)
  )
}

/**
 * Mostrar el botón "Registrar Pago". La pantalla también genera links de
 * pensión por Mercado Pago (event.manage), así que se muestra a quien pueda
 * hacer cualquiera de las dos cosas; el servidor valida cada acción por evento.
 */
export function puedeAbrirRegistroDePagos(ctx: UserContext, esCentralizadorDeAlgunEvento: boolean): boolean {
  return (
    canPerform(ctx, 'payment.register') ||
    canPerform(ctx, 'event.manage') ||
    esCentralizadorDeAlgunEvento
  )
}

import type { UserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Bucket de Storage para las fotos del cierre (convivencia + servidores). */
export const CIERRE_BUCKET = 'eventos-cierre'

/** Porcentaje de Diezmo al Equipo Timón sobre el saldo positivo del evento. */
export const DIEZMO_PCT = 0.2

/** Subtipos de movimiento de ingreso. */
export const SUBTIPOS_INGRESO = [
  { value: 'pago', label: 'Pago (pensiones de conviventes)' },
  { value: 'otros_ingresos', label: 'Otros ingresos (bolsillo de Dios)' },
  { value: 'donacion', label: 'Donación' },
] as const

/**
 * Categorías predefinidas para movimientos de egreso.
 * TODO: confirmar el listado definitivo con el equipo.
 */
export const CATEGORIAS_EGRESO = [
  'Alojamiento / Casa',
  'Comida',
  'Enfermería',
  'Librería',
  'Limpieza',
  'Materiales / Manuales',
  'Transporte',
  'Varios',
] as const

/**
 * Roles operativos que integran el "Equipo de Servidores" (para el informe de
 * carismas): todo el Equipo del Evento menos los conviventes.
 */
export const ROLES_SERVIDORES = [
  'coordinador',
  'asesor',
  'centralizador',
  'musica',
  'servidor',
  'equipo_auxiliar',
] as const

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PreguntaInforme = { id: string; texto: string }

export type Movimiento = {
  id: string
  evento_id: string
  tipo: 'ingreso' | 'egreso'
  subtipo_ingreso: string | null
  categoria_egreso: string | null
  pago_id: string | null
  concepto: string | null
  monto: number
  fecha: string | null
  notas: string | null
  created_at: string
}

/** Formatea un monto con separador de miles (sin símbolo de moneda fijo). */
export function formatMonto(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

// ─── Cálculo económico ────────────────────────────────────────────────────────

export function calcularResumenEconomico(movimientos: Pick<Movimiento, 'tipo' | 'monto'>[]) {
  const ingresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const egresos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const saldo = ingresos - egresos
  const diezmo = saldo > 0 ? saldo * DIEZMO_PCT : 0
  return { ingresos, egresos, saldo, diezmo }
}

// ─── Autorización del cierre ──────────────────────────────────────────────────

type CierreEvento = {
  estado: string
  organizacion_id: string | null
  fraternidad_id: string | null
  coordinador_asignado_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

/** El usuario es el coordinador asignado del evento. */
export function esCoordinador(ctx: UserContext | null, evento: CierreEvento): boolean {
  return !!ctx?.persona_id && ctx.persona_id === evento.coordinador_asignado_id
}

/**
 * El usuario es uno de los (hasta 3) centralizadores asignados al evento.
 * "Centralizador" es un rol scoped a evento (no a organización), por eso no
 * llega a `ctx.org_ids`/`canPerform` — se resuelve comparando persona_id
 * directamente contra las columnas centralizador_X_persona_id de eventos,
 * igual que ya hacen `eventos/centralizador/page.tsx` y `dashboard/page.tsx`.
 */
export function esCentralizadorDeEvento(
  ctx: UserContext | null,
  evento: Pick<CierreEvento, 'centralizador_1_persona_id' | 'centralizador_2_persona_id' | 'centralizador_3_persona_id'>
): boolean {
  if (!ctx?.persona_id) return false
  return (
    ctx.persona_id === evento.centralizador_1_persona_id ||
    ctx.persona_id === evento.centralizador_2_persona_id ||
    ctx.persona_id === evento.centralizador_3_persona_id
  )
}

/**
 * Puede editar los datos del cierre (materiales, económico, fotos).
 * Solo mientras el evento está 'finalizado' (una vez 'cerrado' queda bloqueado).
 */
export function canEditarCierre(ctx: UserContext | null, evento: CierreEvento): boolean {
  if (!ctx || evento.estado !== 'finalizado') return false
  return (
    esCoordinador(ctx, evento) ||
    esCentralizadorDeEvento(ctx, evento) ||
    canPerform(ctx, 'event.update', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false)
  )
}

/**
 * Puede ver/editar los informes confidenciales (Coordinador + Carismas, puntos 6 y 7).
 * Solo: coordinador del evento, Equipo Timón, responsables de confraternidad,
 * enlaces de fraternidad y delegado EqT (todos con event.approve_confra scopeado o approve_eqt).
 */
export function canVerInformesConfidenciales(ctx: UserContext | null, evento: CierreEvento): boolean {
  if (!ctx) return false
  return (
    esCoordinador(ctx, evento) ||
    canPerform(ctx, 'event.approve_eqt') ||
    canPerform(ctx, 'event.approve_confra', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.approve_confra', evento.fraternidad_id) : false)
  )
}

/** Solo Equipo Timón puede cerrar la convivencia (finalizado → cerrado). */
export function canCerrarConvivencia(ctx: UserContext | null, evento: CierreEvento): boolean {
  if (!ctx || evento.estado !== 'finalizado') return false
  return canPerform(ctx, 'event.approve_eqt')
}

/** El panel de cierre es visible en finalizado o cerrado, a quien tenga alguna capacidad sobre él. */
export function canVerCierre(ctx: UserContext | null, evento: CierreEvento): boolean {
  if (!ctx) return false
  if (evento.estado !== 'finalizado' && evento.estado !== 'cerrado') return false
  return (
    esCoordinador(ctx, evento) ||
    esCentralizadorDeEvento(ctx, evento) ||
    canVerInformesConfidenciales(ctx, evento) ||
    canPerform(ctx, 'event.update', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false)
  )
}

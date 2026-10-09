import type { UserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'
import { esCentralizadorDeEvento, DIEZMO_PCT, formatMonto } from './cierre'

export { DIEZMO_PCT, formatMonto }

// Informe Económico por evento — réplica del Excel "Base para IE" (hojas
// Registro + Informe Economico): tres libros (Caja, Banco, MP) con saldo
// inicial y asientos; el informe suma por concepto los tres medios.

// ─── Constantes ───────────────────────────────────────────────────────────────

export const MEDIOS = [
  { value: 'caja', label: 'Caja (efectivo)', corto: 'Caja' },
  { value: 'banco', label: 'Banco / Transferencia', corto: 'Banco' },
  { value: 'mp', label: 'Mercado Pago', corto: 'MP' },
] as const

export type Medio = (typeof MEDIOS)[number]['value']

/** Vista del registro: un libro puntual o "todos" (los tres medios juntos). */
export type VistaLibro = Medio | 'todos'

/** Conceptos de ingreso (en el orden de la hoja Informe Economico). */
export const CATEGORIAS_INGRESO = [
  'Anticipos',
  'Aportes del Bolsillo de Dios',
  'Pensiones',
  'Colecta',
  'Donaciones',
  'Inscripciones',
  'Otros Ingresos',
] as const

/** Conceptos de egreso (en el orden de la hoja Informe Economico). */
export const CATEGORIAS_EGRESO = [
  'Alimentos',
  'Artículos de Limpieza',
  'Devolución de Anticipos',
  'Estadías - Casa de Retiro',
  'Estipendio',
  'Inscripciones',
  'Librería',
  'Liturgia',
  'Movilidad y Viáticos',
  'Otros Gastos',
  'Pensiones',
  'Señas y Anticipos',
] as const

export function categoriasDe(tipo: 'ingreso' | 'egreso'): readonly string[] {
  return tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO
}

/** Estados en los que se pueden cargar movimientos (desde aprobado hasta el cierre). */
export const ESTADOS_IE_EDITABLE = [
  'aprobado',
  'pendiente_aprobacion_final',
  'publicado',
  'suspendido',
  'en_curso',
  'finalizado',
] as const

/** Estados en los que el informe es visible (los editables + cerrado, solo lectura). */
export const ESTADOS_IE_VISIBLE = [...ESTADOS_IE_EDITABLE, 'cerrado'] as const

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Movimiento = {
  id: string
  evento_id: string
  tipo: 'ingreso' | 'egreso'
  medio: Medio
  categoria: string
  pago_id: string | null
  /** Descripción libre del asiento. */
  concepto: string | null
  monto: number
  fecha: string | null
  notas: string | null
  comprobante_path: string | null
  comprobante_nombre: string | null
  anulado_at: string | null
  motivo_anulacion: string | null
  created_at: string
}

export type SaldosIniciales = Record<Medio, number>

export type BecaOtorgada = { nombre: string; importe: number }

// ─── Cálculos (ignoran movimientos anulados) ──────────────────────────────────

function vigentes<T extends { anulado_at?: string | null }>(movs: T[]): T[] {
  return movs.filter(m => !m.anulado_at)
}

/** Totales del informe. El saldo inicial no cuenta como ingreso (igual que el Excel). */
export function calcularResumenEconomico(movimientos: Pick<Movimiento, 'tipo' | 'monto' | 'anulado_at'>[]) {
  const movs = vigentes(movimientos)
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const egresos = movs.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const saldo = ingresos - egresos
  const diezmo = saldo > 0 ? saldo * DIEZMO_PCT : 0
  return { ingresos, egresos, saldo, diezmo }
}

function ordenarAsientos(a: Movimiento, b: Movimiento): number {
  const fa = a.fecha ?? ''
  const fb = b.fecha ?? ''
  if (fa !== fb) return fa < fb ? -1 : 1
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

export type AsientoLibro = Movimiento & { saldo: number | null }

/**
 * Libro de un medio (o de los tres juntos con 'todos'): asientos ordenados por
 * fecha con saldo acumulado (columna Saldo del Excel). Los anulados se listan
 * pero no mueven el saldo (saldo = null).
 */
export function libroDeMedio(movimientos: Movimiento[], medio: VistaLibro, saldoInicial: number) {
  let saldo = Number(saldoInicial || 0)
  const asientos: AsientoLibro[] = movimientos
    .filter(m => medio === 'todos' || m.medio === medio)
    .sort(ordenarAsientos)
    .map(m => {
      if (m.anulado_at) return { ...m, saldo: null }
      saldo += m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)
      return { ...m, saldo }
    })
  return { saldoInicial: Number(saldoInicial || 0), asientos, saldoFinal: saldo }
}

/** Saldo actual de cada medio (saldo inicial + ingresos − egresos). */
export function saldosPorMedio(movimientos: Movimiento[], iniciales: SaldosIniciales): SaldosIniciales {
  const out = { ...iniciales }
  for (const m of MEDIOS) out[m.value] = libroDeMedio(movimientos, m.value, iniciales[m.value]).saldoFinal
  return out
}

/** Totales por concepto sumando los tres medios (hoja Informe Economico). Incluye conceptos en 0. */
export function resumenPorCategoria(movimientos: Pick<Movimiento, 'tipo' | 'categoria' | 'monto' | 'anulado_at'>[]) {
  const ingresos = new Map<string, number>(CATEGORIAS_INGRESO.map(c => [c, 0]))
  const egresos = new Map<string, number>(CATEGORIAS_EGRESO.map(c => [c, 0]))
  for (const m of vigentes(movimientos)) {
    const target = m.tipo === 'ingreso' ? ingresos : egresos
    target.set(m.categoria, (target.get(m.categoria) ?? 0) + Number(m.monto || 0))
  }
  return {
    ingresos: [...ingresos.entries()].map(([categoria, total]) => ({ categoria, total })),
    egresos: [...egresos.entries()].map(([categoria, total]) => ({ categoria, total })),
  }
}

// ─── Autorización ─────────────────────────────────────────────────────────────

export type InformeEconomicoEvento = {
  estado: string
  organizacion_id: string | null
  fraternidad_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

function tienePermisoScoped(
  ctx: UserContext,
  permiso: 'informe_economico.edit' | 'informe_economico.view' | 'event.approve_confra',
  evento: InformeEconomicoEvento,
): boolean {
  return (
    canPerform(ctx, permiso, evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, permiso, evento.fraternidad_id) : false)
  )
}

/** Es quien carga el informe: Centralizador del evento o Tesorero (informe_economico.edit scopeado). */
function esCargadorDelInforme(ctx: UserContext, evento: InformeEconomicoEvento): boolean {
  return esCentralizadorDeEvento(ctx, evento) || tienePermisoScoped(ctx, 'informe_economico.edit', evento)
}

/** Puede cargar/editar/anular movimientos. Bloqueado fuera de ESTADOS_IE_EDITABLE (p. ej. cerrado). */
export function canEditarInformeEconomico(ctx: UserContext | null, evento: InformeEconomicoEvento): boolean {
  if (!ctx || !(ESTADOS_IE_EDITABLE as readonly string[]).includes(evento.estado)) return false
  return esCargadorDelInforme(ctx, evento)
}

/**
 * Puede ver el informe (solo lectura): quienes lo cargan, Equipo Timón,
 * Responsables/Enlaces de la organización (approve_confra) y quien tenga
 * informe_economico.view scopeado.
 */
export function canVerInformeEconomico(ctx: UserContext | null, evento: InformeEconomicoEvento): boolean {
  if (!ctx || !(ESTADOS_IE_VISIBLE as readonly string[]).includes(evento.estado)) return false
  return (
    esCargadorDelInforme(ctx, evento) ||
    canPerform(ctx, 'event.approve_eqt') ||
    tienePermisoScoped(ctx, 'event.approve_confra', evento) ||
    tienePermisoScoped(ctx, 'informe_economico.view', evento)
  )
}

// ─── Datos de cabecera (hoja "Datos" del Excel) ───────────────────────────────

export type InformeEconomicoInfo = {
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  lugar: string | null
  confraternidad: string | null
  fraternidad: string | null
  centralizadores: string[]
  asistentes: number
  servidores: number
  auxiliares: number
  valor_inscripcion: number | null
}

export type InformeEconomicoData = {
  info: InformeEconomicoInfo
  movimientos: Movimiento[]
  saldosIniciales: SaldosIniciales
  becas: BecaOtorgada[]
  observaciones: string | null
}

export function nombreArchivoInforme(nombreEvento: string, ext: 'pdf' | 'xlsx'): string {
  const base = (nombreEvento || 'evento').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return `${base}-informe-economico.${ext}`
}

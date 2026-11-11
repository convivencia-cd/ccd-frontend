// Tipos y utilidades de fechas del Calendario de Retiros. Sin dependencias de
// servidor: lo usan tanto el loader (lib/eventos/calendario.ts) como el
// componente cliente (components/calendario/).
//
// Todas las fechas se manejan como strings 'YYYY-MM-DD' (columnas DATE de
// Postgres) y se operan en UTC para que la zona horaria del navegador nunca
// corra un día.

export type RolCalendario = {
  /** rol_en_evento, o 'solicitante' para quien pidió el retiro. */
  rol: string
  label: string
  /** Estado de la participación del convivente (Interesado, Inscripto...). */
  detalle?: string | null
}

export type CalendarioEvento = {
  id: string
  nombre: string
  tipo: string
  tipoEventoNombre: string | null
  estado: string
  fechaInicio: string
  fechaFin: string
  /** Tramos de evento_fechas; si no hay, un único tramo con las fechas principales. */
  tramos: { inicio: string; fin: string }[]
  lugar: string | null
  confraternidad: { id: string; nombre: string } | null
  fraternidad: { id: string; nombre: string } | null
  coordinador: string | null
  misRoles: RolCalendario[]
  /** Todavía en el circuito de aprobación (solo lo ven quienes tienen event.view_all_estados o un rol propio). */
  enTramite: boolean
  href: string | null
}

export const TIPO_LABEL: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro corto',
  taller: 'Taller',
  encuentro: 'Encuentro',
}

export const ESTADO_LABEL: Record<string, string> = {
  solicitud: 'Pend. Disc. Confra',
  discernimiento_confra: 'Pend. Disc. EqT',
  discernimiento_eqt: 'Disc. EqT',
  pendiente_datos_noticias: 'Pend. Datos Noticias',
  pendiente_aprobacion_final: 'Pend. Aprobación Final',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  en_curso: 'En Curso',
  finalizado: 'Finalizado',
  cerrado: 'Cerrado',
  suspendido: 'Suspendido',
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000

export function isoToUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function utcToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDias(iso: string, dias: number): string {
  return utcToIso(isoToUtc(iso) + dias * DIA_MS)
}

export function diffDias(desde: string, hasta: string): number {
  return Math.round((isoToUtc(hasta) - isoToUtc(desde)) / DIA_MS)
}

/** 'YYYY-MM' → 'YYYY-MM' desplazado n meses. */
export function addMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export function primerDiaDelMes(mes: string): string {
  return `${mes}-01`
}

export function ultimoDiaDelMes(mes: string): string {
  return addDias(primerDiaDelMes(addMeses(mes, 1)), -1)
}

/** 0 = lunes … 6 = domingo. La semana arranca el lunes para que los retiros de fin de semana no se partan. */
export function diaSemanaLunes(iso: string): number {
  return (new Date(isoToUtc(iso)).getUTCDay() + 6) % 7
}

export function esMesValido(mes: string | undefined | null): mes is string {
  return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}

/** Hoy en Argentina, como 'YYYY-MM-DD' (el servidor corre en UTC). */
export function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const fmtMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtDiaLargo = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const fmtDiaCorto = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

function capitalizar(s: string) {
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1)
}

export function nombreMes(mes: string): string {
  return capitalizar(fmtMes.format(new Date(isoToUtc(primerDiaDelMes(mes)))))
}

export function fechaLarga(iso: string): string {
  return capitalizar(fmtDiaLargo.format(new Date(isoToUtc(iso))))
}

export function fechaCorta(iso: string): string {
  return fmtDiaCorto.format(new Date(isoToUtc(iso))).replace(/[.,]/g, '')
}

/** "Vie 14 nov – dom 16 nov" o un solo día. */
export function rangoCorto(inicio: string, fin: string): string {
  return inicio === fin ? fechaCorta(inicio) : `${fechaCorta(inicio)} – ${fechaCorta(fin)}`
}

export function solapa(evInicio: string, evFin: string, desde: string, hasta: string): boolean {
  return evInicio <= hasta && evFin >= desde
}

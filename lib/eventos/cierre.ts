import type { UserContext } from "@/lib/auth/context"
import { canPerform } from "@/lib/auth/permissions"

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Bucket de Storage (público) para las fotos del cierre. */
export const CIERRE_BUCKET = "eventos-cierre"

/** Fotos mínimas para poder cerrar la convivencia (tarjeta #44). */
export const MIN_FOTOS_CIERRE = 3

/** Tamaño máximo por foto del cierre. */
export const MAX_FOTO_CIERRE_BYTES = 10 * 1024 * 1024

export const FOTO_CIERRE_MIME = ["image/jpeg", "image/png", "image/webp"] as const

/** Porcentaje de Diezmo al Equipo Timón sobre el saldo positivo del evento (ver lib/eventos/informe-economico.ts). */
export const DIEZMO_PCT = 0.2

/** Subtipos de movimiento de ingreso. */
export const SUBTIPOS_INGRESO = [
  { value: "pago", label: "Pago (pensiones de conviventes)" },
  { value: "otros_ingresos", label: "Otros ingresos (bolsillo de Dios)" },
  { value: "donacion", label: "Donación" },
] as const

/**
 * Categorías predefinidas para movimientos de egreso.
 * TODO: confirmar el listado definitivo con el equipo.
 */
export const CATEGORIAS_EGRESO = [
  "Alojamiento / Casa",
  "Comida",
  "Enfermería",
  "Librería",
  "Limpieza",
  "Materiales / Manuales",
  "Transporte",
  "Varios",
] as const

/**
 * Roles operativos que integran el "Equipo de Servidores" (para el informe de
 * carismas): todo el Equipo del Evento menos los conviventes.
 */
export const ROLES_SERVIDORES = [
  "coordinador",
  "asesor",
  "centralizador",
  "musica",
  "servidor",
  "equipo_auxiliar",
] as const

/**
 * Roles que se evalúan en la "Planilla de Carismas de Servidores", en el orden
 * de la planilla: servidores, asesor y coordinador.
 */
export const ROLES_CARISMAS = ["servidor", "asesor", "coordinador"] as const

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PreguntaInforme = { id: string; texto: string }

/** Formatea un monto con separador de miles (sin símbolo de moneda fijo). */
export function formatMonto(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)
}

// ─── Cálculo económico ────────────────────────────────────────────────────────

export function calcularResumenEconomico(
  movimientos: Pick<Movimiento, "tipo" | "monto">[],
) {
  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const egresos = movimientos
    .filter((m) => m.tipo === "egreso")
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
export function esCoordinador(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
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
  evento: Pick<
    CierreEvento,
    | "centralizador_1_persona_id"
    | "centralizador_2_persona_id"
    | "centralizador_3_persona_id"
  >,
): boolean {
  if (!ctx?.persona_id) return false
  return (
    ctx.persona_id === evento.centralizador_1_persona_id ||
    ctx.persona_id === evento.centralizador_2_persona_id ||
    ctx.persona_id === evento.centralizador_3_persona_id
  )
}

/**
 * Puede editar los datos del cierre (materiales, fotos). El informe económico
 * tiene sus propios permisos (lib/eventos/informe-economico.ts).
 * Solo mientras el evento está 'finalizado' (una vez 'cerrado' queda bloqueado).
 */
export function canEditarCierre(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx || evento.estado !== "finalizado") return false
  return (
    esCoordinador(ctx, evento) ||
    esCentralizadorDeEvento(ctx, evento) ||
    canPerform(ctx, "event.update", evento.organizacion_id) ||
    (evento.fraternidad_id
      ? canPerform(ctx, "event.update", evento.fraternidad_id)
      : false)
  )
}

type PermisoCierre =
  | "cierre.view_carismas"
  | "cierre.view_informe_responsables"
  | "cierre.view_informe_eqt"
  | "cierre.upload_fotos"

function tienePermisoCierre(
  ctx: UserContext,
  permiso: PermisoCierre,
  evento: CierreEvento,
): boolean {
  return (
    canPerform(ctx, permiso, evento.organizacion_id) ||
    (evento.fraternidad_id
      ? canPerform(ctx, permiso, evento.fraternidad_id)
      : false)
  )
}

/**
 * Puede ver el Informe de Carismas: el coordinador del evento (lo completa) y
 * quien tenga cierre.view_carismas scopeado (asignable desde el catálogo).
 */
export function canVerCarismas(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx) return false
  return (
    esCoordinador(ctx, evento) ||
    tienePermisoCierre(ctx, "cierre.view_carismas", evento)
  )
}

/**
 * Puede ver el "Informe de la CcD (para Equipo Timón)": el coordinador del
 * evento (lo completa) y quien tenga cierre.view_informe_eqt scopeado.
 * El informe para Responsables (cierre.view_informe_responsables) todavía no existe.
 */
export function canVerInformeEqt(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx) return false
  return (
    esCoordinador(ctx, evento) ||
    tienePermisoCierre(ctx, "cierre.view_informe_eqt", evento)
  )
}

/**
 * Completa los informes confidenciales (para Equipo Timón + Carismas): solo el
 * coordinador del evento (y el admin técnico como respaldo), mientras está 'finalizado'.
 */
export function canEditarInformesConfidenciales(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx || evento.estado !== "finalizado") return false
  return esCoordinador(ctx, evento) || ctx.is_admin
}

/**
 * Sube/quita fotos del cierre: el centralizador del evento o quien tenga
 * cierre.upload_fotos scopeado. Solo mientras el evento está 'finalizado'.
 */
export function canSubirFotosCierre(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx || evento.estado !== "finalizado") return false
  return (
    esCentralizadorDeEvento(ctx, evento) ||
    tienePermisoCierre(ctx, "cierre.upload_fotos", evento)
  )
}

/** Solo Equipo Timón puede cerrar la convivencia (finalizado → cerrado). */
export function canCerrarConvivencia(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx || evento.estado !== "finalizado") return false
  return canPerform(ctx, "event.approve_eqt")
}

/** El panel de cierre es visible en finalizado o cerrado, a quien tenga alguna capacidad sobre él. */
export function canVerCierre(
  ctx: UserContext | null,
  evento: CierreEvento,
): boolean {
  if (!ctx) return false
  if (evento.estado !== "finalizado" && evento.estado !== "cerrado")
    return false
  return (
    esCoordinador(ctx, evento) ||
    esCentralizadorDeEvento(ctx, evento) ||
    canVerCarismas(ctx, evento) ||
    canVerInformeEqt(ctx, evento) ||
    canSubirFotosCierre(ctx, evento) ||
    // Quien cierra la convivencia (canCerrarConvivencia) tiene que ver el panel.
    canPerform(ctx, "event.approve_eqt") ||
    canPerform(ctx, "event.update", evento.organizacion_id) ||
    (evento.fraternidad_id
      ? canPerform(ctx, "event.update", evento.fraternidad_id)
      : false)
  )
}

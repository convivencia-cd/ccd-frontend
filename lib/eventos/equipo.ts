import type { UserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'
import { esCentralizadorDeEvento } from './cierre'

// ─── Catálogos de la UI ───────────────────────────────────────────────────────

/** Las 3 áreas en las que se divide el Equipo del Evento (minuta #138). */
export const AREAS_EQUIPO = [
  { value: 'centralizadores', label: 'Centralizadores' },
  { value: 'servidores', label: 'Servidores' },
  { value: 'auxiliar', label: 'Equipo Auxiliar (Cocina)' },
] as const

export type AreaEquipo = (typeof AREAS_EQUIPO)[number]['value']

/** Roles operativos de servidor dentro de un evento (evento_participantes.rol_en_evento). */
export const ROLES_SERVIDOR_OPCIONES = [
  { value: 'coordinador', label: 'Coordinador', area: 'servidores' },
  { value: 'asesor', label: 'Asesor', area: 'servidores' },
  { value: 'musica', label: 'Ministerio de Música', area: 'servidores' },
  { value: 'servidor', label: 'Servidor (a cargo de grupo)', area: 'servidores' },
  { value: 'centralizador', label: 'Centralizador', area: 'centralizadores' },
  { value: 'equipo_auxiliar', label: 'Equipo Auxiliar (Cocina)', area: 'auxiliar' },
] as const satisfies readonly { value: string; label: string; area: AreaEquipo }[]

/**
 * El check de la tabla no tiene un rol por cada función concreta, así que las
 * del área de cocina (cocinero, enfermería, librería...) se cargan bajo
 * "Equipo Auxiliar" y se detallan en `notas`.
 */
export const ROLES_EVENTO_LABEL: Record<string, string> = {
  convivente: 'Convivente',
  coordinador: 'Coordinador',
  asesor: 'Asesor',
  centralizador: 'Centralizador',
  musica: 'Ministerio de Música',
  servidor: 'Servidor',
  equipo_auxiliar: 'Equipo Auxiliar',
}

/** Tope de integrantes del Ministerio de Música por evento (minuta #138). */
export const MAX_MINISTERIO_MUSICA = 2

/** Estados del ciclo de vida de participación (evento_participantes.estado_participacion). */
export const ESTADOS_PARTICIPACION_OPCIONES = [
  { value: 'interesado', label: 'Interesado' },
  { value: 'inscripto', label: 'Inscripto' },
  { value: 'en_curso', label: 'Convivente' },
  { value: 'completado', label: 'Completado' },
  { value: 'lista_espera', label: 'Lista de espera' },
  { value: 'cancelado', label: 'Cancelado' },
] as const

export const ESTADOS_PARTICIPACION = ESTADOS_PARTICIPACION_OPCIONES.map(e => e.value) as string[]
export const ROLES_EVENTO = Object.keys(ROLES_EVENTO_LABEL)

// ─── Autorización ─────────────────────────────────────────────────────────────

export type EventoEquipoScope = {
  organizacion_id: string | null
  fraternidad_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

/**
 * Puede reasignar las personas que el evento guarda en columnas propias:
 * coordinador y asesor asignados por EqT, y los (hasta 3) centralizadores.
 * Mismo criterio que "Editar evento": event.update sobre la confraternidad
 * del evento o sobre su fraternidad. El centralizador NO entra acá: no puede
 * designar ni reemplazar centralizadores.
 */
export function canGestionarAsignaciones(ctx: UserContext | null, evento: EventoEquipoScope): boolean {
  if (!ctx) return false
  return (
    canPerform(ctx, 'event.update', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false)
  )
}

function tienePermisoEnEvento(
  ctx: UserContext,
  permiso: 'event.manage' | 'event.attendance',
  evento: EventoEquipoScope,
): boolean {
  return (
    canPerform(ctx, permiso, evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, permiso, evento.fraternidad_id) : false)
  )
}

/**
 * Botón "Gestionar retiro" y pantalla /eventos/[id]/gestion (card #88).
 * Permiso propio, separado de "Editar" (event.update), para que el EqT lo
 * asigne por rol desde el catálogo (p. ej. al Coordinador). El centralizador
 * del evento entra siempre: es quien lo opera en el terreno.
 */
export function canGestionarEvento(ctx: UserContext | null, evento: EventoEquipoScope): boolean {
  if (!ctx) return false
  return tienePermisoEnEvento(ctx, 'event.manage', evento) || esCentralizadorDeEvento(ctx, evento)
}

/**
 * Botón "Tomar asistencia", su pantalla y la API de check-in (card #88).
 * Separado de "Editar" y de "Gestionar" para poder darle a alguien solo esto.
 */
export function canTomarAsistencia(ctx: UserContext | null, evento: EventoEquipoScope): boolean {
  if (!ctx) return false
  return tienePermisoEnEvento(ctx, 'event.attendance', evento) || esCentralizadorDeEvento(ctx, evento)
}

/**
 * Puede agregar, reubicar y dar de baja participantes del evento (inscriptos y
 * equipo de servidores). Además de quien tenga event.manage_participants
 * scopeado, lo puede hacer el centralizador del evento: es el rol operativo que
 * lleva el padrón de inscriptos mientras el evento está en curso.
 */
/**
 * Ver (solo lectura) el equipo cargado del retiro en su ficha (card #99): quien
 * tenga event.view_equipo scopeado a la organización del evento, o quien ya
 * entra a la Gestión (ahí lo ve igual).
 */
export function canVerEquipoRetiro(ctx: UserContext | null, evento: EventoEquipoScope): boolean {
  if (!ctx) return false
  return (
    canPerform(ctx, 'event.view_equipo', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.view_equipo', evento.fraternidad_id) : false) ||
    canGestionarEvento(ctx, evento)
  )
}

export function canGestionarParticipantes(ctx: UserContext | null, evento: EventoEquipoScope): boolean {
  if (!ctx) return false
  return (
    canPerform(ctx, 'event.manage_participants', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.manage_participants', evento.fraternidad_id) : false) ||
    esCentralizadorDeEvento(ctx, evento)
  )
}

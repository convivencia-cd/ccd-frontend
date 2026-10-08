import type { UserContext } from './context'

// ─── Roles del sistema (deben coincidir con roles_sistema.nombre en DB) ───────

export type SystemRole =
  | 'admin_general'
  | 'tecnico_confraternidad'
  | 'responsable_fraternidad'
  | 'usuario_carga'
  | 'solo_lectura'

// ─── Permisos técnicos ────────────────────────────────────────────────────────

export type Permission =
  | 'person.create'
  | 'person.update'
  | 'person.delete'       // soft delete — solo admin
  | 'person.merge'        // fusión de duplicados — solo admin
  | 'person.edit_socio_activo' // tildar "Socio Activo de la Asociación Civil" en el propio perfil — ministerios de conducción/tesorería
  | 'votos.edit'          // editar votos de Dedicados (Referente/Responsable) — global
  | 'votos.list'          // ver listado consolidado de votos (Animadores) — solo lectura
  | 'personas.export'      // exportar listado de personas a Excel / detalle a PDF
  | 'event.create'
  | 'event.approve'       // aprobar eventos directamente (sin discernimiento) — solo admin
  | 'event.approve_confra' // aprobar en discernimiento confra (tecnico_confraternidad, responsable_fraternidad)
  | 'event.approve_eqt'  // aprobar en discernimiento equipo timón (admin_general)
  | 'event.publish'       // publicar eventos aprobados (aprobado → publicado)
  | 'event.suspend'       // suspender eventos en cualquier instancia — solo Equipo Timón
  | 'event.request_suspend' // solicitar la suspensión de un evento (enlaces/responsables/delegados) — asignable
  | 'event.update'
  | 'event.manage_participants'
  | 'inscripcion.view_datos_sensibles' // ver dieta y observaciones de salud de los inscriptos — scopeado a la org del evento
  | 'payment.verify'      // verificar/aprobar/rechazar pagos por transferencia — scopeado a la org del evento
  | 'informe_economico.edit' // cargar movimientos del Informe Económico del evento (Tesoreros) — scopeado a la org del evento
  | 'informe_economico.view' // ver (solo lectura) el Informe Económico del evento — scopeado a la org del evento
  | 'cierre.view_carismas'             // ver el Informe de Carismas del cierre — scopeado a la org del evento
  | 'cierre.view_informe_responsables' // ver el informe de cierre para Responsables / Delegados EqT — scopeado
  | 'cierre.view_informe_eqt'          // ver el informe de cierre para Equipo Timón — scopeado
  | 'cierre.upload_fotos'              // subir/quitar fotos del cierre — scopeado (el centralizador del evento no lo necesita)
  | 'organization.create' // solo admin
  | 'organization.update'
  | 'organizaciones.export' // exportar listado de organizaciones a Excel
  | 'organizaciones.view_ficha'         // ver la ficha completa (código, tipo, ubicación, contacto, notas) y el listado completo con filtros
  | 'organizaciones.view_roles_detalle'  // ver columnas administrativas del bloque Roles (evento, estado, fechas)
  | 'ministry.assign'
  | 'roles.assign'        // asignar roles de sistema — solo admin
  | 'roles.view'          // ver sección ministerios y roles
  | 'tipos_eventos.create'
  | 'tipos_eventos.update'
  | 'tipos_eventos.delete'
  | 'view.all'
  | 'view.personas'            // ver sección de personas
  | 'view.organizaciones'      // ver sección de organizaciones
  | 'view.eventos'             // ver sección de eventos
  | 'view.eventos_publicados'  // ver página de eventos publicados (panel comunitario)
  | 'view.casas_retiro'        // ver sección de casas de retiro (fuera de la vista ordinaria)
  | 'event.view_aprobados'     // ver los eventos aprobados (aprobado ≠ publicado: todavía no son públicos)
  | 'event.view_all_estados'   // ver el listado de eventos en cualquier estado (no solo publicado/en_curso/finalizado)
  | 'view.interesados'         // ver la sección Interesados dentro de Eventos, scopeado a la propia organización

// ─── Mapa de permisos por rol ─────────────────────────────────────────────────
//
// IMPORTANTE: Los roles funcionales (coordinador, asesor, centralizador, etc.)
// viven en evento_participantes.rol_en_evento y NO deben mezclarse con esto.
// Solo los roles tipo = sistema controlan acceso técnico.

export const rolePermissions: Record<SystemRole, Permission[]> = {
  admin_general: [
    'person.create',
    'person.update',
    'person.delete',
    'person.merge',
    'person.edit_socio_activo',
    'votos.edit',
    'votos.list',
    'personas.export',
    'event.create',
    'event.approve',
    'event.approve_confra',
    'event.approve_eqt',
    'event.publish',
    'event.suspend',
    'event.request_suspend',
    'event.update',
    'event.manage_participants',
    'inscripcion.view_datos_sensibles',
    'payment.verify',
    'informe_economico.edit',
    'informe_economico.view',
    'cierre.view_carismas',
    'cierre.view_informe_responsables',
    'cierre.view_informe_eqt',
    'cierre.upload_fotos',
    'organization.create',
    'organization.update',
    'organizaciones.export',
    'organizaciones.view_ficha',
    'organizaciones.view_roles_detalle',
    'ministry.assign',
    'roles.assign',
    'view.all',
    'view.personas',
    'view.organizaciones',
    'view.eventos',
    'view.eventos_publicados',
    'view.casas_retiro',
    'event.view_aprobados',
    'event.view_all_estados',
    'view.interesados',
  ],

  tecnico_confraternidad: [
    'person.create',
    'person.update',
    'event.create',
    'event.approve_confra',
    'event.update',
    'event.manage_participants',
    'payment.verify',
    'organization.update',
    'organizaciones.view_ficha',
    'organizaciones.view_roles_detalle',
    'ministry.assign',
    'roles.view',
    'view.all',
    'view.personas',
    'view.organizaciones',
    'view.eventos',
  ],

  responsable_fraternidad: [
    'person.create',
    'person.update',
    'event.create',
    'event.approve_confra',
    'event.update',
    'event.manage_participants',
    'payment.verify',
    'roles.view',
    'view.all',
    'view.personas',
    'view.organizaciones',
    'view.eventos',
  ],

  usuario_carga: [
    'person.create',
    'person.update',
    'event.create',    // estado forzado a 'borrador' en el servidor
    'event.update',
    'event.manage_participants',
    'view.all',
    'view.personas',
    'view.organizaciones',
    'view.eventos',
  ],

  solo_lectura: [
    'view.all',
    'view.personas',
    'view.organizaciones',
    'view.eventos',
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verifica si alguno de los roles dados tiene el permiso requerido.
 * Uso puro (sin contexto de usuario), útil para tests unitarios.
 */
export function hasPermission(roles: SystemRole[], permission: Permission): boolean {
  return roles.some(role => rolePermissions[role]?.includes(permission))
}

/**
 * Verifica si el usuario puede realizar una acción, considerando:
 * 1. Si tiene el permiso en alguno de sus roles
 * 2. Si la acción es sobre una organización específica, si tiene scope sobre ella
 *
 * @param ctx       Contexto del usuario (de getUserContext())
 * @param permission Permiso requerido
 * @param organizacion_id  Organización sobre la que se opera (null = acción global)
 */
export function canPerform(
  ctx: UserContext,
  permission: Permission,
  organizacion_id?: string | null
): boolean {
  // admin_general puede todo, siempre
  if (ctx.is_admin) return true

  // DB-first: usar permisos cargados desde rol_permisos si están disponibles.
  // Fallback al mapa hardcodeado si aún no hay datos en DB (durante migración).
  const hasPerm = ctx.db_permissions.length > 0
    ? ctx.db_permissions.includes(permission)
    : hasPermission(ctx.roles.map(r => r.rol) as SystemRole[], permission)

  if (!hasPerm) return false

  // Si no hay org específica, el permiso aplica globalmente
  if (!organizacion_id) return true

  // Para acciones con scope: verificar que tenga la org asignada
  return ctx.org_ids.includes(organizacion_id)
}

/**
 * Para event.create con usuario_carga: el estado debe forzarse a 'borrador'.
 * Llama esto en el servidor antes de insertar.
 */
export function enforceEventoEstado(ctx: UserContext, estado: string): string {
  if (ctx.is_admin || ctx.nivel_max >= 80) return estado
  return 'borrador'
}

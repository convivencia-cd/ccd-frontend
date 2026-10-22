-- ============================================================
-- MIGRACIÓN 095: Permisos event.manage y event.attendance
--
-- Contexto (card #88): en el detalle del evento, los botones
-- "Editar", "Gestionar retiro" y "Tomar asistencia" dependían todos
-- del mismo permiso event.update ("Editar eventos"). Se separan para
-- poder asignarlos por rol desde el catálogo (p. ej. darle al
-- Coordinador Gestionar + Asistencia sin Editar, o a alguien solo
-- Tomar asistencia):
--
--   Editar            → event.update      (sin cambios)
--   Gestionar retiro  → event.manage      (nuevo; incluye Becas en Pensión)
--   Tomar asistencia  → event.attendance  (nuevo)
--
-- El centralizador del evento sigue entrando a Gestionar y Asistencia
-- sin necesitar estos permisos.
--
-- Mismo patrón que 077: se crean, se asignan a admin_general y se hace
-- backfill desde event.update para que nadie pierda acceso al correr
-- esto. Después el Equipo Timón los saca/agrega desde
-- /ministerios/catalogo/[id] y /ministerios/roles/[id].
-- ============================================================

-- 1. Insertar los permisos en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('event.manage',
   'Gestionar eventos',
   'Muestra el botón "Gestionar retiro" y da acceso a la Gestión del evento (equipo, becas en pensión, exportaciones) mientras está publicado, en curso o finalizado. No permite editar los datos del evento (eso es "Editar eventos").',
   'eventos'),
  ('event.attendance',
   'Tomar asistencia en eventos',
   'Muestra el botón "Tomar asistencia" y permite registrar la asistencia de los inscriptos (QR o manual) mientras el evento está publicado o en curso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave IN ('event.manage', 'event.attendance')
ON CONFLICT DO NOTHING;

-- 3. Backfill: quien tenía event.update venía viendo los tres botones.
--
-- 3a. Roles de sistema
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT DISTINCT rp.rol_sistema_id, p.id, true
FROM public.rol_permisos rp
JOIN public.permisos origen ON origen.id = rp.permiso_id
CROSS JOIN public.permisos p
WHERE origen.clave = 'event.update'
  AND rp.activo = true
  AND p.clave IN ('event.manage', 'event.attendance')
ON CONFLICT DO NOTHING;

-- 3b. Ministerios
INSERT INTO public.ministerio_permisos (ministerio_id, permiso_id)
SELECT DISTINCT mp.ministerio_id, p.id
FROM public.ministerio_permisos mp
JOIN public.permisos origen ON origen.id = mp.permiso_id
CROSS JOIN public.permisos p
WHERE origen.clave = 'event.update'
  AND p.clave IN ('event.manage', 'event.attendance')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRACIÓN 091: Permisos casas_retiro.create y casas_retiro.delete
--
-- Contexto (card #61): crear y dar de baja Casas de Retiro tienen su
-- propio permiso. Hasta ahora crear usaba organization.create y la baja
-- (pasar la casa a "inactiva" desde Editar) usaba organization.update.
--
-- "Eliminar" es baja lógica: estado = 'inactiva' + fecha_baja. No se
-- borra nada físicamente.
--
-- Mismo patrón que scripts/071: solo se crean los permisos y se asignan
-- a admin_general. El Equipo Timón los asigna a los roles que
-- correspondan desde /ministerios/catalogo/[id].
-- ============================================================

-- 1. Insertar los permisos en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('casas_retiro.create',
   'Crear Casas de Retiro',
   'Permite registrar nuevas casas de retiro desde la sección "Casas de Retiro".',
   'organizaciones'),
  ('casas_retiro.delete',
   'Eliminar Casas de Retiro',
   'Permite dar de baja (pasar a inactiva) o reactivar una casa de retiro. Es baja lógica: la casa y su historial se conservan.',
   'organizaciones')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general (acceso técnico global, mismo patrón que el resto del catálogo)
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave IN ('casas_retiro.create', 'casas_retiro.delete')
ON CONFLICT DO NOTHING;

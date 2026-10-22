-- ============================================================
-- MIGRACIÓN 099: Permiso event.view_equipo
--
-- Contexto (card #99, "Responsable"): "El responsable puede ver una vez
-- finalizado todo. Antes necesitarían ver los inscriptos y el equipo que
-- carga el coordinador."
--
-- - Inscriptos: ya lo cubre view.inscriptos (scripts/096). En la ficha del
--   retiro se suma un botón "Inscriptos" que abre ese listado filtrado.
-- - Equipo: este permiso muestra, en la ficha del retiro y solo lectura,
--   los servidores (con su grupo), el Ministerio de Música y el Equipo
--   Auxiliar, desde que el retiro se publica. Antes solo se veía desde la
--   Gestión, que además deja editar becas de pensión.
--
-- No se asigna a ningún ministerio por defecto: el Equipo Timón lo tilda
-- desde /ministerios/catalogo/[id].
-- ============================================================

-- 1. Insertar el permiso en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('event.view_equipo',
   'Ver equipo del retiro',
   'Muestra en la ficha del retiro, solo para ver, el equipo cargado por el coordinador: servidores (con su grupo), Ministerio de Música y Equipo Auxiliar. Visible desde que el retiro se publica, para los eventos de la propia organización. Quien gestiona el retiro ya lo ve sin este permiso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave = 'event.view_equipo'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRACIÓN 097: Permiso inscripcion.export_fichas
--
-- Contexto (card #97): "Coordinador — Debe poder exportar las fichas de
-- los participantes".
--
-- Botón "Exportar fichas" en el detalle del evento: descarga las fichas
-- de inscripción de todos los participantes, en PDF (una por hoja) o
-- Excel (una fila por persona).
--
-- El coordinador asignado y los centralizadores del evento lo tienen sin
-- este permiso (se resuelve en código, igual que los datos sensibles:
-- ver canExportarFichasInscripcion en lib/eventos/inscripcion-datos.ts).
-- Este permiso es para dárselo a otros roles desde
-- /ministerios/catalogo/[id]. No se asigna a ningún ministerio por defecto.
--
-- La dieta y la salud dentro de la ficha siguen dependiendo de
-- inscripcion.view_datos_sensibles (o ser coordinador/centralizador).
-- ============================================================

-- 1. Insertar el permiso en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('inscripcion.export_fichas',
   'Exportar fichas de inscripción',
   'Muestra el botón "Exportar fichas" en el detalle del evento, para descargar las fichas de inscripción de todos los participantes (PDF o Excel). Alcanza a los eventos de la propia organización. El Coordinador y los Centralizadores de un evento pueden exportarlas sin necesitar este permiso. La dieta y la salud solo se incluyen si además puede ver los datos sensibles.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave = 'inscripcion.export_fichas'
ON CONFLICT DO NOTHING;

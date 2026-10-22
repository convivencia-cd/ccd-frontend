-- ============================================================
-- MIGRACIÓN 098: Permiso perfil.view_propio
--
-- Contexto (card #92, "Rol: CONVIVENTE"): "Debe poder ver su perfil.
-- Actualmente solo pueden ver eventos publicados y no lo encuentro en los
-- permisos de su rol para habilitarlo."
--
-- Nueva pantalla /mi-perfil, de solo lectura: datos personales, contacto,
-- vida de fe y los retiros de la persona. Con este permiso aparece
-- "Mi perfil" en el menú de la cuenta de Participante.
--
-- No se asigna a ningún ministerio por defecto: el Equipo Timón se lo
-- tilda al rol Participante desde /ministerios/catalogo/[id].
-- (Los cecistas siguen viendo y editando su perfil en Configuración.)
-- ============================================================

-- 1. Insertar el permiso en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('perfil.view_propio',
   'Ver mi perfil',
   'Muestra "Mi perfil" en el menú de la cuenta de Participante: sus datos personales, de contacto y los retiros en los que participó, solo para ver (no puede editarlos). Los cecistas no lo necesitan: editan su perfil desde Configuración.',
   'personas')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave = 'perfil.view_propio'
ON CONFLICT DO NOTHING;

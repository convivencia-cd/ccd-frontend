-- ============================================================
-- MIGRACIÓN 096: Permiso view.inscriptos
--
-- Contexto (card #98): "Así como está el permiso de ver interesados
-- debería estar el de ver inscriptos, para poder asignárselo a timonel,
-- coordinador, enlace y responsable."
--
-- Nueva sección "Inscriptos" dentro de Retiros (/inscriptos): lista los
-- preinscriptos, inscriptos y conviventes de los eventos de la propia
-- organización. Mismo patrón que scripts/073 (view.interesados): no se
-- asigna a ningún ministerio por defecto — lo decide el Equipo Timón
-- desde /ministerios/catalogo/[id].
--
-- Coordinador/Centralizador de un evento puntual ve los inscriptos de
-- ese evento sin este permiso (se resuelve en código, ver
-- lib/eventos/acceso-por-evento.ts).
-- ============================================================

-- 1. Insertar el permiso en el catálogo
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('view.inscriptos',
   'Ver Inscriptos',
   'Permite ver la sección "Inscriptos" dentro de Eventos, con los preinscriptos, inscriptos y conviventes de los eventos de la propia organización (confraternidad/fraternidad). Quien es Coordinador o Centralizador de un evento puntual ve los inscriptos de ese evento sin necesitar este permiso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

-- 2. Asignar a admin_general
INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave = 'view.inscriptos'
ON CONFLICT DO NOTHING;

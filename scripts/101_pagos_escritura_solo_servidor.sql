-- ============================================================
-- MIGRACIÓN 101: Pagos — escritura solo desde el servidor
--
-- Hasta acá cualquier usuario interno podía insertar y modificar pagos con
-- su sesión (pagos_insert_auth / pagos_update_auth, reescritas por la 083).
-- Eso permitía cargar un pago "confirmado" para cualquier participante: queda
-- inscripto y el ingreso entra al informe económico (triggers 082/089).
--
-- 1. Permiso payment.register en el catálogo, SIN asignar a ningún rol:
--    admin_general lo tiene igual (puede todo) y CCD lo asigna a quien
--    corresponda desde /ministerios/catalogo. Los centralizadores del evento
--    pueden registrar pagos de su retiro sin este permiso (se valida en código).
-- 2. Se borran las políticas de INSERT y UPDATE. Todas las escrituras pasan
--    por rutas del servidor que validan permisos y usan service-role (que no
--    pasa por RLS). DELETE ya no tenía política. La lectura (pagos_select_auth)
--    no se toca en esta migración.
--
-- Desplegar el código ANTES de correr esto: el formulario viejo de Nuevo Pago
-- y la verificación de transferencias escriben con la sesión del usuario y
-- fallarían sin estas políticas.
-- ============================================================

BEGIN;

INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('payment.register',
   'Registrar pagos a mano',
   'Permite cargar pagos desde el formulario Nuevo Pago (efectivo, transferencia, etc.), scopeado a la organización del evento. Los centralizadores del retiro pueden hacerlo sin este permiso.',
   'pagos')
ON CONFLICT (clave) DO NOTHING;

DROP POLICY IF EXISTS "pagos_insert_auth" ON public.pagos;
DROP POLICY IF EXISTS "pagos_update_auth" ON public.pagos;

COMMIT;

-- Verificación (debería quedar solo pagos_select_auth):
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pagos';

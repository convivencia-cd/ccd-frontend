-- ============================================================
-- Migración 085: perfiles_usuario — el usuario ya no puede editar su perfil
--
-- perfiles_update_own (003) dejaba a cada usuario actualizar SU fila sin
-- restringir columnas: podía cambiarse persona_id por el de otra persona (un
-- admin) y heredar sus roles y ministerios — getUserContext y
-- es_usuario_interno() resuelven todo a partir de perfiles_usuario.persona_id.
-- Cualquier cuenta, incluidos los Participantes (082), podía escalar a admin.
--
-- La app nunca escribe perfiles_usuario desde el cliente: la fila la crea el
-- trigger de alta de Auth (handle_new_user, 056), que no depende de estas
-- políticas. Se eliminan update e insert; queda solo la lectura propia.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "perfiles_update_own" ON public.perfiles_usuario;
DROP POLICY IF EXISTS "perfiles_insert_own" ON public.perfiles_usuario;

COMMIT;

-- ─── Verificación (correr aparte) ────────────────────────────────────────────
-- Tiene que quedar solo perfiles_select_own.
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'perfiles_usuario';

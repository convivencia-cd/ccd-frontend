-- ============================================================
-- Migración 083: RLS — distinguir usuarios internos de Participantes
--
-- Problema: casi todas las políticas del esquema son
--     USING (auth.uid() IS NOT NULL)   /   WITH CHECK (auth.uid() IS NOT NULL)
-- o sea "cualquiera con sesión". Mientras solo tenían cuenta los cecistas se
-- toleraba, pero con 082 los conviventes no cecistas reciben una cuenta
-- (ministerio Participante) y, con estas políticas, podrían desde el navegador
-- (anon key + su sesión) leer/editar/borrar TODAS las personas, e incluso
-- insertarse una fila en usuario_roles con admin_general.
--
-- Solución: la función es_usuario_interno() reemplaza a "auth.uid() IS NOT NULL"
-- en TODAS las políticas que la usan. Interno = tiene algún rol técnico activo
-- (usuario_roles) o algún ministerio activo que no sea Participante (PAR).
-- Hoy todo usuario existente cumple (el trigger de alta asigna solo_lectura y
-- 057 dio Cecista a todos), así que para ellos nada cambia.
--
-- A los Participantes se les abre, solo lectura, lo mínimo para usar la app:
--   - lo mismo que ve un anónimo en la home (eventos publicados/suspendidos,
--     confras/fraternidades, casas de retiro): se extienden a `authenticated`
--     las políticas de 032/040;
--   - su propia fila de personas y sus propias asignaciones de ministerio;
--   - el catálogo ministerios / ministerio_permisos / permisos, que
--     getUserContext necesita para resolver sus permisos.
--
-- Las rutas /api/public/* y el webhook de Mercado Pago usan service role:
-- no les afecta.
--
-- ANTES DE CORRER: ejecutar el diagnóstico de abajo y revisar qué políticas va a
-- reescribir (la base de prod puede diferir de los scripts).
--
-- SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public'
--  ORDER BY tablename, policyname;
-- ============================================================

BEGIN;

-- ─── 1. Función ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER para poder leer usuario_roles / asignaciones sin quedar
-- atrapada en las mismas políticas que usa.
CREATE OR REPLACE FUNCTION public.es_usuario_interno()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
        FROM public.usuario_roles ur
        LEFT JOIN public.perfiles_usuario pu ON pu.id = auth.uid()
       WHERE (ur.usuario_id = auth.uid()
              OR (pu.persona_id IS NOT NULL AND ur.persona_id = pu.persona_id))
         AND ur.activo = TRUE
         AND (ur.fecha_fin IS NULL OR ur.fecha_fin > CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1
        FROM public.perfiles_usuario pu
        JOIN public.asignaciones_ministerio am ON am.persona_id = pu.persona_id
        JOIN public.ministerios m ON m.id = am.ministerio_id
       WHERE pu.id = auth.uid()
         AND am.estado = 'activo'
         AND (am.fecha_fin IS NULL OR am.fecha_fin > CURRENT_DATE)
         AND m.codigo_interno IS DISTINCT FROM 'PAR'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.es_usuario_interno() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_usuario_interno() TO authenticated, anon;

-- Lo que el middleware necesita saber en cada request, en UNA sola llamada:
-- si es usuario interno y si arrastra la contraseña temporal (058). Antes eran
-- dos consultas por navegación; así queda en una (más el getUser de Auth).
CREATE OR REPLACE FUNCTION public.mi_estado_acceso()
RETURNS TABLE (es_interno BOOLEAN, debe_cambiar_password BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.es_usuario_interno(),
    COALESCE(
      (SELECT p.debe_cambiar_password
         FROM public.personas p
        WHERE p.auth_user_id = auth.uid()
        LIMIT 1),
      FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.mi_estado_acceso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_estado_acceso() TO authenticated;

-- ─── 2. Reescribir "cualquiera con sesión" → "usuario interno" ───────────────
-- Se recorre el catálogo en vez de listar políticas por nombre: agarra también
-- las que en prod se hayan creado a mano con otro nombre. "(SELECT ...)" hace
-- que Postgres evalúe la función una vez por consulta y no una vez por fila.
DO $$
DECLARE
  r record;
  abierta CONSTANT text[] := ARRAY[
    '(auth.uid() IS NOT NULL)',
    '(auth.role() = ''authenticated''::text)'
  ];
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (qual = ANY (abierta) OR with_check = ANY (abierta))
  LOOP
    IF r.qual = ANY (abierta) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I USING ((SELECT public.es_usuario_interno()))',
        r.policyname, r.tablename);
    END IF;
    IF r.with_check = ANY (abierta) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I WITH CHECK ((SELECT public.es_usuario_interno()))',
        r.policyname, r.tablename);
    END IF;
    RAISE NOTICE 'Reescrita: %.%', r.tablename, r.policyname;
  END LOOP;
END $$;

-- ─── 3. Lo público también para usuarios logueados ───────────────────────────
-- 032/040 las crearon TO anon; un Participante logueado usa el rol
-- `authenticated` y dejaría de ver la home y /eventos/publicados.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname IN (
         'public_read_publicados',
         'public_read_suspendidos',
         'public_read_organizaciones_panel',
         'public_read_casas_retiro_panel'
       )
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO anon, authenticated',
                   r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── 4. Lo propio del Participante ───────────────────────────────────────────
DROP POLICY IF EXISTS "personas_select_propia" ON public.personas;
CREATE POLICY "personas_select_propia"
  ON public.personas FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "asig_min_select_propias" ON public.asignaciones_ministerio;
CREATE POLICY "asig_min_select_propias"
  ON public.asignaciones_ministerio FOR SELECT TO authenticated
  USING (
    persona_id = (SELECT pu.persona_id FROM public.perfiles_usuario pu WHERE pu.id = auth.uid())
  );

-- Catálogo de permisos: sin datos personales, lo necesita getUserContext.
DROP POLICY IF EXISTS "ministerios_select_catalogo" ON public.ministerios;
CREATE POLICY "ministerios_select_catalogo"
  ON public.ministerios FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "min_permisos_select_catalogo" ON public.ministerio_permisos;
CREATE POLICY "min_permisos_select_catalogo"
  ON public.ministerio_permisos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "permisos_select_catalogo" ON public.permisos;
CREATE POLICY "permisos_select_catalogo"
  ON public.permisos FOR SELECT TO authenticated USING (TRUE);

COMMIT;

-- ─── Verificación (correr aparte) ────────────────────────────────────────────
-- Tiene que devolver 0 filas: ninguna política sigue abierta a cualquier sesión.
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public'
--    AND (qual IN ('(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)')
--      OR with_check IN ('(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)'));

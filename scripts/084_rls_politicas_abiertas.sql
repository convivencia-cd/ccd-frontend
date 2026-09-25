-- ============================================================
-- Migración 084: cerrar las dos políticas abiertas que la 083 no reconoció
--
-- El barrido de la 083 buscaba "auth.uid() IS NOT NULL"; en prod quedaban dos
-- escritas como USING (true):
--
--   * evento_movimientos_authenticated (ALL, authenticated): cualquier sesión,
--     incluidos los Participantes, podía leer/editar/borrar el historial.
--   * usuario_roles_select (SELECT, public): hasta un ANÓNIMO con la anon key
--     podía listar quién tiene qué rol técnico.
--
-- Se pasan a usuarios internos, igual que el resto. Cada uno sigue viendo sus
-- propios roles por usuario_roles_select_own (006).
-- ============================================================

BEGIN;

ALTER POLICY "evento_movimientos_authenticated" ON public.evento_movimientos
  USING ((SELECT public.es_usuario_interno()))
  WITH CHECK ((SELECT public.es_usuario_interno()));

ALTER POLICY "usuario_roles_select" ON public.usuario_roles
  TO authenticated
  USING ((SELECT public.es_usuario_interno()));

COMMIT;

-- ─── Verificación (correr aparte) ────────────────────────────────────────────
-- Solo tienen que quedar las tres *_catalogo de la 083.
-- SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')
--  ORDER BY tablename;

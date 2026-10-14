-- ============================================================
-- MIGRACIÓN 092: preguntas separadas por informe del cierre (card #44)
--
-- Contexto: los permisos ya distinguen los tres informes confidenciales
-- (cierre.view_informe_eqt, cierre.view_informe_responsables,
-- cierre.view_carismas), pero en Tipos de Retiro había un solo módulo de
-- preguntas (preguntas_informe) que usaban los dos Informes de la CcD, y la
-- Planilla de Carismas no tenía preguntas.
--
--   1. tipos_eventos.preguntas_informe queda como las preguntas del Informe
--      para Equipo Timón (es lo que ya era, ver 088).
--   2. preguntas_informe_responsables: preguntas del Informe para Responsables.
--      Se siembra con una copia de preguntas_informe, que es lo que el informe
--      mostraba hasta hoy: conserva los ids, así las respuestas ya cargadas
--      siguen apareciendo.
--   3. preguntas_carismas: preguntas de la Planilla de Carismas, que se
--      responden por cada servidor. Arranca vacía: sin preguntas la planilla
--      sigue siendo un texto libre por servidor, como hasta ahora.
--
-- Requiere 052. Idempotente.
-- ============================================================

BEGIN;

ALTER TABLE public.tipos_eventos
  ADD COLUMN IF NOT EXISTS preguntas_informe_responsables JSONB,
  ADD COLUMN IF NOT EXISTS preguntas_carismas JSONB NOT NULL DEFAULT '[]'::jsonb;

-- NULL = todavía no sembrada (distinto de '[]', que es "sin preguntas" a propósito).
UPDATE public.tipos_eventos
   SET preguntas_informe_responsables = COALESCE(preguntas_informe, '[]'::jsonb)
 WHERE preguntas_informe_responsables IS NULL;

ALTER TABLE public.tipos_eventos
  ALTER COLUMN preguntas_informe_responsables SET DEFAULT '[]'::jsonb,
  ALTER COLUMN preguntas_informe_responsables SET NOT NULL;

COMMIT;

-- Verificación:
-- SELECT nombre,
--        jsonb_array_length(preguntas_informe)              AS eqt,
--        jsonb_array_length(preguntas_informe_responsables) AS responsables,
--        jsonb_array_length(preguntas_carismas)             AS carismas
--   FROM public.tipos_eventos WHERE activo;

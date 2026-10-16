-- ============================================================
-- MIGRACIÓN 093: "Prefiero no decirlo" en personas.sexo (card #42)
--
-- Contexto: Coti pidió que el campo Sexo del formulario de inscripción
-- ofrezca Masculino, Femenino y Prefiero no decirlo. La 090 dejó un CHECK
-- con solo masculino/femenino, así que sin esta migración guardar la opción
-- nueva falla.
--
-- Correr ANTES de desplegar el código. Requiere 090. Idempotente.
-- ============================================================

BEGIN;

ALTER TABLE public.personas DROP CONSTRAINT IF EXISTS personas_sexo_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_sexo_check
    CHECK (sexo IS NULL OR sexo IN ('masculino', 'femenino', 'prefiero_no_decirlo'));

COMMIT;

-- Verificación:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'personas_sexo_check';

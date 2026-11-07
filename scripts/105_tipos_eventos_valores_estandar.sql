-- ============================================================
-- Migración 105: valor de inscripción y de pensión estándar por tipo de
-- retiro (card #93).
--
-- Cada tipo de retiro puede tener un valor de inscripción y uno de pensión
-- "de lista". Al crear un retiro de ese tipo se copian a eventos.precio y
-- eventos.pension (lo hace la API, app/api/eventos/route.ts). Después se
-- pueden cambiar en cada retiro desde "Editar retiro"; cambiar el valor del
-- tipo NO toca los retiros ya creados.
--
-- NULL = sin valor estándar (el retiro arranca en 0, como hasta ahora).
--
-- Idempotente.
-- ============================================================

BEGIN;

ALTER TABLE public.tipos_eventos
  ADD COLUMN IF NOT EXISTS precio_inscripcion NUMERIC(12, 2)
    CHECK (precio_inscripcion IS NULL OR precio_inscripcion >= 0),
  ADD COLUMN IF NOT EXISTS precio_pension NUMERIC(12, 2)
    CHECK (precio_pension IS NULL OR precio_pension >= 0);

COMMENT ON COLUMN public.tipos_eventos.precio_inscripcion IS
  'Valor de inscripción estándar. Se copia a eventos.precio al crear un retiro de este tipo.';
COMMENT ON COLUMN public.tipos_eventos.precio_pension IS
  'Valor de pensión estándar. Se copia a eventos.pension al crear un retiro de este tipo.';

COMMIT;

NOTIFY pgrst, 'reload schema';

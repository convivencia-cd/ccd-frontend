-- 080_interesado_estados_contacto.sql
--
-- Nuevo flujo de interesados: registrar interés no cobra nada. El seguimiento
-- en /interesados se reduce a tres estados (No contactado / Confirmado /
-- Cancelado) y al pasar a "confirmado" la plataforma manda por mail el link de
-- pago de la inscripción (cuenta de Mercado Pago de EQT).
--
-- Reemplaza el vocabulario de 5 valores que había creado 044 y agrega el sello
-- del último envío del link, para poder mostrarlo en el listado.

BEGIN;

-- 044 creó el CHECK inline (nombre autogenerado por Postgres). Se busca por
-- catálogo en vez de asumir el nombre, así la migración es idempotente y
-- tolera bases donde 044 se haya corrido con otro nombre.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.evento_participantes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado_contacto%'
  LOOP
    EXECUTE format('ALTER TABLE public.evento_participantes DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- "contactado" y "sin_respuesta" no tienen equivalente en el vocabulario nuevo:
-- el contacto existió pero no hubo decisión, así que vuelven al estado inicial.
UPDATE public.evento_participantes
SET estado_contacto = CASE estado_contacto
  WHEN 'confirmo'      THEN 'confirmado'
  WHEN 'declino'       THEN 'cancelado'
  WHEN 'contactado'    THEN 'no_contactado'
  WHEN 'sin_respuesta' THEN 'no_contactado'
  ELSE estado_contacto END
WHERE estado_contacto IN ('confirmo', 'declino', 'contactado', 'sin_respuesta');

ALTER TABLE public.evento_participantes
  ADD CONSTRAINT evento_participantes_estado_contacto_check
    CHECK (estado_contacto IN ('no_contactado', 'confirmado', 'cancelado'));

ALTER TABLE public.evento_participantes
  ADD COLUMN IF NOT EXISTS pago_link_enviado_en TIMESTAMPTZ;

COMMENT ON COLUMN public.evento_participantes.pago_link_enviado_en IS
  'Último envío del mail con el link de pago de la inscripción (se sella al confirmar o reenviar desde /interesados).';

COMMIT;

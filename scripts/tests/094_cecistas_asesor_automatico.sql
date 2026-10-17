-- Ejecutar SOLO en una base PostgreSQL vacía y descartable:
-- psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/tests/094_cecistas_asesor_automatico.sql
\set ON_ERROR_STOP on

-- Esquema mínimo previo a 094 (003 + 050), sin datos ni servicios externos.
CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo_persona text NOT NULL DEFAULT 'cecista',
  estado_eclesial text NOT NULL DEFAULT 'laico'
    CHECK (estado_eclesial IN ('laico', 'clerigo', 'consagrado')),
  estado_eclesial_rango text,
  CONSTRAINT personas_estado_eclesial_rango_check
    CHECK (estado_eclesial_rango IS NULL OR estado_eclesial_rango IN
      ('obispo', 'presbitero', 'diacono', 'seminarista', 'diacono_permanente'))
);
CREATE TABLE public.persona_modos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id),
  modo text NOT NULL CHECK (modo IN ('colaborador', 'servidor', 'asesor', 'familiar', 'orante', 'intercesor')),
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo'))
);
CREATE UNIQUE INDEX uq_persona_modo_activo ON public.persona_modos(persona_id) WHERE fecha_fin IS NULL;

INSERT INTO public.personas (nombre, estado_eclesial, estado_eclesial_rango) VALUES
  ('sacerdote', 'clerigo', 'presbitero'),
  ('obispo', 'clerigo', 'obispo'),
  ('historico', 'clerigo', 'presbitero'),
  ('diacono', 'clerigo', 'diacono');
INSERT INTO public.persona_modos (persona_id, modo, fecha_inicio)
SELECT id, CASE nombre WHEN 'obispo' THEN 'asesor' ELSE 'servidor' END, '2001-01-01'
FROM public.personas;
INSERT INTO public.persona_modos (persona_id, modo, fecha_inicio, fecha_fin, estado)
SELECT id, 'asesor', '1999-01-01', '2000-01-01', 'inactivo'
FROM public.personas WHERE nombre = 'historico';

\ir ../094_cecistas_asesor_automatico.sql
-- La migración y el backfill deben poder repetirse sin duplicados.
\ir ../094_cecistas_asesor_automatico.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM public.persona_modos WHERE fecha_fin IS NULL) <> 6 THEN
    RAISE EXCEPTION 'Backfill incorrecto o Asesor duplicado';
  END IF;
  IF (SELECT count(*) FROM public.persona_modos WHERE fecha_inicio = '2001-01-01' AND fecha_fin IS NULL) <> 4 THEN
    RAISE EXCEPTION 'Se modificaron los modos originales';
  END IF;
  IF (SELECT count(*) FROM public.persona_modos WHERE fecha_fin = '2000-01-01' AND estado = 'inactivo') <> 1 THEN
    RAISE EXCEPTION 'Se modificó el historial cerrado';
  END IF;
END;
$$;

BEGIN;
DO $$
DECLARE
  persona uuid;
  rango text;
  modo_base text;
BEGIN
  -- Cada modo principal se conserva para los tres rangos habilitados.
  FOREACH rango IN ARRAY ARRAY['presbitero', 'obispo', 'cardenal'] LOOP
    FOREACH modo_base IN ARRAY ARRAY['colaborador', 'servidor', 'familiar', 'orante', 'intercesor'] LOOP
      INSERT INTO public.personas (nombre) VALUES ('prueba') RETURNING id INTO persona;
      INSERT INTO public.persona_modos (persona_id, modo, fecha_inicio) VALUES (persona, modo_base, '2010-01-01');
      UPDATE public.personas SET estado_eclesial = 'clerigo', estado_eclesial_rango = rango WHERE id = persona;
      UPDATE public.personas SET estado_eclesial_rango = rango WHERE id = persona;
      IF (SELECT count(*) FROM public.persona_modos WHERE persona_id = persona AND fecha_fin IS NULL) <> 2
         OR NOT EXISTS (SELECT 1 FROM public.persona_modos WHERE persona_id = persona AND modo = modo_base AND fecha_inicio = '2010-01-01' AND fecha_fin IS NULL) THEN
        RAISE EXCEPTION 'No se conservaron ambos modos para % + %', rango, modo_base;
      END IF;
      -- Siguen prohibidos los duplicados y un segundo modo principal.
      BEGIN
        INSERT INTO public.persona_modos (persona_id, modo) VALUES (persona, 'asesor');
        RAISE EXCEPTION 'Se permitió duplicar Asesor';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
      BEGIN
        INSERT INTO public.persona_modos (persona_id, modo)
        VALUES (persona, CASE WHEN modo_base = 'familiar' THEN 'servidor' ELSE 'familiar' END);
        RAISE EXCEPTION 'Se permitieron dos modos principales';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END LOOP;
  END LOOP;

  -- Los otros rangos y los no cecistas no reciben Asesor automáticamente.
  FOREACH rango IN ARRAY ARRAY['diacono', 'seminarista', 'diacono_permanente'] LOOP
    INSERT INTO public.personas (nombre, estado_eclesial, estado_eclesial_rango)
    VALUES ('excluido', 'clerigo', rango) RETURNING id INTO persona;
    IF EXISTS (SELECT 1 FROM public.persona_modos WHERE persona_id = persona) THEN
      RAISE EXCEPTION 'Asesor asignado indebidamente a %', rango;
    END IF;
  END LOOP;
  INSERT INTO public.personas (nombre, tipo_persona, estado_eclesial, estado_eclesial_rango)
  VALUES ('no cecista', 'no_cecista', 'clerigo', 'presbitero') RETURNING id INTO persona;
  IF EXISTS (SELECT 1 FROM public.persona_modos WHERE persona_id = persona) THEN
    RAISE EXCEPTION 'Se asignó Asesor a un no cecista';
  END IF;
  -- Al pasar a cecista, o al crear un cardenal, se aplica la misma regla.
  UPDATE public.personas SET tipo_persona = 'cecista' WHERE id = persona;
  IF NOT EXISTS (SELECT 1 FROM public.persona_modos WHERE persona_id = persona AND modo = 'asesor') THEN
    RAISE EXCEPTION 'No se asignó Asesor al pasar a cecista';
  END IF;
  INSERT INTO public.personas (nombre, estado_eclesial, estado_eclesial_rango)
  VALUES ('cardenal', 'clerigo', 'cardenal') RETURNING id INTO persona;
  IF NOT EXISTS (SELECT 1 FROM public.persona_modos WHERE persona_id = persona AND modo = 'asesor') THEN
    RAISE EXCEPTION 'No se asignó Asesor al crear un cardenal';
  END IF;
END;
$$;

-- SECURITY INVOKER: se respetan los permisos/RLS de quien edita el perfil.
CREATE ROLE ccd_asesor_test_user;
GRANT USAGE ON SCHEMA public TO ccd_asesor_test_user;
GRANT SELECT, UPDATE ON public.personas TO ccd_asesor_test_user;
GRANT SELECT, INSERT ON public.persona_modos TO ccd_asesor_test_user;
ALTER TABLE public.persona_modos ENABLE ROW LEVEL SECURITY;
CREATE POLICY modos_test_select ON public.persona_modos FOR SELECT TO ccd_asesor_test_user USING (true);
CREATE POLICY modos_test_insert ON public.persona_modos FOR INSERT TO ccd_asesor_test_user
  WITH CHECK (current_setting('ccd.test_interno', true) = 'true');

INSERT INTO public.personas (nombre) VALUES ('rls_permitido'), ('rls_denegado');
SET LOCAL ROLE ccd_asesor_test_user;
SET LOCAL ccd.test_interno = 'true';
UPDATE public.personas SET estado_eclesial = 'clerigo', estado_eclesial_rango = 'presbitero' WHERE nombre = 'rls_permitido';
SET LOCAL ccd.test_interno = 'false';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.persona_modos m JOIN public.personas p ON p.id = m.persona_id WHERE p.nombre = 'rls_permitido' AND m.modo = 'asesor') THEN
    RAISE EXCEPTION 'El trigger no funcionó con permisos de usuario interno';
  END IF;
  BEGIN
    UPDATE public.personas SET estado_eclesial = 'clerigo', estado_eclesial_rango = 'presbitero' WHERE nombre = 'rls_denegado';
    RAISE EXCEPTION 'El trigger evadió RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.personas WHERE nombre = 'rls_denegado' AND estado_eclesial <> 'laico') THEN
    RAISE EXCEPTION 'La escritura fallida no fue atómica';
  END IF;
END;
$$;
ROLLBACK;
\echo 'OK: backfill, doble modo, idempotencia, historial, exclusiones y RLS'

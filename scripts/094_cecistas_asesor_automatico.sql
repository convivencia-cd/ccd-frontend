-- Cecistas sacerdotes, obispos y cardenales suman Asesor a su modo vigente.
-- Se conserva el historial: no se cierra ni reemplaza ningún modo anterior.
BEGIN;

ALTER TABLE public.personas
  DROP CONSTRAINT IF EXISTS personas_estado_eclesial_rango_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_estado_eclesial_rango_check
  CHECK (estado_eclesial_rango IS NULL OR estado_eclesial_rango IN
    ('obispo', 'presbitero', 'cardenal', 'diacono', 'seminarista', 'diacono_permanente'));

-- Solo Asesor puede coexistir con otro modo. Un mismo modo no se duplica.
DROP INDEX IF EXISTS public.uq_persona_modo_activo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_modo_activo
  ON public.persona_modos (persona_id, modo) WHERE fecha_fin IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_modo_principal_activo
  ON public.persona_modos (persona_id) WHERE fecha_fin IS NULL AND modo <> 'asesor';

CREATE OR REPLACE FUNCTION public.agregar_modo_asesor_por_estado_eclesial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tipo_persona = 'cecista'
     AND NEW.estado_eclesial = 'clerigo'
     AND NEW.estado_eclesial_rango IN ('presbitero', 'obispo', 'cardenal') THEN
    INSERT INTO public.persona_modos (persona_id, modo)
    VALUES (NEW.id, 'asesor')
    ON CONFLICT (persona_id, modo) WHERE fecha_fin IS NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Solo se ejecuta desde el trigger y con los permisos del usuario que guarda.
REVOKE ALL ON FUNCTION public.agregar_modo_asesor_por_estado_eclesial() FROM PUBLIC;

DROP TRIGGER IF EXISTS personas_agregar_modo_asesor ON public.personas;
CREATE TRIGGER personas_agregar_modo_asesor
  AFTER INSERT OR UPDATE OF tipo_persona, estado_eclesial, estado_eclesial_rango
  ON public.personas
  FOR EACH ROW
  EXECUTE FUNCTION public.agregar_modo_asesor_por_estado_eclesial();

-- También abarca a quienes ya tienen cargado ese estado eclesiástico.
INSERT INTO public.persona_modos (persona_id, modo)
SELECT id, 'asesor'
FROM public.personas
WHERE tipo_persona = 'cecista'
  AND estado_eclesial = 'clerigo'
  AND estado_eclesial_rango IN ('presbitero', 'obispo', 'cardenal')
ON CONFLICT (persona_id, modo) WHERE fecha_fin IS NULL DO NOTHING;

COMMIT;

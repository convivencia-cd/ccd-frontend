-- ============================================================
-- Migración 082: Convivente como "tilde" de la persona + rol Participante
--
-- Modelo acordado con Ángeles (reunión 23/09):
--
--   * Cecista / No cecista es la CATEGORÍA de la persona (personas.tipo_persona).
--   * Convivente es otra cosa: un tilde que dice "hizo al menos una convivencia".
--     Todo cecista es convivente (Coti: no hay cecistas sin convivencia). Un no
--     cecista pasa a convivente la primera vez que se le toma asistencia.
--   * El detalle de EN QUÉ convivencias fue convivente ya vive en
--     evento_participantes (rol_en_evento = 'convivente' + asistencia).
--
-- El tilde se guarda en personas.es_convivente y lo mantienen dos triggers, así
-- nadie tiene que acordarse de marcarlo y /personas puede filtrar sin subqueries:
--   - al tomar asistencia a un convivente (QR o manual) → true
--   - al pasar una persona a cecista → true
-- También se puede tildar a mano desde la ficha, para quienes hicieron su
-- convivencia antes de que existiera la plataforma.
--
-- /personas deja de mostrar a los no cecistas SIN el tilde: son interesados que
-- nunca asistieron (el formulario de interés crea su fila en personas porque el
-- pago y el QR cuelgan de ella) y se gestionan en /interesados.
--
-- Además crea el ministerio "Participante" (PAR): el acceso mínimo que recibe un
-- no cecista cuando se le da el presente en su primera convivencia. Por defecto
-- solo trae view.eventos_publicados; CCD lo ajusta desde /ministerios/catalogo.
--
-- IMPORTANTE: correr esta migración ANTES de desplegar el código que la usa
-- (/personas filtra por es_convivente). Correr 083 antes de que se cree la
-- primera cuenta de Participante.
-- ============================================================

BEGIN;

-- ─── 1. Tilde de convivente ──────────────────────────────────────────────────
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS es_convivente BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.personas.es_convivente IS
  'Hizo al menos una convivencia. Todo cecista lo es. Lo mantienen los triggers de 082 (asistencia / pase a cecista); se puede tildar a mano para convivencias previas a la plataforma.';

CREATE INDEX IF NOT EXISTS idx_personas_es_convivente ON public.personas(es_convivente);

-- ─── 2. Backfill ─────────────────────────────────────────────────────────────
-- a) Cecistas: todos son conviventes.
UPDATE public.personas
   SET es_convivente = TRUE
 WHERE tipo_persona = 'cecista'
   AND NOT es_convivente;

-- b) Quien ya tiene asistencia tomada como convivente en algún evento.
UPDATE public.personas p
   SET es_convivente = TRUE
 WHERE NOT p.es_convivente
   AND EXISTS (
     SELECT 1
       FROM public.evento_participantes ep
      WHERE ep.persona_id = p.id
        AND ep.rol_en_evento = 'convivente'
        AND (ep.fecha_asistencia IS NOT NULL
             OR ep.estado_participacion IN ('en_curso', 'completado'))
   );

-- c) No cecistas que 034 marcó como conviventes (vía persona_categoria_no_cecista)
--    y que 038 aplanó a 'no_cecista'.
UPDATE public.personas p
   SET es_convivente = TRUE
 WHERE NOT p.es_convivente
   AND EXISTS (
     SELECT 1
       FROM public.persona_categoria_no_cecista pnc
      WHERE pnc.persona_id = p.id
        AND pnc.categoria = 'convivente'
   );

-- d) No cecistas sin NINGUNA participación en eventos: no vinieron por el
--    formulario de interés, los cargó alguien a mano en /personas. Hoy se ven en
--    el listado y se los deja visibles (se asume que ya hicieron su convivencia).
--    Los no cecistas que SÍ tienen participaciones pero ninguna asistencia son
--    interesados y quedan con el tilde en false (fuera de /personas).
UPDATE public.personas p
   SET es_convivente = TRUE
 WHERE NOT p.es_convivente
   AND p.tipo_persona = 'no_cecista'
   AND NOT EXISTS (
     SELECT 1 FROM public.evento_participantes ep WHERE ep.persona_id = p.id
   );

-- ─── 2b. Quién aparece en /personas ──────────────────────────────────────────
-- Todos menos los no cecistas sin el tilde (interesados que nunca asistieron).
-- Columna generada para que el listado filtre con un simple eq, sin combinarlo
-- con el .or() de la búsqueda por texto.
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS en_padron BOOLEAN
    GENERATED ALWAYS AS (tipo_persona IS DISTINCT FROM 'no_cecista' OR es_convivente) STORED;

-- ─── 3. Triggers que mantienen el tilde ──────────────────────────────────────
-- Pase a cecista → convivente.
CREATE OR REPLACE FUNCTION public.personas_cecista_es_convivente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tipo_persona = 'cecista' THEN
    NEW.es_convivente := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personas_cecista_es_convivente ON public.personas;
CREATE TRIGGER trg_personas_cecista_es_convivente
  BEFORE INSERT OR UPDATE OF tipo_persona, es_convivente ON public.personas
  FOR EACH ROW EXECUTE FUNCTION public.personas_cecista_es_convivente();

-- Asistencia tomada a un convivente → la persona es convivente.
-- SECURITY DEFINER: quien toma asistencia (centralizador) puede no tener
-- permiso de UPDATE sobre personas una vez aplicada la 083.
CREATE OR REPLACE FUNCTION public.evento_participantes_marcar_convivente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rol_en_evento = 'convivente'
     AND (NEW.fecha_asistencia IS NOT NULL
          OR NEW.estado_participacion IN ('en_curso', 'completado')) THEN
    UPDATE public.personas
       SET es_convivente = TRUE
     WHERE id = NEW.persona_id
       AND NOT es_convivente;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evento_participantes_marcar_convivente ON public.evento_participantes;
CREATE TRIGGER trg_evento_participantes_marcar_convivente
  AFTER INSERT OR UPDATE OF estado_participacion, fecha_asistencia, rol_en_evento
  ON public.evento_participantes
  FOR EACH ROW EXECUTE FUNCTION public.evento_participantes_marcar_convivente();

-- ─── 4. Ministerio "Participante" ────────────────────────────────────────────
-- Mismo tipo/nivel que "Cecista" (CEC, ver 047): es un rol base de usuario,
-- no un ministerio pastoral.
INSERT INTO public.ministerios (nombre, codigo_interno, tipo, nivel, activo)
SELECT 'Participante', 'PAR', 'usuario', 'comunidad', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.ministerios WHERE codigo_interno = 'PAR'
);

INSERT INTO public.ministerio_permisos (ministerio_id, permiso_id)
SELECT m.id, p.id
  FROM public.ministerios m
  JOIN public.permisos p ON p.clave = 'view.eventos_publicados'
 WHERE m.codigo_interno = 'PAR'
   AND NOT EXISTS (
     SELECT 1 FROM public.ministerio_permisos mp
      WHERE mp.ministerio_id = m.id AND mp.permiso_id = p.id
   );

COMMIT;

-- ─── Verificación (correr aparte) ────────────────────────────────────────────
-- SELECT tipo_persona, es_convivente, COUNT(*)
--   FROM public.personas WHERE fecha_baja IS NULL
--  GROUP BY 1, 2 ORDER BY 1, 2;

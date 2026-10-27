-- ============================================================
-- Migración 100: la convivencia/retiro/taller en el que se dio el presente
-- se suma sola a "Convivencias, Retiros y Talleres realizados".
--
-- Antes, persona_eventos_realizados (050) solo se llenaba a mano (perfil o link
-- de inscripción). Si a alguien se le daba el presente como convivente, esa
-- convivencia no aparecía tildada después en su perfil ni en la próxima
-- inscripción (card #92: Carlos Castrogiovanni, Dios Amor del 16/10/2026).
--
-- Regla (la misma que usa 082 para el tilde de convivente):
--   rol_en_evento = 'convivente' Y (fecha_asistencia cargada O estado
--   en_curso/completado) → se agrega el tipo de evento con el año de inicio.
--
-- Solo agrega. Si el tipo ya estaba cargado, no lo pisa; únicamente completa el
-- año si estaba vacío. Si después se destilda a mano desde el perfil, queda
-- destildado hasta que se vuelva a dar un presente en ese tipo de evento.
-- ============================================================

BEGIN;

-- SECURITY DEFINER: quien da el presente (centralizador) puede no tener
-- permiso de escritura sobre los datos de la persona.
CREATE OR REPLACE FUNCTION public.evento_participantes_sumar_realizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.rol_en_evento = 'convivente'
     AND (NEW.fecha_asistencia IS NOT NULL
          OR NEW.estado_participacion IN ('en_curso', 'completado')) THEN
    INSERT INTO public.persona_eventos_realizados (persona_id, tipo_evento_id, anio)
    SELECT NEW.persona_id, e.tipo_evento_id, EXTRACT(YEAR FROM e.fecha_inicio)::int
      FROM public.eventos e
     WHERE e.id = NEW.evento_id
       AND e.tipo_evento_id IS NOT NULL
    ON CONFLICT (persona_id, tipo_evento_id) DO UPDATE
      SET anio = EXCLUDED.anio
      WHERE public.persona_eventos_realizados.anio IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.evento_participantes_sumar_realizado() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_evento_participantes_sumar_realizado ON public.evento_participantes;
CREATE TRIGGER trg_evento_participantes_sumar_realizado
  AFTER INSERT OR UPDATE OF estado_participacion, fecha_asistencia, rol_en_evento
  ON public.evento_participantes
  FOR EACH ROW EXECUTE FUNCTION public.evento_participantes_sumar_realizado();

-- Backfill: quienes ya tienen el presente dado antes de esta migración.
-- DISTINCT ON: si hizo el mismo tipo varias veces, se toma la primera.
INSERT INTO public.persona_eventos_realizados (persona_id, tipo_evento_id, anio)
SELECT DISTINCT ON (ep.persona_id, e.tipo_evento_id)
       ep.persona_id, e.tipo_evento_id, EXTRACT(YEAR FROM e.fecha_inicio)::int
  FROM public.evento_participantes ep
  JOIN public.eventos e ON e.id = ep.evento_id
 WHERE ep.rol_en_evento = 'convivente'
   AND (ep.fecha_asistencia IS NOT NULL
        OR ep.estado_participacion IN ('en_curso', 'completado'))
   AND e.tipo_evento_id IS NOT NULL
 ORDER BY ep.persona_id, e.tipo_evento_id, e.fecha_inicio
ON CONFLICT (persona_id, tipo_evento_id) DO UPDATE
  SET anio = EXCLUDED.anio
  WHERE public.persona_eventos_realizados.anio IS NULL;

COMMIT;

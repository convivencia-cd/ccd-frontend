-- ============================================================
-- MIGRACIÓN 088: el Informe del Coordinador es el "Informe de la CcD
-- (para Equipo Timón)" + pregunta VII de materiales
--
-- Contexto: la Comunidad pasó el Word "Informe de la CcD (para Equipo
-- Timón)". Sus preguntas I–VI y VIII son, textuales, las 7 que 052 sembró
-- como "Informe del Coordinador": el informe que ya existe ES el de Equipo
-- Timón. Falta la VII (materiales: bolso y manuales).
--
--   1. evento_informes_cierre: tipo 'coordinador' → 'eqt'. Desde acá lo ve
--      solo quien tenga cierre.view_informe_eqt (y el coordinador del evento).
--   2. tipos_eventos.preguntas_informe (convivencias): se inserta la
--      pregunta de materiales antes de la del Equipo Auxiliar (p7), para
--      respetar el orden del Word. Si un tipo ya no tiene p7, va al final.
--
-- El informe para Responsables (tipo 'responsables') sigue pendiente: falta
-- el modelo de la Comunidad.
--
-- Requiere 086. Idempotente.
-- ============================================================

BEGIN;

-- ─── 1. coordinador → eqt ────────────────────────────────────────────────────
UPDATE public.evento_informes_cierre i
   SET tipo = 'eqt'
 WHERE i.tipo = 'coordinador'
   AND NOT EXISTS (
     SELECT 1 FROM public.evento_informes_cierre e
      WHERE e.evento_id = i.evento_id AND e.tipo = 'eqt'
   );

-- ─── 2. Pregunta VII: materiales ─────────────────────────────────────────────
UPDATE public.tipos_eventos t
   SET preguntas_informe = (
     SELECT jsonb_agg(s.elem ORDER BY s.ord)
       FROM (
         SELECT e.elem, e.ord::numeric AS ord
           FROM jsonb_array_elements(t.preguntas_informe) WITH ORDINALITY AS e(elem, ord)
         UNION ALL
         SELECT jsonb_build_object(
                  'id', 'p_materiales',
                  'texto', 'Respecto de los materiales (bolso y manuales): 1- ¿Los recibiste completos y a tiempo? 2- ¿Se produjo alguna rotura o extravío? ¿Pusiste el aviso en el Bolso? 3- ¿A quién entregás el Bolso?'
                ),
                COALESCE(
                  (SELECT x.ord - 0.5
                     FROM jsonb_array_elements(t.preguntas_informe) WITH ORDINALITY AS x(elem, ord)
                    WHERE x.elem->>'id' = 'p7'
                    LIMIT 1),
                  1000000
                )
       ) s
   )
 WHERE t.categoria = 'convivencia'
   AND jsonb_typeof(t.preguntas_informe) = 'array'
   AND jsonb_array_length(t.preguntas_informe) > 0
   AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(t.preguntas_informe) AS y(elem)
      WHERE y.elem->>'id' = 'p_materiales'
   );

COMMIT;

-- Verificación:
-- SELECT tipo, count(*) FROM public.evento_informes_cierre GROUP BY tipo;   -- sin 'coordinador'
-- SELECT nombre, jsonb_path_query_array(preguntas_informe, '$[*].id') FROM public.tipos_eventos WHERE categoria = 'convivencia';

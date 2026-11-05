-- ============================================================
-- Migración 103: Coordinadores por Tipo de Evento (card #47).
--
-- Al solicitar / discernir / publicar un evento, el desplegable de
-- coordinador muestra solamente a quienes están habilitados para coordinar
-- ESE tipo de evento (y ya no hay "Otro…" para elegir a cualquiera).
--
-- Dónde se carga: en la asignación del ministerio Coordinador (COOR), en
-- /ministerios/asignaciones, se tildan los tipos de evento que cubre. Queda
-- colgado de la asignación, así que respeta el historial: si la asignación se
-- cierra (fecha_fin / inactivo), deja de habilitar sin borrar nada.
--
-- Regla: coordinador habilitado para el tipo T =
--   asignación COOR con estado 'activo' y fecha_fin IS NULL
--   + una fila en asignacion_ministerio_tipos_evento con tipo_evento_id = T.
-- Una asignación COOR sin tipos tildados no habilita para ningún tipo.
--
-- Backfill: a cada asignación COOR vigente se le tildan los tipos de evento
-- que esa persona ya coordinó (eventos.coordinador_asignado_id). El resto lo
-- tiene que cargar la CCD desde Ministerios › Asignaciones.
--
-- Depende de 003, 015, 023, 047, 083. Idempotente.
-- ============================================================

BEGIN;

-- ─── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asignacion_ministerio_tipos_evento (
  asignacion_id  UUID NOT NULL REFERENCES public.asignaciones_ministerio(id) ON DELETE CASCADE,
  tipo_evento_id UUID NOT NULL REFERENCES public.tipos_eventos(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asignacion_id, tipo_evento_id)
);

CREATE INDEX IF NOT EXISTS idx_asig_min_tipos_evento_tipo
  ON public.asignacion_ministerio_tipos_evento (tipo_evento_id);

-- ─── 2. RLS: igual que asignaciones_ministerio (usuarios internos, 083) ──────
ALTER TABLE public.asignacion_ministerio_tipos_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asig_min_tipos_select" ON public.asignacion_ministerio_tipos_evento;
CREATE POLICY "asig_min_tipos_select"
  ON public.asignacion_ministerio_tipos_evento FOR SELECT TO authenticated
  USING ((SELECT public.es_usuario_interno()));

DROP POLICY IF EXISTS "asig_min_tipos_insert" ON public.asignacion_ministerio_tipos_evento;
CREATE POLICY "asig_min_tipos_insert"
  ON public.asignacion_ministerio_tipos_evento FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.es_usuario_interno()));

-- Quitar un tipo tildado no es borrar historia institucional: la asignación
-- sigue y su historial (fecha_inicio / fecha_fin) no se toca.
DROP POLICY IF EXISTS "asig_min_tipos_delete" ON public.asignacion_ministerio_tipos_evento;
CREATE POLICY "asig_min_tipos_delete"
  ON public.asignacion_ministerio_tipos_evento FOR DELETE TO authenticated
  USING ((SELECT public.es_usuario_interno()));

-- ─── 3. Backfill desde los eventos ya coordinados ────────────────────────────
INSERT INTO public.asignacion_ministerio_tipos_evento (asignacion_id, tipo_evento_id)
SELECT DISTINCT am.id, e.tipo_evento_id
  FROM public.asignaciones_ministerio am
  JOIN public.ministerios m ON m.id = am.ministerio_id AND m.codigo_interno = 'COOR'
  JOIN public.eventos e     ON e.coordinador_asignado_id = am.persona_id
 WHERE am.estado = 'activo'
   AND am.fecha_fin IS NULL
   AND e.tipo_evento_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;

-- ─── Verificación (correr aparte) ────────────────────────────────────────────
-- Coordinadores vigentes y cuántos tipos tienen tildados (0 = no aparecen en
-- ningún desplegable hasta que la CCD les cargue los tipos):
--
-- SELECT p.apellido, p.nombre, COUNT(t.tipo_evento_id) AS tipos
--   FROM public.asignaciones_ministerio am
--   JOIN public.ministerios m ON m.id = am.ministerio_id AND m.codigo_interno = 'COOR'
--   JOIN public.personas p    ON p.id = am.persona_id
--   LEFT JOIN public.asignacion_ministerio_tipos_evento t ON t.asignacion_id = am.id
--  WHERE am.estado = 'activo' AND am.fecha_fin IS NULL
--  GROUP BY p.apellido, p.nombre
--  ORDER BY tipos, p.apellido;

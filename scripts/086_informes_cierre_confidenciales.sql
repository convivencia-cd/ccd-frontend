-- ============================================================
-- MIGRACIÓN 086: Informes confidenciales del cierre en tabla propia
--
-- Problema: el Informe del Coordinador y el Informe de Carismas (052) viven
-- en columnas JSONB de `eventos` (informe_coordinador_respuestas,
-- informe_carismas). Desde 083 cualquier usuario interno puede leer
-- `eventos`, así que cualquier cecista podía leerlos desde el navegador
-- (anon key + su sesión) aunque la pantalla los ocultara.
--
-- Solución:
--   1. Tabla `evento_informes_cierre` con RLS habilitada y SIN políticas:
--      ni `anon` ni `authenticated` pueden leerla ni escribirla. Solo se
--      accede desde el servidor con service role, después de chequear
--      permisos en código (lib/eventos/informes-cierre.ts).
--   2. Se copian los informes ya cargados y se vacían las columnas viejas
--      de `eventos` (quedan como legacy, sin uso).
--   3. Permisos nuevos de catálogo para ver los informes. No se asignan a
--      ningún ministerio — lo decide el Equipo Timón desde
--      /ministerios/catalogo/[id]. Solo admin_general los recibe (mismo
--      patrón que 071/073). El coordinador del evento los ve y completa sin
--      necesitar permiso (rol scoped a evento, se resuelve en código).
--
-- Tipos de informe:
--   carismas      una fila por servidor evaluado (persona_id), contenido {"texto"}
--   coordinador   el informe único actual, contenido {"<pregunta_id>": "respuesta"}
--   responsables  (reservado) informe de la CcD para Responsables / Delegados EqT
--   eqt           (reservado) informe de la CcD para Equipo Timón
--
-- ANTES DE CORRER: ver cuántos informes hay cargados (para comparar después):
--   SELECT count(*) FILTER (WHERE jsonb_typeof(informe_coordinador_respuestas) = 'object'
--                             AND informe_coordinador_respuestas <> '{}'::jsonb) AS coordinador,
--          count(*) FILTER (WHERE jsonb_typeof(informe_carismas) = 'array'
--                             AND informe_carismas <> '[]'::jsonb) AS eventos_con_carismas
--     FROM public.eventos;
--
-- Idempotente. Todo en una transacción: si la verificación de la copia
-- falla, se revierte todo y no se vacía nada.
-- ============================================================

BEGIN;

-- ─── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evento_informes_cierre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('carismas', 'coordinador', 'responsables', 'eqt')),
  -- Servidor evaluado (solo carismas)
  persona_id UUID REFERENCES public.personas(id),
  contenido JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.personas(id),
  updated_by UUID REFERENCES public.personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evento_informes_cierre_persona_check CHECK (
    (tipo = 'carismas' AND persona_id IS NOT NULL) OR
    (tipo <> 'carismas' AND persona_id IS NULL)
  )
);

-- Un informe de cada tipo por evento; un carisma por servidor por evento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_informes_cierre_informe
  ON public.evento_informes_cierre (evento_id, tipo) WHERE persona_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_informes_cierre_carisma
  ON public.evento_informes_cierre (evento_id, tipo, persona_id) WHERE persona_id IS NOT NULL;

-- ─── 2. RLS cerrada ──────────────────────────────────────────────────────────
-- Sin políticas = nadie con anon/authenticated accede. service_role bypassea RLS.
ALTER TABLE public.evento_informes_cierre ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evento_informes_cierre FROM anon, authenticated;
GRANT ALL ON public.evento_informes_cierre TO service_role;

-- ─── 3. Copia de los informes existentes ─────────────────────────────────────
INSERT INTO public.evento_informes_cierre (evento_id, tipo, contenido)
SELECT e.id, 'coordinador', e.informe_coordinador_respuestas
  FROM public.eventos e
 WHERE jsonb_typeof(e.informe_coordinador_respuestas) = 'object'
   AND e.informe_coordinador_respuestas <> '{}'::jsonb
ON CONFLICT DO NOTHING;

-- Carismas: [{persona_id, texto}] → una fila por servidor. Se saltean las
-- entradas sin texto. El persona_id se resuelve por JOIN como texto (sin cast
-- sobre el dato guardado, así un valor mal formado no rompe la migración: lo
-- detecta la verificación de abajo).
INSERT INTO public.evento_informes_cierre (evento_id, tipo, persona_id, contenido)
SELECT e.id, 'carismas', p.id, jsonb_build_object('texto', item->>'texto')
  FROM public.eventos e
 CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(e.informe_carismas) = 'array' THEN e.informe_carismas ELSE '[]'::jsonb END
       ) AS item
  JOIN public.personas p ON p.id::text = item->>'persona_id'
 WHERE COALESCE(btrim(item->>'texto'), '') <> ''
ON CONFLICT DO NOTHING;

-- ─── 4. Verificación antes de vaciar ─────────────────────────────────────────
-- Aborta (y revierte todo) si: algún informe tiene una forma inesperada, o
-- alguna respuesta con texto no quedó copiada.
DO $$
DECLARE
  formas_raras INT;
  faltan_coord INT;
  faltan_carismas INT;
BEGIN
  SELECT count(*) INTO formas_raras
    FROM public.eventos e
   WHERE (e.informe_coordinador_respuestas IS NOT NULL
          AND jsonb_typeof(e.informe_coordinador_respuestas) NOT IN ('object', 'null'))
      OR (e.informe_carismas IS NOT NULL
          AND jsonb_typeof(e.informe_carismas) NOT IN ('array', 'null'));

  SELECT count(*) INTO faltan_coord
    FROM public.eventos e
   WHERE jsonb_typeof(e.informe_coordinador_respuestas) = 'object'
     AND e.informe_coordinador_respuestas <> '{}'::jsonb
     AND NOT EXISTS (
       SELECT 1 FROM public.evento_informes_cierre i
        WHERE i.evento_id = e.id AND i.tipo = 'coordinador'
          AND i.contenido = e.informe_coordinador_respuestas
     );

  -- Toda entrada con texto tiene que tener su fila (incluye persona_id vacío,
  -- mal formado o de una persona que no existe: esos NO se copiaron → aborta).
  SELECT count(*) INTO faltan_carismas
    FROM public.eventos e
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(e.informe_carismas) = 'array' THEN e.informe_carismas ELSE '[]'::jsonb END
         ) AS item
   WHERE COALESCE(btrim(item->>'texto'), '') <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.evento_informes_cierre i
        WHERE i.evento_id = e.id AND i.tipo = 'carismas'
          AND i.persona_id::text = item->>'persona_id'
          AND i.contenido->>'texto' = item->>'texto'
     );

  IF formas_raras > 0 OR faltan_coord > 0 OR faltan_carismas > 0 THEN
    RAISE EXCEPTION 'Copia incompleta (formato inesperado: %, coordinador sin copiar: %, carismas sin copiar: %). Se revierte todo, no se vació nada.',
      formas_raras, faltan_coord, faltan_carismas;
  END IF;
END $$;

-- ─── 5. Vaciar las columnas viejas (quedan legacy, sin uso) ──────────────────
UPDATE public.eventos
   SET informe_coordinador_respuestas = NULL,
       informe_carismas = NULL
 WHERE informe_coordinador_respuestas IS NOT NULL
    OR informe_carismas IS NOT NULL;

-- ─── 6. Permisos de catálogo ─────────────────────────────────────────────────
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('cierre.view_carismas',
   'Ver Informe de Carismas',
   'Permite ver (solo lectura) el Informe de Carismas del equipo de servidores en el cierre de los eventos de la propia organización. Lo completa únicamente el coordinador del evento, que lo ve sin necesitar este permiso.',
   'eventos'),
  ('cierre.view_informe_responsables',
   'Ver Informe de la CcD para Responsables',
   'Permite ver (solo lectura) el informe de cierre que completa el coordinador para Responsables y Delegados EqT, en los eventos de la propia organización.',
   'eventos'),
  ('cierre.view_informe_eqt',
   'Ver Informe de la CcD para Equipo Timón',
   'Permite ver (solo lectura) el informe de cierre que completa el coordinador para el Equipo Timón.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
  FROM public.roles_sistema rs
 CROSS JOIN public.permisos p
 WHERE rs.nombre = 'admin_general'
   AND p.clave IN ('cierre.view_carismas', 'cierre.view_informe_responsables', 'cierre.view_informe_eqt')
ON CONFLICT DO NOTHING;

COMMIT;

-- Verificación:
-- SELECT tipo, count(*) FROM public.evento_informes_cierre GROUP BY tipo;
-- SELECT count(*) FROM public.eventos WHERE informe_coordinador_respuestas IS NOT NULL OR informe_carismas IS NOT NULL;  -- 0
-- Con una sesión de cecista (no service role) esto debe fallar por permisos:
--   SELECT * FROM public.evento_informes_cierre;

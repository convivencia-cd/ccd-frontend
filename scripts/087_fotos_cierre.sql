-- ============================================================
-- MIGRACIÓN 087: Fotos del cierre como galería + permiso cierre.upload_fotos
--
-- Contexto (tarjetas #43/#44): al finalizar la convivencia el centralizador
-- adjunta fotos (mínimo 3: todos, equipo, equipo auxiliar…). Hasta ahora
-- había 2 lugares fijos (eventos.cierre_foto_convivencia_url /
-- cierre_foto_servidores_url, de 052).
--
--   1. Tabla evento_fotos_cierre: una fila por foto. Baja lógica
--      (eliminado_at/eliminado_por), nunca DELETE. El archivo queda en el
--      bucket público `eventos-cierre` (se ve con el link, como hasta ahora).
--   2. Lectura: usuarios internos. Escritura: solo desde el servidor
--      (service role) en /api/eventos/[id]/fotos, que chequea permisos.
--   3. Se copian las 2 fotos existentes. Las columnas viejas quedan legacy.
--   4. Permiso de catálogo cierre.upload_fotos (scopeado a la organización).
--      El centralizador del evento sube fotos de SU evento sin necesitarlo
--      (rol scoped a evento, se resuelve en código). No se asigna a ningún
--      ministerio — lo decide el Equipo Timón desde /ministerios/catalogo/[id].
--
-- Requiere 083 (es_usuario_interno). Idempotente.
-- ============================================================

BEGIN;

-- ─── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evento_fotos_cierre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  descripcion TEXT,
  created_by UUID REFERENCES public.personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eliminado_at TIMESTAMPTZ,
  eliminado_por UUID REFERENCES public.personas(id)
);

CREATE INDEX IF NOT EXISTS idx_evento_fotos_cierre_evento
  ON public.evento_fotos_cierre (evento_id) WHERE eliminado_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_fotos_cierre_path
  ON public.evento_fotos_cierre (storage_path);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.evento_fotos_cierre ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evento_fotos_cierre FROM anon, authenticated;
GRANT SELECT ON public.evento_fotos_cierre TO authenticated;
GRANT ALL ON public.evento_fotos_cierre TO service_role;

DROP POLICY IF EXISTS evento_fotos_cierre_select_internos ON public.evento_fotos_cierre;
CREATE POLICY evento_fotos_cierre_select_internos
  ON public.evento_fotos_cierre
  FOR SELECT
  TO authenticated
  USING (public.es_usuario_interno());

-- ─── 3. Copia de las fotos existentes ────────────────────────────────────────
INSERT INTO public.evento_fotos_cierre (evento_id, storage_path, url, descripcion, created_by)
SELECT e.id, e.id::text || '/convivencia', e.cierre_foto_convivencia_url, 'Foto de la Convivencia', e.cerrado_por
  FROM public.eventos e
 WHERE e.cierre_foto_convivencia_url IS NOT NULL AND e.cierre_foto_convivencia_url <> ''
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.evento_fotos_cierre (evento_id, storage_path, url, descripcion, created_by)
SELECT e.id, e.id::text || '/servidores', e.cierre_foto_servidores_url, 'Foto del Equipo de Servidores', e.cerrado_por
  FROM public.eventos e
 WHERE e.cierre_foto_servidores_url IS NOT NULL AND e.cierre_foto_servidores_url <> ''
ON CONFLICT (storage_path) DO NOTHING;

-- ─── 4. Permiso de catálogo ──────────────────────────────────────────────────
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('cierre.upload_fotos',
   'Adjuntar fotos del cierre',
   'Permite subir y quitar las fotos del cierre de los eventos de la propia organización mientras el evento está finalizado. El centralizador del evento puede hacerlo sin necesitar este permiso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
  FROM public.roles_sistema rs
 CROSS JOIN public.permisos p
 WHERE rs.nombre = 'admin_general'
   AND p.clave = 'cierre.upload_fotos'
ON CONFLICT DO NOTHING;

COMMIT;

-- Verificación:
-- SELECT count(*) FROM public.evento_fotos_cierre;
-- SELECT count(*) FILTER (WHERE cierre_foto_convivencia_url IS NOT NULL)
--      + count(*) FILTER (WHERE cierre_foto_servidores_url IS NOT NULL) FROM public.eventos;  -- debe coincidir

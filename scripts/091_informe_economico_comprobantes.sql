-- Comprobante opcional de cada movimiento del Informe Económico.
-- Se guarda el path privado y el nombre original para mostrarlo en el registro.
ALTER TABLE public.evento_movimientos
  ADD COLUMN IF NOT EXISTS comprobante_path TEXT,
  ADD COLUMN IF NOT EXISTS comprobante_nombre TEXT;

ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_comprobante_par_check;
ALTER TABLE public.evento_movimientos
  ADD CONSTRAINT evento_movimientos_comprobante_par_check CHECK (
    (comprobante_path IS NULL AND comprobante_nombre IS NULL) OR
    (comprobante_path IS NOT NULL AND comprobante_nombre IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_movimientos_comprobante
  ON public.evento_movimientos (comprobante_path)
  WHERE comprobante_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'informe-economico-comprobantes',
  'informe-economico-comprobantes',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- El servidor firma las subidas y lecturas después de verificar el permiso
-- sobre el evento. No se concede acceso directo a storage.objects.

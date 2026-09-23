-- 044_interesado_seguimiento.sql
-- Seguimiento de contacto de interesados por parte del centralizador.
-- Agrega a evento_participantes el estado de contacto, medio, fecha automática,
-- nota libre y quién registró el contacto. Todas nullable / con default: no rompe datos existentes.

BEGIN;

ALTER TABLE public.evento_participantes
  -- Vocabulario reducido a 3 estados por 080_interesado_estados_contacto.sql
  -- (antes: no_contactado / contactado / sin_respuesta / confirmo / declino).
  ADD COLUMN IF NOT EXISTS estado_contacto TEXT NOT NULL DEFAULT 'no_contactado'
    CHECK (estado_contacto IN ('no_contactado', 'confirmado', 'cancelado')),
  ADD COLUMN IF NOT EXISTS medio_contacto TEXT
    CHECK (medio_contacto IN ('telefono', 'email', 'whatsapp', 'personal', 'otro')),
  ADD COLUMN IF NOT EXISTS fecha_contacto TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notas_seguimiento TEXT,
  ADD COLUMN IF NOT EXISTS contactado_por UUID REFERENCES public.personas(id);

CREATE INDEX IF NOT EXISTS idx_ep_estado_contacto ON public.evento_participantes(estado_contacto);

COMMIT;

-- ============================================================
-- Migración 102: devoluciones de Mercado Pago como ingreso + egreso en el
-- Informe Económico (card #104, reunión con Coti).
--
-- Antes (082/089): si un pago de MP pasaba a `reembolsado`, se ANULABA su
-- ingreso y la devolución solo se veía con "Mostrar anulados". Contablemente
-- tiene que quedar el debe y el haber: entró la plata y después salió.
--
-- Ahora:
--   - confirmado  → ingreso (igual que antes).
--   - reembolsado → el ingreso queda y se suma un EGRESO por el mismo monto,
--                   misma categoría (Inscripciones / Pensiones), medio MP.
--   - rechazado   → el ingreso se anula (igual que antes: la plata nunca entró).
--
-- El egreso lleva el mismo pago_id que el ingreso, así la pantalla lo trata
-- como "registrado automáticamente desde Mercado Pago" (monto y tipo fijos).
-- Para eso el índice único pasa de (pago_id) a (pago_id, tipo).
--
-- Backfill: las devoluciones que ya estaban como ingreso anulado se reabren y
-- se les suma el egreso. Hoy es 1 (Mancini, Silvana — $18.000).
--
-- Depende de 052, 081, 082, 089. Idempotente.
-- ============================================================

BEGIN;

-- ─── 1. Índice: un ingreso y un egreso por pago ──────────────────────────────
DROP INDEX IF EXISTS public.uq_evento_movimientos_pago;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_movimientos_pago_tipo
  ON public.evento_movimientos (pago_id, tipo) WHERE pago_id IS NOT NULL;

-- ─── 2. Trigger (mismo nombre que 082/089: se reemplaza el cuerpo) ──────────
CREATE OR REPLACE FUNCTION public.ie_sync_inscripcion_mp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento_id UUID;
  v_persona TEXT;
  v_categoria TEXT;
  v_etiqueta TEXT;
BEGIN
  IF NEW.medio_pago IS DISTINCT FROM 'mercadopago' OR NEW.concepto NOT IN ('inscripcion', 'pension') THEN
    RETURN NEW;
  END IF;

  IF NEW.concepto = 'pension' THEN
    v_categoria := 'Pensiones';
    v_etiqueta := 'Pensión';
  ELSE
    v_categoria := 'Inscripciones';
    v_etiqueta := 'Inscripción';
  END IF;

  IF NEW.estado_pago IN ('confirmado', 'reembolsado') THEN
    SELECT ep.evento_id, per.apellido || ', ' || per.nombre
      INTO v_evento_id, v_persona
    FROM public.evento_participantes ep
    LEFT JOIN public.personas per ON per.id = ep.persona_id
    WHERE ep.id = NEW.evento_participante_id;

    IF v_evento_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- El ingreso (si el aviso de confirmado no llegó, se registra igual).
    INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
    VALUES (
      v_evento_id, 'ingreso', 'mp', v_categoria, NEW.id,
      COALESCE(v_etiqueta || ' — ' || v_persona, v_etiqueta),
      COALESCE(NEW.monto, 0),
      (COALESCE(NEW.fecha_pago, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    )
    ON CONFLICT (pago_id, tipo) WHERE pago_id IS NOT NULL DO NOTHING;

    IF NEW.estado_pago = 'reembolsado' THEN
      -- Un ingreso anulado por la versión anterior de este trigger se reabre.
      UPDATE public.evento_movimientos
      SET anulado_at = NULL, anulado_por = NULL, motivo_anulacion = NULL, updated_at = now()
      WHERE pago_id = NEW.id AND tipo = 'ingreso'
        AND motivo_anulacion = 'Pago reembolsado en Mercado Pago';

      INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
      VALUES (
        v_evento_id, 'egreso', 'mp', v_categoria, NEW.id,
        COALESCE('Devolución ' || lower(v_etiqueta) || ' — ' || v_persona, 'Devolución ' || lower(v_etiqueta)),
        COALESCE(NEW.monto, 0),
        (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      )
      ON CONFLICT (pago_id, tipo) WHERE pago_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF NEW.estado_pago = 'rechazado' THEN
    UPDATE public.evento_movimientos
    SET anulado_at = now(),
        motivo_anulacion = 'Pago rechazado en Mercado Pago',
        updated_at = now()
    WHERE pago_id = NEW.id
      AND anulado_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. Backfill: devoluciones ya registradas como ingreso anulado ──────────
UPDATE public.evento_movimientos m
SET anulado_at = NULL, anulado_por = NULL, motivo_anulacion = NULL, updated_at = now()
FROM public.pagos p
WHERE m.pago_id = p.id
  AND m.tipo = 'ingreso'
  AND p.estado_pago = 'reembolsado'
  AND m.motivo_anulacion = 'Pago reembolsado en Mercado Pago';

INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
SELECT
  m.evento_id, 'egreso', 'mp', m.categoria, p.id,
  'Devolución ' || CASE p.concepto WHEN 'pension' THEN 'pensión' ELSE 'inscripción' END
    || COALESCE(' — ' || per.apellido || ', ' || per.nombre, ''),
  COALESCE(p.monto, 0),
  (COALESCE(p.updated_at, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
FROM public.pagos p
JOIN public.evento_movimientos m ON m.pago_id = p.id AND m.tipo = 'ingreso'
LEFT JOIN public.evento_participantes ep ON ep.id = p.evento_participante_id
LEFT JOIN public.personas per ON per.id = ep.persona_id
WHERE p.estado_pago = 'reembolsado'
  AND p.medio_pago = 'mercadopago'
  AND p.concepto IN ('inscripcion', 'pension')
ON CONFLICT (pago_id, tipo) WHERE pago_id IS NOT NULL DO NOTHING;

COMMIT;

-- ============================================================
-- MIGRACIÓN 082: Inscripciones de Mercado Pago → Informe Económico (automático)
--
-- 1. FIX: la base tiene la coherencia ingreso/egreso de 052 con el nombre
--    `evento_movimientos_tipo_coherencia_check` (no `..._tipo_check`, que es
--    el que borraba 081). Exige subtipo_ingreso/categoria_egreso, que el
--    Informe Económico ya no usa (ahora es medio + categoria) → todo INSERT
--    nuevo fallaba con "violates check constraint".
--
-- 2. Automático: cada pago de INSCRIPCIÓN por MERCADO PAGO que queda
--    `confirmado` se registra solo como ingreso en el libro MP del evento
--    (categoría "Inscripciones"). Se hace con un trigger sobre `pagos` para
--    que cubra cualquier camino (webhook de MP, verificación manual, etc.).
--    Si el pago después pasa a rechazado/reembolsado, el movimiento se anula
--    (baja lógica, nunca DELETE). Idempotente vía uq_evento_movimientos_pago.
--
-- 3. Backfill: registra las inscripciones MP ya confirmadas.
--
-- Depende de 052 + 081. Idempotente.
-- ============================================================

-- ─── 1. Constraint legacy ───────────────────────────────────────────────────
ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_tipo_coherencia_check;
ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_tipo_check;

-- ─── 2. Trigger ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ie_sync_inscripcion_mp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento_id UUID;
  v_persona TEXT;
BEGIN
  IF NEW.concepto IS DISTINCT FROM 'inscripcion' OR NEW.medio_pago IS DISTINCT FROM 'mercadopago' THEN
    RETURN NEW;
  END IF;

  IF NEW.estado_pago = 'confirmado' THEN
    SELECT ep.evento_id, per.apellido || ', ' || per.nombre
      INTO v_evento_id, v_persona
    FROM public.evento_participantes ep
    LEFT JOIN public.personas per ON per.id = ep.persona_id
    WHERE ep.id = NEW.evento_participante_id;

    IF v_evento_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
    VALUES (
      v_evento_id,
      'ingreso',
      'mp',
      'Inscripciones',
      NEW.id,
      COALESCE('Inscripción — ' || v_persona, 'Inscripción'),
      COALESCE(NEW.monto, 0),
      (COALESCE(NEW.fecha_pago, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    )
    ON CONFLICT (pago_id) WHERE pago_id IS NOT NULL DO NOTHING;

  ELSIF NEW.estado_pago IN ('rechazado', 'reembolsado') THEN
    UPDATE public.evento_movimientos
    SET anulado_at = now(),
        motivo_anulacion = 'Pago ' || NEW.estado_pago || ' en Mercado Pago',
        updated_at = now()
    WHERE pago_id = NEW.id
      AND anulado_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagos_ie_sync_inscripcion_mp ON public.pagos;
CREATE TRIGGER pagos_ie_sync_inscripcion_mp
  AFTER INSERT OR UPDATE OF estado_pago, medio_pago, concepto ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.ie_sync_inscripcion_mp();

-- ─── 3. Backfill ────────────────────────────────────────────────────────────
INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
SELECT
  ep.evento_id,
  'ingreso',
  'mp',
  'Inscripciones',
  p.id,
  COALESCE('Inscripción — ' || per.apellido || ', ' || per.nombre, 'Inscripción'),
  COALESCE(p.monto, 0),
  (COALESCE(p.fecha_pago, p.created_at, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
FROM public.pagos p
JOIN public.evento_participantes ep ON ep.id = p.evento_participante_id
LEFT JOIN public.personas per ON per.id = ep.persona_id
WHERE p.concepto = 'inscripcion'
  AND p.medio_pago = 'mercadopago'
  AND p.estado_pago = 'confirmado'
ON CONFLICT (pago_id) WHERE pago_id IS NOT NULL DO NOTHING;

-- Verificación:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.evento_movimientos'::regclass;
-- SELECT m.evento_id, m.concepto, m.monto, m.fecha FROM public.evento_movimientos m WHERE m.categoria = 'Inscripciones' AND m.medio = 'mp';

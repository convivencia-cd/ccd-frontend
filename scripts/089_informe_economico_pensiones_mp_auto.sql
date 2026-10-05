-- ============================================================
-- MIGRACIÓN 089: Pensiones de Mercado Pago → Informe Económico (automático)
--
-- Extiende el trigger de 082 (que solo cubría INSCRIPCIONES por Mercado Pago)
-- para que también registre los pagos de PENSIÓN por MERCADO PAGO confirmados
-- como ingreso en el libro MP del evento (categoría "Pensiones").
--
-- Efectivo y transferencia siguen cargándose a mano en el Informe Económico,
-- igual que las inscripciones: solo se automatiza lo que entra por MP.
--
-- Se reemplaza el cuerpo de la función (mismo nombre y mismo trigger), así que
-- no hay que tocar el trigger. Idempotente vía uq_evento_movimientos_pago.
--
-- Depende de 052 + 060 + 081 + 082.
-- ============================================================

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
      v_categoria,
      NEW.id,
      COALESCE(v_etiqueta || ' — ' || v_persona, v_etiqueta),
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

-- ─── Backfill (OPCIONAL) ────────────────────────────────────────────────────
-- Registra las pensiones MP ya confirmadas. Está comentado a propósito: si
-- alguna de esas pensiones ya se cargó A MANO en el Informe Económico, correr
-- esto la duplicaría. Revisar primero con la consulta de abajo.
--
-- SELECT p.id, ep.evento_id, p.monto, p.fecha_pago
-- FROM public.pagos p
-- JOIN public.evento_participantes ep ON ep.id = p.evento_participante_id
-- WHERE p.concepto = 'pension' AND p.medio_pago = 'mercadopago' AND p.estado_pago = 'confirmado';
--
-- INSERT INTO public.evento_movimientos (evento_id, tipo, medio, categoria, pago_id, concepto, monto, fecha)
-- SELECT
--   ep.evento_id,
--   'ingreso',
--   'mp',
--   'Pensiones',
--   p.id,
--   COALESCE('Pensión — ' || per.apellido || ', ' || per.nombre, 'Pensión'),
--   COALESCE(p.monto, 0),
--   (COALESCE(p.fecha_pago, p.created_at, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
-- FROM public.pagos p
-- JOIN public.evento_participantes ep ON ep.id = p.evento_participante_id
-- LEFT JOIN public.personas per ON per.id = ep.persona_id
-- WHERE p.concepto = 'pension'
--   AND p.medio_pago = 'mercadopago'
--   AND p.estado_pago = 'confirmado'
-- ON CONFLICT (pago_id) WHERE pago_id IS NOT NULL DO NOTHING;

-- ============================================================
-- MIGRACIÓN 081: Informe Económico por evento (Caja / Banco / MP)
--
-- Contexto: el informe económico de cada evento se arma hoy en el Excel
-- "Base para IE (Nuevo 2025).xlsx" (hojas Registro + Informe Economico):
-- tres libros (CAJA, BANCO, MP) con saldo inicial + asientos
-- Concepto | Fecha | Descripción | Ingreso | Egreso, y un informe que
-- suma por concepto los tres medios, calcula Saldo y Diezmo al EqT (20%).
--
-- Esta migración extiende evento_movimientos (creada en 052, que es
-- prerequisito) para modelar ese registro:
--   · medio      caja | banco | mp
--   · categoria  concepto contable del Excel (lista cerrada en la app,
--                lib/eventos/informe-economico.ts)
--   · concepto   (ya existía) pasa a ser la "Descripción" libre
--   · baja lógica (anulado_at/anulado_por/motivo_anulacion) — nunca DELETE
--
-- En eventos: saldos iniciales por medio + observaciones del informe.
--
-- Permisos: solo cargan el informe el/los Centralizador(es) del evento
-- (se resuelve en código por eventos.centralizador_X_persona_id) y quien
-- tenga informe_economico.edit (Tesoreros de Confraternidad/Fraternidad).
-- informe_economico.view da lectura (asignable desde el catálogo).
--
-- Idempotente.
-- ============================================================

-- ─── 1. evento_movimientos: medio + categoría ───────────────────────────────
ALTER TABLE public.evento_movimientos
  ADD COLUMN IF NOT EXISTS medio TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulado_por UUID REFERENCES public.personas(id),
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill de medio: movimientos importados de pagos según pagos.medio_pago;
-- el resto se asume efectivo (caja).
UPDATE public.evento_movimientos m
SET medio = CASE p.medio_pago
              WHEN 'mercadopago' THEN 'mp'
              WHEN 'transferencia' THEN 'banco'
              ELSE 'caja'
            END
FROM public.pagos p
WHERE m.pago_id = p.id
  AND m.medio IS NULL;

UPDATE public.evento_movimientos SET medio = 'caja' WHERE medio IS NULL;

-- Backfill de categoría desde las columnas de 052 (subtipo_ingreso / categoria_egreso).
-- La categoría de egreso vieja (placeholder) se preserva en la descripción.
UPDATE public.evento_movimientos
SET categoria = CASE subtipo_ingreso
                  WHEN 'pago' THEN 'Pensiones'
                  WHEN 'otros_ingresos' THEN 'Aportes del Bolsillo de Dios'
                  WHEN 'donacion' THEN 'Donaciones'
                  ELSE 'Otros Ingresos'
                END
WHERE tipo = 'ingreso' AND categoria IS NULL;

UPDATE public.evento_movimientos
SET categoria = 'Otros Gastos',
    concepto = COALESCE(NULLIF(concepto, ''), categoria_egreso)
WHERE tipo = 'egreso' AND categoria IS NULL;

ALTER TABLE public.evento_movimientos
  ALTER COLUMN medio SET NOT NULL,
  ALTER COLUMN categoria SET NOT NULL;

ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_medio_check;
ALTER TABLE public.evento_movimientos
  ADD CONSTRAINT evento_movimientos_medio_check CHECK (medio IN ('caja', 'banco', 'mp'));

-- subtipo_ingreso / categoria_egreso quedan como columnas legacy (nullable, sin uso):
-- se saca la coherencia ingreso/egreso de 052 que las exigía.
ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_tipo_check;
-- En algunas bases la misma coherencia quedó con este nombre (ver 082).
ALTER TABLE public.evento_movimientos
  DROP CONSTRAINT IF EXISTS evento_movimientos_tipo_coherencia_check;

CREATE INDEX IF NOT EXISTS idx_evento_movimientos_evento_medio
  ON public.evento_movimientos (evento_id, medio, fecha);

-- ─── 2. eventos: saldos iniciales por medio + observaciones ─────────────────
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS ie_saldo_inicial_caja NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ie_saldo_inicial_banco NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ie_saldo_inicial_mp NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ie_observaciones TEXT;

ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_ie_saldos_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_ie_saldos_check CHECK (
    ie_saldo_inicial_caja >= 0 AND ie_saldo_inicial_banco >= 0 AND ie_saldo_inicial_mp >= 0
  );

-- ─── 3. Permisos ────────────────────────────────────────────────────────────
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('informe_economico.edit',
   'Cargar Informe Económico',
   'Permite cargar/editar/anular los movimientos (Caja, Banco, MP) del Informe Económico de los eventos de la propia organización (confraternidad/fraternidad). Pensado para Tesoreros. El/los Centralizador(es) de un evento puntual lo cargan sin necesitar este permiso.',
   'eventos'),
  ('informe_economico.view',
   'Ver Informe Económico',
   'Permite ver (solo lectura) el Informe Económico de los eventos de la propia organización. El Equipo Timón y los Responsables/Enlaces con aprobación de la organización ya lo ven sin este permiso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
FROM public.roles_sistema rs
CROSS JOIN public.permisos p
WHERE rs.nombre = 'admin_general'
  AND p.clave IN ('informe_economico.edit', 'informe_economico.view')
ON CONFLICT DO NOTHING;

-- Tesorero de Confraternidad / Tesorero de Fraternidad
INSERT INTO public.ministerio_permisos (ministerio_id, permiso_id)
SELECT m.id, p.id
FROM public.ministerios m
CROSS JOIN public.permisos p
WHERE m.codigo_interno IN ('TCONFRA', 'TFRATER')
  AND p.clave = 'informe_economico.edit'
ON CONFLICT DO NOTHING;

-- Verificación:
-- SELECT medio, categoria, tipo, count(*) FROM public.evento_movimientos GROUP BY 1,2,3 ORDER BY 1,2,3;
-- SELECT clave FROM public.permisos WHERE clave LIKE 'informe_economico.%';
-- SELECT m.nombre, p.clave FROM public.ministerio_permisos mp
--   JOIN public.ministerios m ON m.id = mp.ministerio_id
--   JOIN public.permisos p ON p.id = mp.permiso_id
--  WHERE p.clave LIKE 'informe_economico.%';

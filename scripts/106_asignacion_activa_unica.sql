-- ============================================================
-- Migración 106: una persona no puede tener dos asignaciones ACTIVAS del
-- mismo rol en la misma organización (card #124).
--
-- Sí puede tener el mismo rol en organizaciones distintas (p. ej. Delegado
-- de Fraternidad Dependiente del EqT en dos fraternidades: viene así de la
-- planilla importada y es correcto).
--
-- Paso 1: cierra los duplicados activos que ya existen. De cada grupo
--         (persona, rol, organización) queda activa la asignación más vieja
--         (created_at) y las demás pasan a inactivo, con fecha_fin y motivo.
--         No se borra nada: quedan en el historial.
--         Al 13/11/2026 son 2 casos: Pablo Medina (Timonel, Equipo Timón) y
--         Joaquín De Weert (admin_general, sin organización).
-- Paso 2: índice único parcial, solo sobre las activas. Una organización
--         NULL cuenta como un valor más (COALESCE), así que tampoco se puede
--         duplicar un rol "global".
--
-- Idempotente.
-- ============================================================

BEGIN;

-- Paso 1 ---------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY persona_id,
                   ministerio_id,
                   COALESCE(organizacion_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.asignaciones_ministerio
  WHERE estado = 'activo'
)
UPDATE public.asignaciones_ministerio a
SET estado     = 'inactivo',
    fecha_fin  = CURRENT_DATE,
    motivo_fin = 'Asignación duplicada: se mantiene la más antigua (card #124)'
FROM ranked r
WHERE a.id = r.id
  AND r.rn > 1;

-- Paso 2 ---------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_asignaciones_ministerio_activa
  ON public.asignaciones_ministerio (
    persona_id,
    ministerio_id,
    COALESCE(organizacion_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE estado = 'activo';

COMMENT ON INDEX public.uq_asignaciones_ministerio_activa IS
  'Card #124: una persona no puede tener el mismo rol activo dos veces en la misma organización.';

COMMIT;

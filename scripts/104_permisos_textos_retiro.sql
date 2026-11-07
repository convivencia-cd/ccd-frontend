-- ============================================================
-- Migración 104: en el catálogo de permisos, "evento" → "retiro" (card #107).
--
-- Solo cambia los textos visibles: permisos.nombre y permisos.descripcion.
-- NO toca permisos.clave (event.update, event.approve, ...) ni la categoría:
-- el código y las asignaciones de permisos dependen de esas claves.
--
-- Se respeta mayúscula/minúscula y singular/plural:
--   evento → retiro · eventos → retiros · Evento → Retiro · Eventos → Retiros
--   EVENTO → RETIRO · EVENTOS → RETIROS
-- \m y \M son límites de palabra: "evento_id" o "eventual" no se tocan.
--
-- Idempotente: una segunda corrida no encuentra nada para cambiar.
-- ============================================================

-- ─── Vista previa (correr aparte, ANTES): qué va a cambiar ───────────────────
-- SELECT clave, nombre, descripcion
--   FROM public.permisos
--  WHERE nombre ~* '\meventos?\M' OR descripcion ~* '\meventos?\M'
--  ORDER BY clave;

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.evento_a_retiro(t TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(t,
           '\mEVENTOS\M', 'RETIROS', 'g'),
           '\mEVENTO\M',  'RETIRO',  'g'),
           '\mEventos\M', 'Retiros', 'g'),
           '\mEvento\M',  'Retiro',  'g'),
           '\meventos\M', 'retiros', 'g'),
           '\mevento\M',  'retiro',  'g');
$$;

UPDATE public.permisos
   SET nombre      = pg_temp.evento_a_retiro(nombre),
       descripcion = pg_temp.evento_a_retiro(descripcion)
 WHERE nombre ~* '\meventos?\M'
    OR descripcion ~* '\meventos?\M';

COMMIT;

-- ─── Verificación (correr aparte, DESPUÉS): tiene que devolver 0 filas ──────
-- SELECT clave, nombre, descripcion
--   FROM public.permisos
--  WHERE nombre ~* '\meventos?\M' OR descripcion ~* '\meventos?\M';

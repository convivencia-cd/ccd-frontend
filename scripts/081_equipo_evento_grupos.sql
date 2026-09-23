-- ============================================================
-- Migración 081: Equipo del Evento en 3 áreas + Grupos de la convivencia
--
-- Minuta (#138): al ejecutarse una convivencia el Equipo del Evento se divide en
--
--   1. Centralizadores — hasta 3, ya existen como columnas de `eventos`
--      (centralizador_1..3_persona_id), se definen en la aprobación.
--   2. Servidores — Coordinador y Asesor (ya salen del discernimiento, columnas
--      coordinador_asignado_id / asesor_asignado_id), más dos roles nuevos:
--      Ministerio de Música (hasta 2 cecistas) y Servidor (a cargo de un grupo).
--   3. Equipo Auxiliar (Cocina) — ya existe el rol, admite cecistas y no cecistas.
--
-- Y los Grupos: en cada convivencia se arman grupos con 1 servidor a cargo y
-- varios conviventes. El nombre de cada grupo sale de un listado configurable
-- por tipo de evento (ej.: "Jerusalem").
--
-- Los topes que no son estructurales (máximo 2 en Música, que sean cecistas)
-- se validan en /api/eventos/[id]/participantes, no acá: dependen de un conteo
-- por evento y de personas.tipo_persona, y como reglas de negocio conviene que
-- devuelvan un mensaje entendible en la UI.
-- ============================================================

BEGIN;

-- ─── 1. Roles operativos nuevos en evento_participantes ──────────────────────
-- Se suman 'musica' y 'servidor' a los cinco que ya admitía el check (ver 003).
--
-- Se borran TODOS los checks que haya sobre rol_en_evento buscándolos por
-- catálogo, en vez de asumir el nombre (mismo patrón que 080). 002 lo creó
-- inline con nombre autogenerado y 003 lo recreó explícito: si en producción
-- quedó alguno con otro nombre, un DROP por nombre no lo encontraría y el
-- check viejo —más angosto— seguiría rechazando 'musica' y 'servidor'.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'evento_participantes'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%rol_en_evento%'
  LOOP
    EXECUTE format('ALTER TABLE public.evento_participantes DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.evento_participantes
  ADD CONSTRAINT evento_participantes_rol_en_evento_check
    CHECK (rol_en_evento IN (
      'convivente',
      'coordinador',
      'asesor',
      'centralizador',
      'musica',
      'servidor',
      'equipo_auxiliar'
    ));

-- ─── 2. Nombres de grupo configurables por tipo de evento ────────────────────
-- Mismo patrón que preguntas_informe (ver 052): lista JSON editable desde
-- /tipos-eventos/[id]/editar. Sin seed: la lista definitiva la carga la
-- Comunidad desde la UI.
ALTER TABLE public.tipos_eventos
  ADD COLUMN IF NOT EXISTS nombres_grupos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ─── 3. Grupos de cada evento ────────────────────────────────────────────────
-- El servidor a cargo apunta a evento_participantes (no a personas) para que
-- por construcción sea alguien que ya está cargado en ESTE evento.
CREATE TABLE IF NOT EXISTS public.evento_grupos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id               UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  nombre                  TEXT NOT NULL,
  servidor_participante_id UUID REFERENCES public.evento_participantes(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  -- Un nombre del listado no se repite dentro del mismo evento.
  UNIQUE (evento_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_evento_grupos_evento ON public.evento_grupos(evento_id);

ALTER TABLE public.evento_grupos ENABLE ROW LEVEL SECURITY;

-- Mismo patrón permisivo que evento_participantes (ver 002): la autorización
-- fina la hace la ruta de API con canPerform().
DROP POLICY IF EXISTS "evento_grupos_select_auth" ON public.evento_grupos;
DROP POLICY IF EXISTS "evento_grupos_insert_auth" ON public.evento_grupos;
DROP POLICY IF EXISTS "evento_grupos_update_auth" ON public.evento_grupos;
DROP POLICY IF EXISTS "evento_grupos_delete_auth" ON public.evento_grupos;

CREATE POLICY "evento_grupos_select_auth" ON public.evento_grupos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "evento_grupos_insert_auth" ON public.evento_grupos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "evento_grupos_update_auth" ON public.evento_grupos
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "evento_grupos_delete_auth" ON public.evento_grupos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── 4. Cada convivente va a un solo grupo ───────────────────────────────────
-- Si se borra el grupo, los conviventes quedan sin asignar (no se pierden).
ALTER TABLE public.evento_participantes
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.evento_grupos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ep_grupo ON public.evento_participantes(grupo_id);

COMMIT;

-- Rollback, si la Comunidad da de baja la idea de Grupos. Nada de esto toca
-- datos preexistentes, así que revertirlo no pierde nada más que los grupos
-- que se hayan cargado. Los roles 'musica' y 'servidor' pueden quedar: sumarlos
-- al check es inofensivo aunque no se usen.
--   BEGIN;
--   ALTER TABLE public.evento_participantes DROP COLUMN IF EXISTS grupo_id;
--   DROP TABLE IF EXISTS public.evento_grupos;
--   ALTER TABLE public.tipos_eventos DROP COLUMN IF EXISTS nombres_grupos;
--   COMMIT;

-- Verificación:
-- SELECT nombre, jsonb_array_length(nombres_grupos) FROM public.tipos_eventos WHERE activo;
-- SELECT rol_en_evento, count(*) FROM public.evento_participantes GROUP BY 1 ORDER BY 2 DESC;
-- SELECT g.nombre, count(p.id) AS conviventes
--   FROM public.evento_grupos g
--   LEFT JOIN public.evento_participantes p ON p.grupo_id = g.id
--  GROUP BY g.id, g.nombre;

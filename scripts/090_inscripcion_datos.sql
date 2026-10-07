-- ============================================================
-- MIGRACIÓN 090: Datos de la inscripción a las convivencias
--
-- Card #42 punto 5 ("Agregar más datos en la inscripción", Excel de Coti
-- "Datos para Inscribirse VERIFICADO"). El paso "Tus datos" del link público
-- /pago/[id] pasa de 10 a ~27 campos.
--
-- Dos destinos, según de quién es el dato:
--
--   1. De la PERSONA (no cambian de un evento a otro) → columnas nuevas en
--      `personas`: sexo, formación religiosa, participación en grupos de la
--      Iglesia y acción social. El resto de los datos personales del Excel
--      (apodo, estado civil, nacionalidad, estudios, ocupación, estado
--      eclesial, diócesis) ya existían.
--
--   2. De ESA INSCRIPCIÓN (cambian en cada evento) → tabla nueva
--      `evento_inscripcion_datos`, una fila por evento_participantes:
--      acompañante, dificultad de horario, cómo se enteró, familiar que hizo
--      convivencias, restricciones alimentarias, detalle de dieta y
--      observaciones de salud.
--
--   Las convivencias/retiros/talleres realizados NO van acá: son de la persona
--   y ya tienen tabla desde 050 (persona_eventos_realizados), la misma que
--   llena el perfil del cecista.
--
-- La tabla nueva guarda datos de salud, así que sigue el patrón de 086:
-- RLS habilitada y SIN políticas. Ni `anon` ni `authenticated` la leen ni la
-- escriben; solo el servidor con service role, después de chequear permisos
-- en código (lib/eventos/inscripcion-datos.ts).
--
-- Permiso nuevo de catálogo `inscripcion.view_datos_sensibles` para ver la
-- dieta y las observaciones de salud. No se asigna a ningún ministerio: lo
-- decide el Equipo Timón desde /ministerios/catalogo/[id]. Solo admin_general
-- lo recibe. El coordinador y los centralizadores del evento los ven sin
-- necesitar el permiso (rol scoped a evento, se resuelve en código).
--
-- Idempotente. No modifica ni borra datos existentes.
-- ============================================================

BEGIN;

-- ─── 1. Datos nuevos de la persona ───────────────────────────────────────────
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS sexo TEXT,
  ADD COLUMN IF NOT EXISTS formacion_religiosa TEXT,
  ADD COLUMN IF NOT EXISTS participacion_grupos_iglesia TEXT,
  ADD COLUMN IF NOT EXISTS accion_social TEXT;

ALTER TABLE public.personas DROP CONSTRAINT IF EXISTS personas_sexo_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_sexo_check
    CHECK (sexo IS NULL OR sexo IN ('masculino', 'femenino'));

-- ─── 2. Datos de la inscripción ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evento_inscripcion_datos (
  evento_participante_id UUID PRIMARY KEY
    REFERENCES public.evento_participantes(id) ON DELETE CASCADE,
  -- ¿Asistirás con algún familiar, amigo o conocido? ¿Quién?
  acompanante TEXT,
  -- ¿Se te presentará alguna dificultad en el horario de llegada o salida?
  dificultad_horario TEXT,
  -- Clave de COMO_SE_ENTERO (lib/eventos/inscripcion-datos.ts). Sin CHECK, igual
  -- que las restricciones: la lista la define la comunidad y se valida en el servidor.
  como_se_entero TEXT,
  como_se_entero_otro TEXT,
  familia_hizo_convivencias BOOLEAN,
  familia_quien TEXT,
  -- Claves de RESTRICCIONES_ALIMENTARIAS (lib/eventos/inscripcion-datos.ts).
  -- Sin CHECK: la lista la ajusta la comunidad y se valida en el servidor.
  restricciones_alimentarias TEXT[] NOT NULL DEFAULT '{}',
  -- Sensibles (permiso inscripcion.view_datos_sensibles):
  dieta_detalle TEXT,
  salud_observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sin políticas = nadie con anon/authenticated accede. service_role bypassea RLS.
ALTER TABLE public.evento_inscripcion_datos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evento_inscripcion_datos FROM anon, authenticated;
GRANT ALL ON public.evento_inscripcion_datos TO service_role;

-- ─── 3. Permiso de catálogo ──────────────────────────────────────────────────
INSERT INTO public.permisos (clave, nombre, descripcion, categoria) VALUES
  ('inscripcion.view_datos_sensibles',
   'Ver datos de salud y dieta de los inscriptos',
   'Permite ver, en la ficha de inscripción de los participantes de los eventos de la propia organización, el detalle de la dieta y las observaciones de salud. El coordinador y los centralizadores del evento los ven sin necesitar este permiso.',
   'eventos')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.rol_permisos (rol_sistema_id, permiso_id, activo)
SELECT rs.id, p.id, true
  FROM public.roles_sistema rs
 CROSS JOIN public.permisos p
 WHERE rs.nombre = 'admin_general'
   AND p.clave = 'inscripcion.view_datos_sensibles'
ON CONFLICT DO NOTHING;

COMMIT;

-- Verificación:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'personas' AND column_name IN
--    ('sexo', 'formacion_religiosa', 'participacion_grupos_iglesia', 'accion_social');   -- 4 filas
-- SELECT clave FROM public.permisos WHERE clave = 'inscripcion.view_datos_sensibles';     -- 1 fila
-- Con una sesión de cecista (no service role) esto debe fallar por permisos:
--   SELECT * FROM public.evento_inscripcion_datos;

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { INSCRIPCION_DATOS_VACIA, type EventoRealizado, type InscripcionDatos } from './inscripcion-datos'
import {
  EVENTOS_REALIZADOS_CATEGORIAS,
  ordenarTiposEventos,
  type TipoEventoRealizable,
} from '@/lib/personas/eventos-realizados'

// Acceso a `evento_inscripcion_datos` (migración 090). La tabla tiene RLS
// cerrada: solo se entra desde acá, con service role, DESPUÉS de chequear que
// quien pide tenga con qué (el UUID del link público, o canGestionarParticipantes
// + canVerDatosSensiblesInscripcion para la ficha). Solo importar desde Server
// Components o Route Handlers.

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const COLUMNAS =
  'acompanante, dificultad_horario, como_se_entero, como_se_entero_otro, familia_hizo_convivencias, familia_quien, restricciones_alimentarias, dieta_detalle, salud_observaciones'

/** Datos de la inscripción de un participante, o `null` si todavía no los completó. */
export async function cargarInscripcionDatos(participanteId: string): Promise<InscripcionDatos | null> {
  const { data, error } = await adminClient()
    .from('evento_inscripcion_datos')
    .select(COLUMNAS)
    .eq('evento_participante_id', participanteId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const fila = data as unknown as Partial<InscripcionDatos>
  return {
    ...INSCRIPCION_DATOS_VACIA,
    ...fila,
    restricciones_alimentarias: Array.isArray(fila.restricciones_alimentarias) ? fila.restricciones_alimentarias : [],
  }
}

/** Guarda (crea o pisa) los datos de la inscripción. `datos` ya viene normalizado. */
export async function guardarInscripcionDatos(participanteId: string, datos: InscripcionDatos): Promise<void> {
  const { error } = await adminClient()
    .from('evento_inscripcion_datos')
    .upsert(
      { evento_participante_id: participanteId, ...datos, updated_at: new Date().toISOString() },
      { onConflict: 'evento_participante_id' }
    )
  if (error) throw error
}

// ─── Convivencias, retiros y talleres realizados (persona_eventos_realizados) ─
// La tabla tiene RLS solo para usuarios logueados; el link público no tiene
// sesión, así que se entra con service role igual que el resto.

/** Catálogo del checklist, en el mismo orden que el perfil del cecista. */
export async function cargarTiposEventosRealizables(): Promise<TipoEventoRealizable[]> {
  const { data, error } = await adminClient()
    .from('tipos_eventos')
    .select('id, nombre')
    .in('categoria', EVENTOS_REALIZADOS_CATEGORIAS)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return ordenarTiposEventos((data ?? []) as TipoEventoRealizable[])
}

export async function cargarEventosRealizados(personaId: string): Promise<EventoRealizado[]> {
  const { data, error } = await adminClient()
    .from('persona_eventos_realizados')
    .select('tipo_evento_id, anio')
    .eq('persona_id', personaId)
  if (error) throw error
  return (data ?? []) as EventoRealizado[]
}

/**
 * Suma al historial de la persona los eventos que marcó en la inscripción.
 * Misma regla que el resto del link público: solo agrega. No borra lo que ya
 * estaba ni pisa un año ya cargado (eso se corrige desde el perfil).
 */
export async function agregarEventosRealizados(personaId: string, eventos: EventoRealizado[]): Promise<void> {
  if (eventos.length === 0) return
  const supabase = adminClient()

  const [tipos, actuales] = await Promise.all([cargarTiposEventosRealizables(), cargarEventosRealizados(personaId)])
  const idsValidos = new Set(tipos.map(t => t.id))
  const yaCargados = new Map(actuales.map(e => [e.tipo_evento_id, e.anio]))

  const filas = eventos
    .filter(e => idsValidos.has(e.tipo_evento_id))
    .filter(e => !yaCargados.has(e.tipo_evento_id) || (yaCargados.get(e.tipo_evento_id) == null && e.anio != null))
    .map(e => ({ persona_id: personaId, tipo_evento_id: e.tipo_evento_id, anio: e.anio }))
  if (filas.length === 0) return

  const { error } = await supabase
    .from('persona_eventos_realizados')
    .upsert(filas, { onConflict: 'persona_id,tipo_evento_id' })
  if (error) throw error
}

/**
 * Restricciones alimentarias y detalle de dieta de varios participantes a la
 * vez (export de dietas, card #54). Quien no completó el link no aparece en el
 * mapa.
 */
export async function cargarDietasDeParticipantes(
  participanteIds: string[],
): Promise<Map<string, Pick<InscripcionDatos, 'restricciones_alimentarias' | 'dieta_detalle'>>> {
  const dietas = new Map<string, Pick<InscripcionDatos, 'restricciones_alimentarias' | 'dieta_detalle'>>()
  if (participanteIds.length === 0) return dietas
  const { data, error } = await adminClient()
    .from('evento_inscripcion_datos')
    .select('evento_participante_id, restricciones_alimentarias, dieta_detalle')
    .in('evento_participante_id', participanteIds)
  if (error) throw error
  for (const fila of (data ?? []) as {
    evento_participante_id: string
    restricciones_alimentarias: string[] | null
    dieta_detalle: string | null
  }[]) {
    dietas.set(fila.evento_participante_id, {
      restricciones_alimentarias: Array.isArray(fila.restricciones_alimentarias) ? fila.restricciones_alimentarias : [],
      dieta_detalle: fila.dieta_detalle,
    })
  }
  return dietas
}

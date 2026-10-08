import { createClient as createAdminClient } from '@supabase/supabase-js'

// Informes confidenciales del cierre (para Responsables, para Equipo Timón y
// Carismas) — tabla evento_informes_cierre (migración 086). La tabla tiene RLS
// cerrada: solo se accede desde acá, con service role, DESPUÉS de chequear
// permisos con canVerCarismas / canVerInformeCcd / canEditarInformesConfidenciales
// (lib/eventos/cierre.ts). Solo importar desde Server Components o Route Handlers.

export type Carisma = { persona_id: string; texto: string }

/** Destino del "Informe de la CcD": mismas preguntas, el coordinador completa uno para cada uno. */
export type DestinoInforme = 'responsables' | 'eqt'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Respuestas de un Informe de la CcD: { [pregunta_id]: respuesta }. */
export async function cargarInformeCcd(eventoId: string, destino: DestinoInforme): Promise<Record<string, string> | null> {
  const { data, error } = await adminClient()
    .from('evento_informes_cierre')
    .select('contenido')
    .eq('evento_id', eventoId)
    .eq('tipo', destino)
    .maybeSingle()
  if (error) throw error
  return (data?.contenido as Record<string, string> | undefined) ?? null
}

export async function cargarCarismas(eventoId: string): Promise<Carisma[]> {
  const { data, error } = await adminClient()
    .from('evento_informes_cierre')
    .select('persona_id, contenido')
    .eq('evento_id', eventoId)
    .eq('tipo', 'carismas')
  if (error) throw error
  return (data ?? []).map(r => ({
    persona_id: r.persona_id as string,
    texto: String((r.contenido as { texto?: unknown } | null)?.texto ?? ''),
  }))
}

export async function guardarInformeCcd(
  eventoId: string,
  destino: DestinoInforme,
  respuestas: Record<string, string>,
  personaId: string | null,
): Promise<void> {
  const supabase = adminClient()
  const limpio: Record<string, string> = {}
  for (const [k, v] of Object.entries(respuestas ?? {})) {
    if (typeof v === 'string') limpio[k] = v
  }

  const { data: existente, error: selError } = await supabase
    .from('evento_informes_cierre')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('tipo', destino)
    .maybeSingle()
  if (selError) throw selError

  const { error } = existente
    ? await supabase
        .from('evento_informes_cierre')
        .update({ contenido: limpio, updated_by: personaId, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
    : await supabase
        .from('evento_informes_cierre')
        .insert({ evento_id: eventoId, tipo: destino, contenido: limpio, created_by: personaId, updated_by: personaId })
  if (error) throw error
}

/**
 * Guarda los carismas de los servidores indicados. Solo acepta persona_id que
 * estén en `servidoresValidos` (el equipo del evento), para no aceptar filas
 * de personas ajenas al evento.
 */
export async function guardarCarismas(
  eventoId: string,
  carismas: Carisma[],
  servidoresValidos: Set<string>,
  personaId: string | null,
): Promise<void> {
  const supabase = adminClient()
  const filas = (carismas ?? []).filter(
    c => c && typeof c.persona_id === 'string' && servidoresValidos.has(c.persona_id)
  )
  if (filas.length === 0) return

  const { data: existentes, error: selError } = await supabase
    .from('evento_informes_cierre')
    .select('id, persona_id')
    .eq('evento_id', eventoId)
    .eq('tipo', 'carismas')
  if (selError) throw selError
  const idPorPersona = new Map((existentes ?? []).map(r => [r.persona_id as string, r.id as string]))

  const ahora = new Date().toISOString()
  for (const c of filas) {
    const contenido = { texto: typeof c.texto === 'string' ? c.texto : '' }
    const id = idPorPersona.get(c.persona_id)
    const { error } = id
      ? await supabase
          .from('evento_informes_cierre')
          .update({ contenido, updated_by: personaId, updated_at: ahora })
          .eq('id', id)
      : await supabase
          .from('evento_informes_cierre')
          .insert({ evento_id: eventoId, tipo: 'carismas', persona_id: c.persona_id, contenido, created_by: personaId, updated_by: personaId })
    if (error) throw error
  }
}

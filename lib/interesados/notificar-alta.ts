import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSendableAddress, sendTemplateEmailBatch, templates } from '@/lib/email'

type Centralizadores = {
  [K in `centralizador_${1 | 2 | 3}_${'persona_id' | 'email'}`]: string | null
}

type Interesado = {
  id: string
  persona: { nombre: string; apellido: string; email: string | null; telefono: string | null } | null
  evento: (Centralizadores & { id: string; nombre: string }) | null
}

/** Usa el contacto del retiro; si falta, el correo de la persona vinculada. */
export async function destinatariosNuevoInteresado(db: SupabaseClient, evento: Centralizadores): Promise<string[]> {
  const ids = [...new Set(([1, 2, 3] as const)
    .map(n => evento[`centralizador_${n}_persona_id`]).filter((id): id is string => !!id))]
  const correosPersona = new Map<string, string | null>()
  if (ids.length) {
    const { data, error } = await db.from('personas').select('id, email').in('id', ids)
    if (error) throw error
    for (const persona of data ?? []) correosPersona.set(persona.id, persona.email)
  }

  const emails = new Set<string>()
  const personasNotificadas = new Set<string>()
  for (const n of [1, 2, 3] as const) {
    const personaId = evento[`centralizador_${n}_persona_id`]
    if (personaId && personasNotificadas.has(personaId)) continue
    const contacto = evento[`centralizador_${n}_email`]
    const email = isSendableAddress(contacto) ? contacto : personaId ? correosPersona.get(personaId) : null
    if (!isSendableAddress(email)) continue
    emails.add(email.trim().toLowerCase())
    if (personaId) personasNotificadas.add(personaId)
  }
  return [...emails]
}

/**
 * Solo servidor, después de insertar un NUEVO interesado. Recibe el id guardado,
 * nunca destinatarios del request. Un error de correo no revierte el alta.
 */
export async function notificarAltaInteresado(participanteId: string, origin: string) {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await db.from('evento_participantes')
      .select(`
        id,
        persona:personas!persona_id(nombre, apellido, email, telefono),
        evento:eventos!evento_id(
          id, nombre,
          centralizador_1_persona_id, centralizador_1_email,
          centralizador_2_persona_id, centralizador_2_email,
          centralizador_3_persona_id, centralizador_3_email
        )
      `)
      .eq('id', participanteId)
      .eq('estado_participacion', 'interesado')
      .eq('rol_en_evento', 'convivente')
      .maybeSingle()
    if (error) throw error
    const interesado = data as unknown as Interesado | null
    if (!interesado?.evento || !interesado.persona) return
    const { evento, persona } = interesado
    const destinatarios = await destinatariosNuevoInteresado(db, evento)
    if (!destinatarios.length) return

    const resultado = await sendTemplateEmailBatch(templates.nuevoInteresado, destinatarios.map(to => ({
      props: {
        nombre: `${persona.nombre} ${persona.apellido}`.trim(),
        evento: evento.nombre,
        email: isSendableAddress(persona.email) ? persona.email : null,
        telefono: persona.telefono,
        seguimientoUrl: `${origin}/interesados?evento_id=${encodeURIComponent(evento.id)}`,
      },
      options: { to, tags: { evento_id: evento.id, interesado_id: participanteId } },
    })))
    if (!resultado.ok) console.error('[interesado-alta] Error enviando aviso:', participanteId, resultado.errors)
  } catch (error) {
    console.error('[interesado-alta] Error preparando aviso:', participanteId, error)
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSendableAddress, sendTemplateEmailBatch, templates } from '@/lib/email'

export type EventoNotificacion = {
  id: string
  nombre: string
  estado: string
  organizacion_id: string | null
  fraternidad_id: string | null
  coordinador_asignado_id: string | null
}

/** Solo servidor; se llama después de autorizar y guardar una transición real. */
export async function destinatariosCambioEstado(db: SupabaseClient, evento: EventoNotificacion) {
  // Incluye los padres para retiros de fraternidades, sin sumar fraternidades
  // hermanas ni responsables de otras confraternidades.
  const organizaciones = new Set<string>()
  let pendientes = [evento.organizacion_id, evento.fraternidad_id].filter((id): id is string => !!id)
  while (pendientes.length) {
    pendientes.forEach(id => organizaciones.add(id))
    const { data, error } = await db.from('organizaciones').select('id, parent_id').in('id', pendientes)
    if (error) throw error
    pendientes = [...new Set((data ?? []).map(o => o.parent_id as string | null)
      .filter((id): id is string => !!id && !organizaciones.has(id)))]
  }

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba' }).format(new Date())
  const { data: asignaciones, error } = await db
    .from('asignaciones_ministerio')
    .select('persona_id, organizacion_id, ministerio:ministerios!ministerio_id!inner(codigo_interno)')
    .eq('estado', 'activo')
    .eq('ministerio.activo', true)
    .in('ministerio.codigo_interno', ['EFRATER', 'RCONFRA', 'TIMON', 'DEQT'])
    .or(`fecha_inicio.is.null,fecha_inicio.lte.${hoy}`)
    .or(`fecha_fin.is.null,fecha_fin.gt.${hoy}`)
  if (error) throw error

  const personas = new Set<string>()
  if (evento.coordinador_asignado_id) personas.add(evento.coordinador_asignado_id)
  for (const asignacion of asignaciones ?? []) {
    const ministerio = asignacion.ministerio as unknown as { codigo_interno: string }
    // Timonel tiene alcance comunitario, incluso cuando su asignación apunta a EqT.
    if (ministerio.codigo_interno === 'TIMON' || organizaciones.has(asignacion.organizacion_id)) {
      personas.add(asignacion.persona_id)
    }
  }
  if (!personas.size) return []

  const { data: contactos, error: contactosError } = await db.from('personas')
    .select('email').in('id', [...personas]).eq('estado', 'activo')
  if (contactosError) throw contactosError
  return [...new Set((contactos ?? []).map(p => p.email?.trim().toLowerCase()).filter(isSendableAddress))]
}

/** Un fallo de correo no revierte una transición que ya se guardó. */
export async function notificarCambioEstadoRetiro(evento: EventoNotificacion, origin: string) {
  try {
    // La lectura administrativa evita que el RLS del actor oculte destinatarios.
    // Las escrituras de estado siempre usan su sesión y sus permisos.
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const destinatarios = await destinatariosCambioEstado(db, evento)
    if (!destinatarios.length) return
    const resultado = await sendTemplateEmailBatch(templates.eventoCambioEstado, destinatarios.map(to => ({
      props: { evento: evento.nombre, detalleUrl: `${origin}/eventos/${evento.id}` },
      options: { to, tags: { evento_id: evento.id, estado: evento.estado } },
    })))
    if (!resultado.ok) console.error('[evento-estado] Error enviando notificación:', evento.id, resultado.errors)
  } catch (error) {
    console.error('[evento-estado] Error preparando notificación:', evento.id, error)
  }
}

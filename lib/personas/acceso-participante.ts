/**
 * Alta automática de la cuenta de un convivente no cecista.
 *
 * Se dispara al tomarle asistencia en su primera convivencia (ver
 * `app/api/eventos/[id]/asistencia/route.ts`). La persona ya existe en
 * `personas` (la creó el formulario de interés); acá se le da:
 *
 *   1. un login con nombre de usuario generado (`nombre.apellido`), con el
 *      mismo esquema de email interno que el resto (`usuario@ccd.internal`);
 *   2. el ministerio "Participante" (PAR, migración 082), que por defecto solo
 *      trae `view.eventos_publicados`;
 *   3. un mail a su casilla real con el link para elegir la contraseña.
 *
 * El trigger de alta de Auth le asigna `solo_lectura`, que ve toda la base: se
 * le quita, igual que hace `app/api/personas/invite/route.ts`.
 *
 * Solo para código de servidor: recibe un cliente con service role.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { CODIGO_MINISTERIO_PARTICIPANTE } from '@/lib/auth/context'
import { internalEmailFor, normalizeUsername } from '@/lib/auth/username'
import { isSendableAddress, sendTemplateEmail, templates } from '@/lib/email'

/** Vigencia del link de recovery de Supabase (1 hora por defecto). */
const LINK_EXPIRA_MINUTOS = 60

export type ResultadoAccesoParticipante =
  | { estado: 'creado'; nombreUsuario: string; emailEnviado: boolean }
  | { estado: 'no_aplica'; motivo: string }
  | { estado: 'error'; motivo: string }

/** `Juan Pablo` + `Muñoz` → `juanpablo.munoz`, dentro del formato que valida el alta manual. */
function usernameBase(nombre: string, apellido: string): string {
  const limpio = (texto: string) =>
    normalizeUsername(texto).replace(/[^a-z0-9]/g, '')
  const base = [limpio(nombre), limpio(apellido)].filter(Boolean).join('.').slice(0, 26)
  return base.length >= 3 ? base : 'participante'
}

async function reservarUsername(
  admin: SupabaseClient,
  personaId: string,
  nombre: string,
  apellido: string
): Promise<string | null> {
  const base = usernameBase(nombre, apellido)

  for (let intento = 0; intento < 50; intento++) {
    const candidato = intento === 0 ? base : `${base}${intento + 1}`
    const { error } = await admin
      .from('personas')
      .update({ nombre_usuario: candidato, debe_cambiar_password: false })
      .eq('id', personaId)

    if (!error) return candidato
    // 23505: el usuario ya lo tiene otra persona, se prueba el siguiente.
    if (error.code !== '23505') {
      console.error('[acceso-participante] no se pudo guardar el usuario:', error.message)
      return null
    }
  }
  return null
}

export async function crearAccesoParticipante(
  admin: SupabaseClient,
  { personaId, eventoNombre, origin }: { personaId: string; eventoNombre: string; origin: string }
): Promise<ResultadoAccesoParticipante> {
  const { data: persona, error: personaError } = await admin
    .from('personas')
    .select('id, nombre, apellido, email, tipo_persona, auth_user_id, nombre_usuario')
    .eq('id', personaId)
    .maybeSingle()

  if (personaError || !persona) {
    return { estado: 'error', motivo: 'No se encontró la persona' }
  }
  if (persona.auth_user_id) {
    return { estado: 'no_aplica', motivo: 'ya tiene cuenta' }
  }
  if (persona.tipo_persona === 'cecista') {
    // Las cuentas de cecistas las da de alta un responsable, con su rol.
    return { estado: 'no_aplica', motivo: 'es cecista' }
  }
  if (!isSendableAddress(persona.email)) {
    // Sin casilla real no puede elegir su contraseña: no tiene sentido crearla.
    return { estado: 'no_aplica', motivo: 'no tiene email cargado' }
  }

  // Si la migración 082 no corrió, no hay a qué rol asignarlo: mejor no crear
  // una cuenta que quedaría con solo_lectura o sin nada.
  const { data: ministerio } = await admin
    .from('ministerios')
    .select('id')
    .eq('codigo_interno', CODIGO_MINISTERIO_PARTICIPANTE)
    .eq('activo', true)
    .maybeSingle()

  if (!ministerio) {
    return { estado: 'error', motivo: 'Falta el ministerio Participante (migración 082)' }
  }

  const nombreUsuario =
    persona.nombre_usuario ??
    (await reservarUsername(admin, persona.id, persona.nombre ?? '', persona.apellido ?? ''))

  if (!nombreUsuario) {
    return { estado: 'error', motivo: 'No se pudo generar el nombre de usuario' }
  }

  const emailAuth = internalEmailFor(nombreUsuario)

  // Sin contraseña: la elige la persona con el link del mail.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: emailAuth,
    email_confirm: true,
    user_metadata: { persona_id: persona.id },
  })

  if (authError || !authData.user) {
    console.error('[acceso-participante] no se pudo crear la cuenta:', authError?.message)
    return { estado: 'error', motivo: authError?.message ?? 'No se pudo crear la cuenta' }
  }

  const userId = authData.user.id

  // El trigger de alta (056) ya corrió dentro del createUser: le quitamos el
  // solo_lectura, que habilita ver personas, organizaciones y eventos.
  const { error: rolesError } = await admin.from('usuario_roles').delete().eq('usuario_id', userId)
  if (rolesError) {
    console.error('[acceso-participante] no se pudo quitar solo_lectura:', rolesError.message)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const { error: asignacionError } = await admin.from('asignaciones_ministerio').insert({
    persona_id: persona.id,
    ministerio_id: ministerio.id,
    fecha_inicio: hoy,
    estado: 'activo',
  })
  if (asignacionError) {
    console.error('[acceso-participante] no se pudo asignar Participante:', asignacionError.message)
  }

  // Mismo mecanismo que /api/auth/forgot-password: el token se canjea en nuestra
  // página de reset en vez de depender del action_link de Supabase.
  let emailEnviado = false
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emailAuth,
    options: { redirectTo: `${origin}/auth/reset-password` },
  })

  if (linkError || !link?.properties?.hashed_token) {
    console.error('[acceso-participante] no se pudo generar el link:', linkError?.message)
  } else {
    const crearPasswordUrl = `${origin}/auth/reset-password?token_hash=${encodeURIComponent(
      link.properties.hashed_token
    )}&type=recovery`

    const resultado = await sendTemplateEmail(
      templates.accesoParticipante,
      {
        nombre: persona.nombre ?? 'hermano',
        evento: eventoNombre,
        nombreUsuario,
        crearPasswordUrl,
        pedirNuevoLinkUrl: `${origin}/auth/forgot-password`,
        expiraEnMinutos: LINK_EXPIRA_MINUTOS,
      },
      { to: persona.email as string }
    )
    // Sin RESEND_API_KEY el envío se saltea pero devuelve ok: no contarlo como enviado.
    emailEnviado = resultado.ok && !resultado.skipped
    if (!resultado.ok) {
      console.error('[acceso-participante] falló el envío del email:', resultado.error)
    }
  }

  return { estado: 'creado', nombreUsuario, emailEnviado }
}

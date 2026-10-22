// Mail de aviso al centralizador cuando lo asignan a un evento (card #21).
// Solo servidor. Coordinador y asesor no reciben mail: lo ven en su pantalla
// de inicio (pendiente que Coti confirme si también lo quieren).
//
// Best-effort: un fallo de correo nunca corta el guardado que lo disparó
// (sendTemplateEmail no lanza y acá no se propaga ningún error).
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTemplateEmail, templates } from '@/lib/email'

export type CentralizadorAvisable = {
  /** Persona de la plataforma; si no hay, se usan `nombre` y `email` tal cual (cargado a mano). */
  persona_id: string | null
  nombre: string | null
  email: string | null
}

export async function avisarCentralizadores(
  supabase: SupabaseClient,
  eventoId: string,
  origin: string,
  centralizadores: CentralizadorAvisable[],
) {
  try {
    const pendientes = centralizadores.filter(c => c.persona_id || c.email?.trim())
    if (pendientes.length === 0) return

    const ids = [...new Set(pendientes.map(c => c.persona_id).filter((id): id is string => !!id))]
    const [{ data: evento }, { data: personas }] = await Promise.all([
      supabase
        .from('eventos')
        .select('nombre, fecha_inicio, fecha_fin, ciudad, provincia_evento, casa_retiro:casas_retiro!casa_retiro_id(nombre)')
        .eq('id', eventoId)
        .single(),
      ids.length
        ? supabase.from('personas').select('id, nombre, email').in('id', ids)
        : Promise.resolve({ data: [] as { id: string; nombre: string; email: string | null }[] }),
    ])
    if (!evento) return

    const personaPorId = new Map((personas ?? []).map(p => [p.id, p]))
    // Un mail por dirección, aunque aparezca en dos casilleros.
    const porEmail = new Map<string, string>()
    for (const c of pendientes) {
      const persona = c.persona_id ? personaPorId.get(c.persona_id) : undefined
      const email = (persona?.email ?? c.email ?? '').trim()
      if (!email || porEmail.has(email.toLowerCase())) continue
      porEmail.set(email.toLowerCase(), persona?.nombre ?? c.nombre?.trim() ?? '')
    }

    const ev = evento as unknown as {
      nombre: string
      fecha_inicio: string | null
      fecha_fin: string | null
      ciudad: string | null
      provincia_evento: string | null
      casa_retiro: { nombre: string } | null
    }
    const lugar = [ev.casa_retiro?.nombre, ev.ciudad, ev.provincia_evento].filter(Boolean).join(', ')

    await Promise.all(
      [...porEmail].map(([email, nombre]) =>
        sendTemplateEmail(
          templates.asignacionCentralizador,
          {
            nombre: nombre.split(' ')[0] || 'hermano/a',
            evento: ev.nombre,
            fechaInicio: ev.fecha_inicio,
            fechaFin: ev.fecha_fin,
            lugar: lugar || null,
            eventoUrl: `${origin}/eventos/${eventoId}`,
          },
          { to: email, tags: { evento_id: eventoId } },
        ).then(r => {
          if (!r.ok) console.error('[avisos-equipo] No se pudo enviar el aviso:', r.error)
        })
      )
    )
  } catch (e) {
    console.error('[avisos-equipo] Error armando los avisos:', e)
  }
}

/** Centralizadores a partir de las columnas `centralizador_N_*` de un evento. */
export function centralizadoresDe(fila: Record<string, unknown>): CentralizadorAvisable[] {
  return ([1, 2, 3] as const).map(n => ({
    persona_id: (fila[`centralizador_${n}_persona_id`] as string | null) ?? null,
    nombre: (fila[`centralizador_${n}_nombre`] as string | null) ?? null,
    email: (fila[`centralizador_${n}_email`] as string | null) ?? null,
  }))
}

/**
 * Centralizadores que entran nuevos al cambiar las columnas de un evento ya
 * avisado (aprobación final, Editar evento, Gestión). `anterior` es la fila
 * antes del update y `updates` lo que se escribió.
 */
export function centralizadoresNuevos(
  anterior: Record<string, unknown>,
  updates: Record<string, unknown>,
): CentralizadorAvisable[] {
  const cambio = (campo: string) => campo in updates && !!updates[campo] && updates[campo] !== anterior[campo]
  return centralizadoresDe({ ...anterior, ...updates }).filter((c, i) => {
    const n = i + 1
    // Sin persona de la plataforma, el que cuenta es el mail cargado a mano.
    return cambio(`centralizador_${n}_persona_id`) || (!c.persona_id && cambio(`centralizador_${n}_email`))
  })
}

/** Columnas que necesita `centralizadoresNuevos` de la fila anterior. */
export const COLUMNAS_CENTRALIZADORES_AVISO =
  'centralizador_1_persona_id, centralizador_1_email, centralizador_2_persona_id, centralizador_2_email, centralizador_3_persona_id, centralizador_3_email'

/**
 * Estados en los que los centralizadores ya fueron avisados (se enviaron los
 * Datos para Noticias): un cambio posterior le avisa solo al que entra.
 */
export const ESTADOS_CENTRALIZADORES_AVISADOS = [
  'pendiente_aprobacion_final', 'aprobado', 'publicado', 'en_curso', 'suspendido',
]

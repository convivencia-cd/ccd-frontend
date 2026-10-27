// Mail de aviso a quien asignan al equipo de un evento (card #21): coordinador,
// asesor y centralizadores. Solo servidor.
//
// Best-effort: un fallo de correo nunca corta el guardado que lo disparó
// (sendTemplateEmail no lanza y acá no se propaga ningún error).
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTemplateEmail, templates } from '@/lib/email'
import type { RolEquipoAviso } from '@/lib/email/templates'

export type IntegranteAvisable = {
  rol: RolEquipoAviso
  /** Persona de la plataforma; si no hay, se usan `nombre` y `email` tal cual (cargado a mano). */
  persona_id: string | null
  nombre: string | null
  email: string | null
}

export type CentralizadorAvisable = Omit<IntegranteAvisable, 'rol'>

export async function avisarEquipo(
  supabase: SupabaseClient,
  eventoId: string,
  origin: string,
  integrantes: IntegranteAvisable[],
) {
  try {
    const pendientes = integrantes.filter(c => c.persona_id || c.email?.trim())
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
    // Un mail por dirección y rol, aunque aparezca en dos casilleros.
    const avisos = new Map<string, { email: string; nombre: string; rol: RolEquipoAviso }>()
    for (const c of pendientes) {
      const persona = c.persona_id ? personaPorId.get(c.persona_id) : undefined
      const email = (persona?.email ?? c.email ?? '').trim()
      const clave = `${c.rol}|${email.toLowerCase()}`
      if (!email || avisos.has(clave)) continue
      avisos.set(clave, { email, nombre: persona?.nombre ?? c.nombre?.trim() ?? '', rol: c.rol })
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
      [...avisos.values()].map(({ email, nombre, rol }) =>
        sendTemplateEmail(
          templates.asignacionEquipo,
          {
            rol,
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

export function avisarCentralizadores(
  supabase: SupabaseClient,
  eventoId: string,
  origin: string,
  centralizadores: CentralizadorAvisable[],
) {
  return avisarEquipo(supabase, eventoId, origin, centralizadores.map(c => ({ ...c, rol: 'centralizador' as const })))
}

// ─── Centralizadores ──────────────────────────────────────────────────────────

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

// ─── Coordinador y asesor ─────────────────────────────────────────────────────

/** Coordinador y asesor asignados por el Equipo Timón (columnas de `eventos`). */
export function coordinadorYAsesorDe(fila: Record<string, unknown>): IntegranteAvisable[] {
  return [
    { rol: 'coordinador', persona_id: (fila.coordinador_asignado_id as string | null) ?? null, nombre: null, email: null },
    { rol: 'asesor', persona_id: (fila.asesor_asignado_id as string | null) ?? null, nombre: null, email: null },
  ]
}

/** Coordinador o asesor que entran nuevos al cambiar las columnas de un evento ya avisado. */
export function coordinadorYAsesorNuevos(
  anterior: Record<string, unknown>,
  updates: Record<string, unknown>,
): IntegranteAvisable[] {
  const cambio = (campo: string) => campo in updates && !!updates[campo] && updates[campo] !== anterior[campo]
  return coordinadorYAsesorDe({ ...anterior, ...updates }).filter(c =>
    cambio(c.rol === 'coordinador' ? 'coordinador_asignado_id' : 'asesor_asignado_id')
  )
}

/** Columnas que necesita `coordinadorYAsesorNuevos` de la fila anterior. */
export const COLUMNAS_COORDINADOR_ASESOR_AVISO = 'coordinador_asignado_id, asesor_asignado_id'

/**
 * Estados en los que coordinador y asesor ya fueron avisados: el Equipo Timón
 * los asigna al aprobar y el retiro pasa a Datos para Noticias.
 */
export const ESTADOS_COORDINADOR_ASESOR_AVISADOS = ['pendiente_datos_noticias', ...ESTADOS_CENTRALIZADORES_AVISADOS]

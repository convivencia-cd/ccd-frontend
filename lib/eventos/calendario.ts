import type { createClient } from '@/lib/supabase/server'
import { canPerform, type UserContext } from '@/lib/auth/context'
import { ROLES_EVENTO_LABEL } from '@/lib/eventos/equipo'
import { nombreLegible } from '@/lib/personas/eventos-realizados'
import type { CalendarioEvento, RolCalendario } from './calendario-shared'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Mismo criterio de visibilidad que el listado de /eventos: sin permisos extra
// solo lo que ya es público; "aprobado" con event.view_aprobados; el resto con
// event.view_all_estados. Borrador, rechazado y cancelado nunca van al calendario.
const ESTADOS_PUBLICOS = ['publicado', 'en_curso', 'finalizado', 'cerrado']
const ESTADOS_APROBADOS = ['aprobado']
const ESTADOS_SOLO_TODOS = ['suspendido']
export const ESTADOS_EN_TRAMITE = [
  'solicitud',
  'discernimiento_confra',
  'discernimiento_eqt',
  'pendiente_datos_noticias',
  'pendiente_aprobacion_final',
]

// El coordinador y el asesor asignados por EqT solo cuentan desde que EqT
// confirma la asignación (mismo criterio que el Panel de Inicio): mientras el
// evento sigue en discernimiento es un borrador interno.
const ESTADOS_ASIGNACION_CONFIRMADA = [
  'pendiente_datos_noticias',
  'pendiente_aprobacion_final',
  'aprobado',
  'publicado',
  'en_curso',
  'suspendido',
  'finalizado',
  'cerrado',
]

const ESTADOS_CON_ROL = [...ESTADOS_EN_TRAMITE, ...ESTADOS_ASIGNACION_CONFIRMADA]

const ESTADO_PARTICIPACION_LABEL: Record<string, string> = {
  interesado: 'Interesado',
  inscripto: 'Inscripto',
  en_curso: 'Presente',
  completado: 'Completado',
  lista_espera: 'Lista de espera',
}

// Orden en que se muestran los roles cuando hay más de uno.
const ORDEN_ROL = ['coordinador', 'asesor', 'centralizador', 'servidor', 'musica', 'equipo_auxiliar', 'convivente', 'solicitante']

const SELECT_EVENTO = `
  id, nombre, tipo, estado, fecha_inicio, fecha_fin, ciudad, provincia_evento,
  organizacion_id, fraternidad_id, solicitado_por,
  coordinador_asignado_id, asesor_asignado_id,
  centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id,
  confraternidad:organizaciones!organizacion_id(id, nombre),
  fraternidad:organizaciones!fraternidad_id(id, nombre),
  casa_retiro:casas_retiro!casa_retiro_id(nombre, ciudad),
  tipo_evento:tipos_eventos!tipo_evento_id(nombre),
  coordinador_asignado:personas!coordinador_asignado_id(nombre, apellido)
`

type EventoRow = {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  ciudad: string | null
  provincia_evento: string | null
  organizacion_id: string | null
  fraternidad_id: string | null
  solicitado_por: string | null
  coordinador_asignado_id: string | null
  asesor_asignado_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
  confraternidad: { id: string; nombre: string } | null
  fraternidad: { id: string; nombre: string } | null
  casa_retiro: { nombre: string | null; ciudad: string | null } | null
  tipo_evento: { nombre: string } | null
  coordinador_asignado: { nombre: string | null; apellido: string | null } | null
}

const PAGINA = 1000

/** PostgREST corta en 1000 filas: se pagina para no perder eventos en ventanas grandes. */
async function traerTodo<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armar(desde, desde + PAGINA - 1)
    if (error) {
      console.error('[calendario]', error)
      break
    }
    const lote = (data ?? []) as T[]
    filas.push(...lote)
    if (lote.length < PAGINA) break
  }
  return filas
}

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export type OpcionesCalendario = {
  desde: string
  hasta: string
  /** Sumar los eventos todavía en aprobación (solo aplica con event.view_all_estados). */
  incluirEnTramite?: boolean
}

/**
 * Eventos (convivencias, retiros, talleres) que el usuario puede ver en el
 * calendario dentro de [desde, hasta], con el rol que tiene en cada uno.
 * Los eventos donde tiene un rol aparecen siempre, aunque su estado no entre
 * en lo que ve por permisos.
 */
export async function cargarEventosCalendario(
  supabase: SupabaseServerClient,
  ctx: UserContext,
  { desde, hasta, incluirEnTramite = false }: OpcionesCalendario,
): Promise<CalendarioEvento[]> {
  const canViewAllEstados = canPerform(ctx, 'event.view_all_estados')
  const canViewAprobados = canViewAllEstados || canPerform(ctx, 'event.view_aprobados')

  const estadosVisibles = [
    ...ESTADOS_PUBLICOS,
    ...(canViewAprobados ? ESTADOS_APROBADOS : []),
    ...(canViewAllEstados ? ESTADOS_SOLO_TODOS : []),
    ...(canViewAllEstados && incluirEnTramite ? ESTADOS_EN_TRAMITE : []),
  ]

  const personaId = ctx.persona_id

  const [visibles, propios, participaciones] = await Promise.all([
    traerTodo<EventoRow>((a, b) =>
      supabase
        .from('eventos')
        .select(SELECT_EVENTO)
        .in('estado', estadosVisibles)
        .lte('fecha_inicio', hasta)
        .gte('fecha_fin', desde)
        .order('fecha_inicio')
        .order('id')
        .range(a, b),
    ),
    // Eventos donde figura en la cabecera: coordinador/asesor asignado,
    // centralizador o solicitante.
    personaId
      ? traerTodo<EventoRow>((a, b) =>
          supabase
            .from('eventos')
            .select(SELECT_EVENTO)
            .or(
              [
                'coordinador_asignado_id',
                'asesor_asignado_id',
                'centralizador_1_persona_id',
                'centralizador_2_persona_id',
                'centralizador_3_persona_id',
                'solicitado_por',
              ]
                .map(c => `${c}.eq.${personaId}`)
                .join(','),
            )
            .in('estado', ESTADOS_CON_ROL)
            .lte('fecha_inicio', hasta)
            .gte('fecha_fin', desde)
            .order('fecha_inicio')
            .order('id')
            .range(a, b),
        )
      : Promise.resolve([] as EventoRow[]),
    personaId
      ? traerTodo<{ evento_id: string; rol_en_evento: string; estado_participacion: string | null }>((a, b) =>
          supabase
            .from('evento_participantes')
            .select('evento_id, rol_en_evento, estado_participacion')
            .eq('persona_id', personaId)
            .neq('estado_participacion', 'cancelado')
            .order('id')
            .range(a, b),
        )
      : Promise.resolve([]),
  ])

  const porId = new Map<string, EventoRow>()
  for (const ev of [...visibles, ...propios]) porId.set(ev.id, ev)

  // Eventos donde participa (convivente, servidor...) que no entraron por estado.
  const faltantes = [...new Set(participaciones.map(p => p.evento_id))].filter(id => !porId.has(id))
  for (const ids of trozos(faltantes, 150)) {
    const { data } = await supabase
      .from('eventos')
      .select(SELECT_EVENTO)
      .in('id', ids)
      .in('estado', ESTADOS_CON_ROL)
      .lte('fecha_inicio', hasta)
      .gte('fecha_fin', desde)
    for (const ev of (data ?? []) as unknown as EventoRow[]) porId.set(ev.id, ev)
  }

  const eventos = [...porId.values()].filter(ev => ev.fecha_inicio && ev.fecha_fin)
  if (eventos.length === 0) return []

  // Fechas fragmentadas (evento_fechas).
  const tramosPorEvento = new Map<string, { inicio: string; fin: string }[]>()
  for (const ids of trozos(eventos.map(e => e.id), 150)) {
    const { data } = await supabase
      .from('evento_fechas')
      .select('evento_id, fecha_inicio, fecha_fin')
      .in('evento_id', ids)
      .order('fecha_inicio')
    for (const f of (data ?? []) as { evento_id: string; fecha_inicio: string; fecha_fin: string }[]) {
      const lista = tramosPorEvento.get(f.evento_id) ?? []
      lista.push({ inicio: f.fecha_inicio, fin: f.fecha_fin })
      tramosPorEvento.set(f.evento_id, lista)
    }
  }

  const participacionesPorEvento = new Map<string, typeof participaciones>()
  for (const p of participaciones) {
    const lista = participacionesPorEvento.get(p.evento_id) ?? []
    lista.push(p)
    participacionesPorEvento.set(p.evento_id, lista)
  }

  const resultado = eventos.map((ev): CalendarioEvento => {
    const roles = new Map<string, RolCalendario>()
    const agregar = (rol: string, detalle?: string | null) => {
      if (!roles.has(rol)) {
        roles.set(rol, {
          rol,
          label: rol === 'solicitante' ? 'Solicitante' : ROLES_EVENTO_LABEL[rol] ?? rol,
          detalle: detalle ?? null,
        })
      }
    }

    if (personaId) {
      const asignacionConfirmada = ESTADOS_ASIGNACION_CONFIRMADA.includes(ev.estado)
      if (asignacionConfirmada && ev.coordinador_asignado_id === personaId) agregar('coordinador')
      if (asignacionConfirmada && ev.asesor_asignado_id === personaId) agregar('asesor')
      if (
        [ev.centralizador_1_persona_id, ev.centralizador_2_persona_id, ev.centralizador_3_persona_id].includes(personaId)
      )
        agregar('centralizador')
      for (const p of participacionesPorEvento.get(ev.id) ?? []) {
        agregar(
          p.rol_en_evento,
          p.rol_en_evento === 'convivente' && p.estado_participacion
            ? ESTADO_PARTICIPACION_LABEL[p.estado_participacion] ?? null
            : null,
        )
      }
      if (ev.solicitado_por === personaId) agregar('solicitante')
    }

    const misRoles = [...roles.values()].sort(
      (a, b) =>
        (ORDEN_ROL.indexOf(a.rol) === -1 ? 99 : ORDEN_ROL.indexOf(a.rol)) -
        (ORDEN_ROL.indexOf(b.rol) === -1 ? 99 : ORDEN_ROL.indexOf(b.rol)),
    )

    const tramos = tramosPorEvento.get(ev.id)
    const lugarCasa = ev.casa_retiro?.nombre
      ? [ev.casa_retiro.nombre, ev.casa_retiro.ciudad].filter(Boolean).join(', ')
      : null
    const lugar = lugarCasa ?? ([ev.ciudad, ev.provincia_evento].filter(Boolean).join(', ') || null)
    const coord = ev.coordinador_asignado
      ? [ev.coordinador_asignado.nombre, ev.coordinador_asignado.apellido].filter(Boolean).join(' ') || null
      : null

    // Las cuentas de Participante no entran a /eventos/[id]: van a la página
    // pública del evento, que solo existe mientras está publicado.
    const href = ctx.es_interno ? `/eventos/${ev.id}` : ev.estado === 'publicado' ? `/e/${ev.id}` : null

    return {
      id: ev.id,
      nombre: ev.nombre,
      tipo: ev.tipo,
      tipoEventoNombre: ev.tipo_evento?.nombre ? nombreLegible(ev.tipo_evento.nombre) : null,
      estado: ev.estado,
      fechaInicio: ev.fecha_inicio!,
      fechaFin: ev.fecha_fin!,
      tramos:
        tramos && tramos.length > 0
          ? tramos
          : [{ inicio: ev.fecha_inicio!, fin: ev.fecha_fin! }],
      lugar,
      confraternidad: ev.confraternidad,
      fraternidad: ev.fraternidad,
      coordinador: ctx.es_interno && ESTADOS_ASIGNACION_CONFIRMADA.includes(ev.estado) ? coord : null,
      misRoles,
      enTramite: ESTADOS_EN_TRAMITE.includes(ev.estado),
      href,
    }
  })

  return resultado.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.nombre.localeCompare(b.nombre, 'es'))
}

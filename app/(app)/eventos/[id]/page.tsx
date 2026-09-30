export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Edit2, Calendar, MapPin, Users, Settings2, Wallet } from 'lucide-react'
import DiscernimientoPanel from './_components/approval-panel'
import DatosNoticiasPannel from './_components/datos-noticias-panel'
import AprobacionFinalPanel from './_components/aprobacion-final-panel'
import SuspenderEventoButton from './_components/suspender-evento-button'
import SolicitarSuspensionPanel from './_components/solicitar-suspension-panel'
import { PublicarButton } from './_components/publicar-button'
import { IniciarEventoButton } from './_components/iniciar-evento-button'
import { FinalizarEventoButton } from './_components/finalizar-evento-button'
import FlyerUploadPanel from './_components/flyer-upload-panel'
import { muestraFlyers } from '@/lib/eventos/flyers'
import CierrePanel from './_components/cierre-panel'
import PensionBecasPanel from './_components/pension-becas-panel'
import {
  canEditarCierre,
  canVerCierre,
  canVerInformesConfidenciales,
  canCerrarConvivencia,
  esCentralizadorDeEvento,
  ROLES_SERVIDORES,
  type PreguntaInforme,
} from '@/lib/eventos/cierre'
import { canGestionarPension } from '@/lib/eventos/pension'
import { canVerInformeEconomico } from '@/lib/eventos/informe-economico'
import { formatDateAR } from '@/lib/utils'

const estadoClases: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  solicitud: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  discernimiento_confra: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  discernimiento_eqt: 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  pendiente_datos_noticias: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  pendiente_aprobacion_final: 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  aprobado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  publicado: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  en_curso: 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
  rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  suspendido: 'bg-orange-200 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  finalizado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  cerrado: 'bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  cancelado: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const estadoLabel: Record<string, string> = {
  borrador: 'Borrador',
  solicitud: 'Pend. Disc. Confra/Delegado',
  discernimiento_confra: 'Pend. Disc. Equipo Timón',
  discernimiento_eqt: 'Disc. Equipo Timón',
  pendiente_datos_noticias: 'Pendiente Datos Noticias',
  pendiente_aprobacion_final: 'Pend. Aprobación Final EqT',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  en_curso: 'En Curso',
  rechazado: 'Rechazado',
  suspendido: 'Suspendido',
  finalizado: 'Finalizado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
}

const tipoLabel: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro',
  taller: 'Taller',
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  const { data: evento } = await supabase
    .from('eventos')
    .select(`
      id, nombre, tipo, estado, fecha_inicio, fecha_fin,
      modalidad, descripcion, notas, cupo_maximo, audiencia,
      pension, precio,
      requiere_discernimiento_confra, requiere_discernimiento_eqt,
      coordinadores_propuestos, asesor_propuesto, asesor_voluntario, es_apv,
      ciudad, codigo_postal, diocesis, provincia_evento, pais_evento,
      notas_discernimiento, casa_retiro_id,
      coordinador_asignado_id, asesor_asignado_id,
      solicitado_por, aprobado_por, rechazado_por, publicado_por,
      disc_confra_por, disc_eqt_por,
      solicitud_suspension_por, suspendido_por,
      centralizador_1_persona_id, centralizador_1_nombre, centralizador_1_email, centralizador_1_telefono,
      centralizador_2_persona_id, centralizador_2_nombre, centralizador_2_email, centralizador_2_telefono,
      centralizador_3_persona_id, centralizador_3_nombre, centralizador_3_email, centralizador_3_telefono,
      manuales_stock, manuales_necesarios, manuales_solicitados,
      tipo_evento_id,
      fecha_cierre, cerrado_por,
      cierre_foto_convivencia_url, cierre_foto_servidores_url,
      informe_coordinador_respuestas, informe_carismas,
      cierre_bolso_manuales_completo, cierre_manuales_saldo_final,
      cierre_manuales_recibidos_de, cierre_manuales_entrego_a, cierre_manuales_notas,
      tipo_evento:tipos_eventos!tipo_evento_id(preguntas_informe),
      flyer_horizontal_url, flyer_cuadrado_url,
      notas_noticias, notas_aprobacion_final,
      solicitud_suspension_notas, solicitud_suspension_fecha,
      solicitud_suspension_por_persona:personas!solicitud_suspension_por(id, nombre, apellido),
      suspendido_por_persona:personas!suspendido_por(id, nombre, apellido),
      fecha_suspension, notas_suspension,
      fecha_solicitud, fecha_aprobacion, fecha_rechazo, motivo_rechazo,
      fecha_publicacion,
      organizacion_id, fraternidad_id,
      disc_confra_estado, disc_confra_fecha, disc_confra_notas,
      disc_eqt_estado, disc_eqt_fecha, disc_eqt_notas,
      disc_confra_por_persona:personas!disc_confra_por(id, nombre, apellido),
      disc_eqt_por_persona:personas!disc_eqt_por(id, nombre, apellido),
      confraternidad:organizaciones!organizacion_id(id, nombre),
      fraternidad:organizaciones!fraternidad_id(id, nombre),
      casa_retiro:casas_retiro!casa_retiro_id(id, nombre, ciudad, provincia, link_maps),
      coordinador_asignado:personas!coordinador_asignado_id(id, nombre, apellido),
      asesor_asignado:personas!asesor_asignado_id(id, nombre, apellido),
      solicitado_por_persona:personas!solicitado_por(id, nombre, apellido),
      aprobado_por_persona:personas!aprobado_por(id, nombre, apellido),
      rechazado_por_persona:personas!rechazado_por(id, nombre, apellido),
      publicado_por_persona:personas!publicado_por(id, nombre, apellido)
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const { data: fechasEjecucion } = await supabase
    .from('evento_fechas')
    .select('id, fecha_inicio, fecha_fin')
    .eq('evento_id', id)
    .order('fecha_inicio')

  const { data: cambiosHistorial } = await supabase
    .from('evento_cambios')
    .select('id, nivel_disc, campo, valor_anterior, valor_nuevo, fecha, modificado_por, modificado_por_persona:personas!modificado_por(nombre, apellido)')
    .eq('evento_id', id)
    .order('fecha', { ascending: true })

  const { data: casasRetiro } = await supabase
    .from('casas_retiro')
    .select('id, nombre, ciudad, provincia')
    .order('nombre')

  // Paginado: Supabase corta la respuesta por defecto en 1000 filas y hay más
  // personas activas que eso (el combo se cortaba en la letra L).
  const personasCecistas: { id: string; nombre: string; apellido: string; email: string | null; telefono: string | null }[] = []
  {
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data: page } = await supabase
        .from('personas')
        .select('id, nombre, apellido, email, telefono')
        .eq('estado', 'activo')
        .order('apellido')
        .order('nombre')
        .range(from, from + pageSize - 1)
      if (!page || page.length === 0) break
      personasCecistas.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }
  }

  // Personas con un ministerio institucional dado actualmente asignado (para los
  // desplegables de "Coordinador/es" y "Asesor/es" en discernimiento).
  // asignaciones_ministerio con fecha_fin IS NULL = vigente.
  async function personasConMinisterioActivo(nombreMinisterio: string): Promise<{ id: string; nombre: string; apellido: string }[]> {
    const { data: ministerio } = await supabase
      .from('ministerios')
      .select('id')
      .eq('nombre', nombreMinisterio)
      .maybeSingle()
    if (!ministerio) return []

    const { data: asignaciones } = await supabase
      .from('asignaciones_ministerio')
      .select('persona:personas!persona_id(id, nombre, apellido)')
      .eq('ministerio_id', ministerio.id)
      .eq('estado', 'activo')
      .is('fecha_fin', null)

    const seen = new Set<string>()
    return ((asignaciones ?? []) as unknown as { persona: { id: string; nombre: string; apellido: string } | null }[])
      .map(a => a.persona)
      .filter((p): p is { id: string; nombre: string; apellido: string } => {
        if (!p || seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })
      .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre))
  }

  const [coordinadoresRolDisponibles, asesoresRolDisponibles] = await Promise.all([
    personasConMinisterioActivo('Coordinador'),
    personasConMinisterioActivo('Asesor'),
  ])

  // Servidores y familiares activos (para el buscador que aparece al elegir "Otro").
  // Join embebido en vez de un .in('id', [...]) sobre personas: con ~900 ids activos
  // ese .in() arma una URL de más de 30.000 caracteres que Supabase rechaza con
  // "Bad Request", y al no chequear el error la lista quedaba silenciosamente vacía.
  const { data: modosServidorFamiliar } = await supabase
    .from('persona_modos')
    .select('persona_id, personas(id, nombre, apellido, fecha_baja)')
    .in('modo', ['servidor', 'familiar'])
    .is('fecha_fin', null)
    .is('personas.fecha_baja', null)

  type PersonaEmbebida = { id: string; nombre: string; apellido: string; fecha_baja: string | null }
  const seenSF = new Set<string>()
  const personasServidoresFamiliares: { id: string; nombre: string; apellido: string }[] =
    ((modosServidorFamiliar ?? []) as unknown as { personas: PersonaEmbebida | null }[])
      .map(pm => pm.personas)
      .filter((p): p is PersonaEmbebida => {
        if (!p || seenSF.has(p.id)) return false
        seenSF.add(p.id)
        return true
      })
      .map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre))

  // ─── Datos del Cierre (solo si el evento está finalizado/cerrado y el usuario puede verlo) ───
  const cierreEvento = {
    estado: evento.estado,
    organizacion_id: evento.organizacion_id ?? null,
    fraternidad_id: evento.fraternidad_id ?? null,
    coordinador_asignado_id: (evento as Record<string, unknown>).coordinador_asignado_id as string | null,
    centralizador_1_persona_id: (evento as Record<string, unknown>).centralizador_1_persona_id as string | null,
    centralizador_2_persona_id: (evento as Record<string, unknown>).centralizador_2_persona_id as string | null,
    centralizador_3_persona_id: (evento as Record<string, unknown>).centralizador_3_persona_id as string | null,
  }
  const showCierre = canVerCierre(ctx, cierreEvento)

  // ─── Becas en Pensión (independiente del cierre: aplica con el evento en vivo) ───
  const canPension = canGestionarPension(ctx, cierreEvento)

  type ParticipantePensionRow = {
    id: string
    valor_inscripcion: number | null
    valor_pension: number | null
    beca_pension: number
    notas_beca: string | null
    persona: { id: string; nombre: string; apellido: string } | null
  }
  let participantesPension: ParticipantePensionRow[] = []
  if (canPension) {
    const { data: pensionData } = await supabase
      .from('evento_participantes')
      .select('id, valor_inscripcion, valor_pension, beca_pension, notas_beca, persona:personas!persona_id(id, nombre, apellido)')
      .eq('evento_id', id)
      .eq('rol_en_evento', 'convivente')
      .neq('estado_participacion', 'cancelado')
    participantesPension = (pensionData ?? []) as unknown as ParticipantePensionRow[]
  }

  type ParticipanteRow = {
    persona_id: string
    rol_en_evento: string
    estado_participacion: string
    persona: { nombre: string; apellido: string; email: string | null; telefono: string | null } | null
  }
  let participantes: ParticipanteRow[] = []
  if (showCierre) {
    const { data: parts } = await supabase
      .from('evento_participantes')
      .select('persona_id, rol_en_evento, estado_participacion, persona:personas!persona_id(nombre, apellido, email, telefono)')
      .eq('evento_id', id)
    participantes = (parts ?? []) as unknown as ParticipanteRow[]
  }

  // Informe Económico: vive en su propia pantalla (/eventos/[id]/informe-economico).
  const showIE = canVerInformeEconomico(ctx, cierreEvento)

  const conviventesCierre = participantes
    .filter(p => p.rol_en_evento === 'convivente' && p.estado_participacion !== 'cancelado')
    .map(p => ({
      persona_id: p.persona_id,
      nombre: p.persona?.nombre ?? '',
      apellido: p.persona?.apellido ?? '',
      email: p.persona?.email ?? null,
      telefono: p.persona?.telefono ?? null,
      rol: p.rol_en_evento,
    }))

  const servidoresCierre = participantes
    .filter(p => (ROLES_SERVIDORES as readonly string[]).includes(p.rol_en_evento) && p.estado_participacion !== 'cancelado')
    .map(p => ({
      persona_id: p.persona_id,
      nombre: p.persona?.nombre ?? '',
      apellido: p.persona?.apellido ?? '',
      rol: p.rol_en_evento,
    }))

  const tipoEvento = (evento as Record<string, unknown>).tipo_evento as { preguntas_informe: PreguntaInforme[] } | null
  const preguntasInforme: PreguntaInforme[] = Array.isArray(tipoEvento?.preguntas_informe) ? tipoEvento!.preguntas_informe : []

  // Solo Cecistas para el combo de entrega/recepción de manuales (punto 9 del cierre).
  // Consulta separada de `personasCecistas` (que pese al nombre trae TODAS las personas
  // activas, usada por otros paneles para elegir coordinador/asesor/centralizador).
  let cecistasSoloList: { id: string; nombre: string; apellido: string }[] = []
  if (showCierre) {
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data: page } = await supabase
        .from('personas')
        .select('id, nombre, apellido')
        .eq('estado', 'activo')
        .eq('tipo_persona', 'cecista')
        .order('apellido')
        .order('nombre')
        .range(from, from + pageSize - 1)
      if (!page || page.length === 0) break
      cecistasSoloList.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }
  }

  const campoLabel: Record<string, string> = {
    nombre: 'Nombre', fecha_inicio: 'Fecha inicio', fecha_fin: 'Fecha fin',
    ciudad: 'Ciudad', provincia_evento: 'Provincia', pais_evento: 'País',
    codigo_postal: 'CP', diocesis: 'Diócesis',
    coordinadores_propuestos: 'Coordinadores propuestos', asesor_propuesto: 'Asesor propuesto',
    asesor_voluntario: 'Asesor voluntario', modalidad: 'Modalidad',
    notas: 'Notas', casa_retiro_id: 'Casa de Retiro',
    coordinador_asignado_id: 'Coordinador asignado', asesor_asignado_id: 'Asesor asignado',
    fechas_ejecucion: 'Fechas de ejecución',
    estado: 'Estado',
  }

  const nivelDiscLabel: Record<string, string> = {
    confra: 'Confraternidad',
    eqt: 'Equipo Timón',
  }

  const confraternidad = evento.confraternidad as { id: string; nombre: string } | null
  const fraternidad = evento.fraternidad as { id: string; nombre: string } | null
  const casaRetiro = evento.casa_retiro as { id: string; nombre: string; ciudad?: string | null; provincia?: string | null; link_maps?: string | null } | null
  const coordinadorAsignado = (evento as Record<string, unknown>).coordinador_asignado as { id: string; nombre: string; apellido: string } | null
  const asesorAsignado = (evento as Record<string, unknown>).asesor_asignado as { id: string; nombre: string; apellido: string } | null

  type PersonaRef = { id: string; nombre: string; apellido: string }
  const solicitadoPor = evento.solicitado_por_persona as PersonaRef | null
  const aprobadoPor = evento.aprobado_por_persona as PersonaRef | null
  const rechazadoPor = evento.rechazado_por_persona as PersonaRef | null
  const publicadoPor = evento.publicado_por_persona as PersonaRef | null
  const discConfraPor = evento.disc_confra_por_persona as PersonaRef | null
  const discEqtPor = evento.disc_eqt_por_persona as PersonaRef | null

  // Resolve a UUID or plain-text name to { texto, personaId } using the fetched personas list.
  // Tries: UUID match, then "Apellido, Nombre" format, then "Nombre Apellido" format.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const allPersonas = (personasCecistas ?? []) as { id: string; nombre: string; apellido: string }[]
  function resolveVal(val: string): { texto: string; personaId: string | null } {
    const t = val.trim()
    if (!t) return { texto: t, personaId: null }
    if (UUID_RE.test(t)) {
      const p = allPersonas.find(x => x.id === t)
      return p ? { texto: `${p.nombre} ${p.apellido}`, personaId: p.id } : { texto: t, personaId: null }
    }
    const lower = t.toLowerCase()
    const byName = allPersonas.find(x => {
      const fmtApellidoNombre = `${x.apellido}, ${x.nombre}`.toLowerCase()
      const fmtNombreApellido = `${x.nombre} ${x.apellido}`.toLowerCase()
      const fmtApellidoNombreNoComma = `${x.apellido} ${x.nombre}`.toLowerCase()
      return lower === fmtApellidoNombre || lower === fmtNombreApellido || lower === fmtApellidoNombreNoComma
    })
    return { texto: t, personaId: byName?.id ?? null }
  }

  const estadoDiscLabel: Record<string, string> = {
    aprobado_sin_modificaciones: 'Aprobado sin modificaciones',
    aprobado_con_modificaciones: 'Aprobado con modificaciones',
    rechazado: 'Rechazado',
  }

  type EntradaHistorial = {
    fecha: string
    label: string
    persona: string | null
    personaId: string | null
    extra?: string
    tipo: 'solicitud' | 'discernimiento' | 'aprobacion' | 'rechazo' | 'publicacion'
  }

  const timelineHistorial: EntradaHistorial[] = []

  const ev = evento as Record<string, unknown>

  if (evento.fecha_solicitud) {
    timelineHistorial.push({
      fecha: evento.fecha_solicitud,
      label: 'Solicitud enviada',
      persona: solicitadoPor ? `${solicitadoPor.nombre} ${solicitadoPor.apellido}` : null,
      personaId: (ev.solicitado_por as string | null) ?? null,
      tipo: 'solicitud',
    })
  }
  if (evento.disc_confra_fecha && evento.disc_confra_estado) {
    timelineHistorial.push({
      fecha: evento.disc_confra_fecha,
      label: `Disc. Confraternidad — ${estadoDiscLabel[evento.disc_confra_estado] ?? evento.disc_confra_estado}`,
      persona: discConfraPor ? `${discConfraPor.nombre} ${discConfraPor.apellido}` : null,
      personaId: (ev.disc_confra_por as string | null) ?? null,
      extra: evento.disc_confra_notas ?? undefined,
      tipo: 'discernimiento',
    })
  }
  if (evento.disc_eqt_fecha && evento.disc_eqt_estado) {
    timelineHistorial.push({
      fecha: evento.disc_eqt_fecha,
      label: `Disc. Equipo Timón — ${estadoDiscLabel[evento.disc_eqt_estado] ?? evento.disc_eqt_estado}`,
      persona: discEqtPor ? `${discEqtPor.nombre} ${discEqtPor.apellido}` : null,
      personaId: (ev.disc_eqt_por as string | null) ?? null,
      extra: evento.disc_eqt_notas ?? undefined,
      tipo: 'discernimiento',
    })
  }
  if (evento.fecha_aprobacion) {
    timelineHistorial.push({
      fecha: evento.fecha_aprobacion,
      label: 'Aprobado',
      persona: aprobadoPor ? `${aprobadoPor.nombre} ${aprobadoPor.apellido}` : null,
      personaId: (ev.aprobado_por as string | null) ?? null,
      tipo: 'aprobacion',
    })
  }
  if (evento.fecha_rechazo) {
    timelineHistorial.push({
      fecha: evento.fecha_rechazo,
      label: 'Rechazado',
      persona: rechazadoPor ? `${rechazadoPor.nombre} ${rechazadoPor.apellido}` : null,
      personaId: (ev.rechazado_por as string | null) ?? null,
      extra: evento.motivo_rechazo ?? undefined,
      tipo: 'rechazo',
    })
  }
  if (ev.fecha_publicacion) {
    timelineHistorial.push({
      fecha: ev.fecha_publicacion as string,
      label: 'Publicado',
      persona: publicadoPor ? `${publicadoPor.nombre} ${publicadoPor.apellido}` : null,
      personaId: (ev.publicado_por as string | null) ?? null,
      tipo: 'publicacion',
    })
  }

  timelineHistorial.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const canEdit = ctx && canPerform(ctx, 'event.update', evento.organizacion_id ?? null)
  // El Centralizador es quien opera el evento en el terreno: arrancarlo,
  // tomar asistencia y finalizarlo son parte de su función aunque no tenga los
  // permisos de catálogo event.publish/event.update, que son de conducción.
  // Publicar y suspender siguen siendo ajenos: esas son decisiones del EqT.
  const esCentralizador = esCentralizadorDeEvento(ctx, cierreEvento)

  const canPublish = ctx && evento.estado === 'aprobado' && canPerform(ctx, 'event.publish', evento.organizacion_id ?? null)
  const canIniciar = ctx && evento.estado === 'publicado' &&
    (canPerform(ctx, 'event.publish', evento.organizacion_id ?? null) || esCentralizador)
  const canFinalizar = ctx && evento.estado === 'en_curso' &&
    (canPerform(ctx, 'event.publish', evento.organizacion_id ?? null) || esCentralizador)
  // Attendance check-in available to event managers while the event is publicado/en_curso
  const canAsistencia = ctx &&
    (evento.estado === 'publicado' || evento.estado === 'en_curso') &&
    (canPerform(ctx, 'event.update', evento.organizacion_id ?? null) || esCentralizador)

  // Gestión del Evento: administrador, timonel, responsable, enlace o centralizador,
  // solo mientras el evento está publicado o en curso.
  const canGestion = ctx &&
    (evento.estado === 'publicado' || evento.estado === 'en_curso') &&
    (
      canPerform(ctx, 'event.update', evento.organizacion_id ?? null) ||
      (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false) ||
      esCentralizador
    )

  // Datos noticias panel: visible when pendiente_datos_noticias and user has permission
  const esSolicitante = ctx?.persona_id && ctx.persona_id === (evento as Record<string, unknown>).solicitado_por
  const canDatosNoticias = ctx && evento.estado === 'pendiente_datos_noticias' && (
    esSolicitante ||
    canPerform(ctx, 'event.approve_confra', evento.organizacion_id ?? null) ||
    canPerform(ctx, 'event.approve_eqt')
  )

  // Aprobación final panel: visible when pendiente_aprobacion_final and user is EqT
  const canAprobacionFinal = ctx &&
    evento.estado === 'pendiente_aprobacion_final' &&
    canPerform(ctx, 'event.approve_eqt')

  // Cierre de convivencia
  const canEditarCierrePanel = canEditarCierre(ctx, cierreEvento)
  const canVerConfidencial = canVerInformesConfidenciales(ctx, cierreEvento)
  const canEditarConfidencial = canVerConfidencial && evento.estado === 'finalizado'
  const canCerrar = canCerrarConvivencia(ctx, cierreEvento)

  const ESTADOS_TERMINALES = ['suspendido', 'cancelado', 'finalizado', 'cerrado', 'rechazado']

  // Suspender directo: solo Timonel, cualquier estado no-terminal excepto pendiente_aprobacion_final
  const canSuspend = ctx &&
    canPerform(ctx, 'event.suspend') &&
    !ESTADOS_TERMINALES.includes(evento.estado) &&
    evento.estado !== 'pendiente_aprobacion_final'

  // Solicitar suspensión: quien tenga el permiso (asignable) y no pueda suspender directo.
  // Aplica tanto a la confraternidad como a la fraternidad del evento (quien lo solicitó).
  const canSolicitarSuspension = ctx &&
    !canPerform(ctx, 'event.suspend') &&
    !ESTADOS_TERMINALES.includes(evento.estado) &&
    (canPerform(ctx, 'event.request_suspend', evento.organizacion_id ?? null) ||
      (evento.fraternidad_id ? canPerform(ctx, 'event.request_suspend', evento.fraternidad_id) : false))

  // Una vez publicado, el proceso de discernimiento/aprobación ya es historia —
  // se ocultan esos bloques y queda solo lo operativo (fechas, ubicación, equipo asignado).
  const ESTADOS_EVENTO_TERMINADO = ['publicado', 'en_curso', 'finalizado']
  const mostrarProcesoDiscernimiento = !ESTADOS_EVENTO_TERMINADO.includes(evento.estado)

  // Build discernimiento niveles for the panel
  type NivelDiscernimiento = {
    nivel: 'confra' | 'eqt'
    title: string
    yaRegistrado?: { estado: string; fecha: string | null; notas: string | null }
  }

  const discNiveles: NivelDiscernimiento[] = []

  if (ctx) {
    const estado = evento.estado
    const requiereConfra = evento.requiere_discernimiento_confra ?? false
    const requiereEqt = evento.requiere_discernimiento_eqt ?? false
    const confraId = evento.organizacion_id

    // Confra level — show if requiereConfra and user can approve_confra
    if (requiereConfra && canPerform(ctx, 'event.approve_confra', confraId)) {
      if (evento.disc_confra_estado) {
        // Already discerned — show read-only
        discNiveles.push({
          nivel: 'confra',
          title: 'Discernimiento Confraternidad / Delegado',
          yaRegistrado: {
            estado: evento.disc_confra_estado,
            fecha: evento.disc_confra_fecha ?? null,
            notas: evento.disc_confra_notas ?? null,
          },
        })
      } else if (estado === 'solicitud') {
        // Confra needs to act on this solicitud
        discNiveles.push({
          nivel: 'confra',
          title: 'Discernimiento Confraternidad / Delegado',
        })
      }
    }

    // EqT level — show only if requiereEqt and user can approve_eqt
    if (requiereEqt && canPerform(ctx, 'event.approve_eqt')) {
      if (evento.disc_eqt_estado) {
        discNiveles.push({
          nivel: 'eqt',
          title: 'Discernimiento Equipo Timón',
          yaRegistrado: {
            estado: evento.disc_eqt_estado,
            fecha: evento.disc_eqt_fecha ?? null,
            notas: evento.disc_eqt_notas ?? null,
          },
        })
      } else if (
        estado === 'discernimiento_confra' ||
        estado === 'discernimiento_eqt' ||
        (estado === 'solicitud' && !requiereConfra)
      ) {
        discNiveles.push({
          nivel: 'eqt',
          title: 'Discernimiento Equipo Timón',
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/eventos" className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver a Eventos
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {canPublish && <PublicarButton eventoId={id} />}
          {canIniciar && <IniciarEventoButton eventoId={id} />}
          {canGestion && (
            <Link href={`/eventos/${id}/gestion`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Settings2 className="h-4 w-4" />
                Gestionar evento
              </Button>
            </Link>
          )}
          {canAsistencia && (
            <Link href={`/eventos/${id}/asistencia`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Users className="h-4 w-4" />
                Tomar asistencia
              </Button>
            </Link>
          )}
          {showIE && (
            <Link href={`/eventos/${id}/informe-economico`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Wallet className="h-4 w-4" />
                Informe económico
              </Button>
            </Link>
          )}
          {canFinalizar && <FinalizarEventoButton eventoId={id} />}
          {canEdit && (
            <Link href={`/eventos/${id}/editar`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Edit2 className="h-4 w-4" />
                Editar
              </Button>
            </Link>
          )}
          {canSuspend && <SuspenderEventoButton eventoId={id} />}
        </div>
      </div>

      {/* Rejection notice — full width */}
      {evento.estado === 'rechazado' && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-5 space-y-1">
          <p className="font-semibold text-red-800 dark:text-red-300 text-sm uppercase tracking-wide">
            Solicitud Rechazada
          </p>
          {rechazadoPor && (
            <p className="text-sm text-red-700 dark:text-red-400">
              Rechazado por: {rechazadoPor.nombre} {rechazadoPor.apellido}
              {evento.fecha_rechazo && ` el ${formatDateAR(evento.fecha_rechazo)}`}
            </p>
          )}
          {evento.motivo_rechazo && (
            <p className="text-sm text-red-700 dark:text-red-400">Motivo: {evento.motivo_rechazo}</p>
          )}
        </div>
      )}

      {/* Suspension notice — full width */}
      {evento.estado === 'suspendido' && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30 p-5 space-y-1">
          <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm uppercase tracking-wide">
            Evento Suspendido
          </p>
          {(() => {
            const suspendidoPorPersona = (evento as Record<string, unknown>).suspendido_por_persona as { nombre: string; apellido: string } | null
            const fechaSuspension = (evento as Record<string, unknown>).fecha_suspension as string | null
            const notasSuspension = (evento as Record<string, unknown>).notas_suspension as string | null
            return (
              <>
                {suspendidoPorPersona && (
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    Suspendido por: {suspendidoPorPersona.nombre} {suspendidoPorPersona.apellido}
                    {fechaSuspension && ` el ${formatDateAR(fechaSuspension)}`}
                  </p>
                )}
                {notasSuspension && (
                  <p className="text-sm text-orange-700 dark:text-orange-400">Motivo: {notasSuspension}</p>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Suspension request notice — full width. Visible cuando hay una solicitud pendiente
          (motivo cargado por quien la solicitó) y el evento aún no fue suspendido/terminal.
          Le muestra al Equipo Timón el porqué de la solicitud antes de resolverla. */}
      {(() => {
        const solicitudNotas = (evento as Record<string, unknown>).solicitud_suspension_notas as string | null
        const solicitudFecha = (evento as Record<string, unknown>).solicitud_suspension_fecha as string | null
        const solicitudPor = (evento as Record<string, unknown>).solicitud_suspension_por_persona as { nombre: string; apellido: string } | null
        if (!solicitudNotas || ESTADOS_TERMINALES.includes(evento.estado)) return null
        return (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-5 space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm uppercase tracking-wide">
              Solicitud de Suspensión Pendiente
            </p>
            {solicitudPor && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Solicitada por: {solicitudPor.nombre} {solicitudPor.apellido}
                {solicitudFecha && ` el ${formatDateAR(solicitudFecha)}`}
              </p>
            )}
            <p className="text-sm text-amber-700 dark:text-amber-400">Motivo: {solicitudNotas}</p>
          </div>
        )
      })()}

      {/* Main grid: event card + sidebar */}
      <div className={discNiveles.length > 0 || canDatosNoticias || canAprobacionFinal || canSolicitarSuspension ? 'grid gap-6 lg:grid-cols-3 items-start' : undefined}>

      <Card className="border-border bg-card lg:col-span-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {tipoLabel[evento.tipo] ?? evento.tipo}
              </p>
              <CardTitle className="text-2xl text-foreground">{evento.nombre}</CardTitle>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${estadoClases[evento.estado] ?? estadoClases.borrador}`}>
              {estadoLabel[evento.estado] ?? evento.estado}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Organización */}
          <div className="grid gap-3 sm:grid-cols-2">
            {confraternidad && (
              <div className="flex items-start gap-2 text-sm">
                <Users className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Confraternidad</p>
                  <Link href={`/organizaciones/${confraternidad.id}`} className="text-primary underline underline-offset-2 hover:opacity-80">
                    {confraternidad.nombre}
                  </Link>
                </div>
              </div>
            )}
            {fraternidad && (
              <div className="flex items-start gap-2 text-sm">
                <Users className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fraternidad</p>
                  <Link href={`/organizaciones/${fraternidad.id}`} className="text-primary underline underline-offset-2 hover:opacity-80">
                    {fraternidad.nombre}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Fechas y modalidad */}
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Fechas propuestas</p>
                <p className="text-foreground">{formatDateAR(evento.fecha_inicio)} — {formatDateAR(evento.fecha_fin)}</p>
              </div>
            </div>
            <Field label="Modalidad" value={evento.modalidad} />
            <div>
              <p className="text-xs text-muted-foreground">Costo</p>
              {evento.es_apv ? (
                <p className="text-sm text-foreground">De Aporte Voluntario (DAV)</p>
              ) : (evento as Record<string, unknown>).precio != null && Number((evento as Record<string, unknown>).precio) > 0 ? (
                <p className="text-sm text-foreground">${Number((evento as Record<string, unknown>).precio).toLocaleString('es-AR')}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sin definir</p>
              )}
            </div>
          </div>

          {/* Fechas de ejecución */}
          {fechasEjecucion && fechasEjecucion.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fechas de ejecución</p>
              <div className="space-y-1">
                {(fechasEjecucion as Array<{ id: string; fecha_inicio: string; fecha_fin: string }>).map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground w-16">Período {i + 1}</span>
                    <span className="text-foreground">{formatDateAR(f.fecha_inicio)} — {formatDateAR(f.fecha_fin)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ubicación */}
          {(evento.ciudad || evento.provincia_evento) && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="grid gap-2 sm:grid-cols-3 flex-1">
                <Field label="Ciudad" value={evento.ciudad} />
                <Field label="Provincia" value={evento.provincia_evento} />
                <Field label="País" value={evento.pais_evento} />
                <Field label="CP" value={evento.codigo_postal} />
                <Field label="Diócesis" value={evento.diocesis} />
              </div>
            </div>
          )}

          {/* Casa de retiro */}
          {casaRetiro && (
            <div className="border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Casa de Retiro</p>
                <Link href={`/casas-retiro/${casaRetiro.id}`} className="text-primary underline underline-offset-2 hover:opacity-80 font-medium">
                  {casaRetiro.nombre}
                </Link>
                {(casaRetiro.ciudad || casaRetiro.provincia) && (
                  <p className="text-xs text-muted-foreground">{[casaRetiro.ciudad, casaRetiro.provincia].filter(Boolean).join(', ')}</p>
                )}
                {casaRetiro.link_maps && (
                  <a href={casaRetiro.link_maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                    <MapPin className="h-3 w-3" />
                    Ver en Google Maps
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Personas propuestas — visible durante el discernimiento; una vez publicado
              queda la sección "Personas asignadas (Equipo Timón)" como fuente definitiva. */}
          {evento.disc_confra_estado && (evento.coordinadores_propuestos || evento.asesor_propuesto) &&
            mostrarProcesoDiscernimiento && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Personas propuestas (Confraternidad)</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {evento.coordinadores_propuestos && (
                  <div>
                    <p className="text-xs text-muted-foreground">Coordinador/es</p>
                    <div className="space-y-0.5">
                      {String(evento.coordinadores_propuestos).split(',').map((v, i) => {
                        const { texto, personaId } = resolveVal(v)
                        return personaId ? (
                          <Link key={i} href={`/personas/${personaId}`} className="block text-primary underline underline-offset-2 hover:opacity-80 font-medium">
                            {texto}
                          </Link>
                        ) : (
                          <p key={i} className="text-foreground">{texto}</p>
                        )
                      })}
                    </div>
                  </div>
                )}
                {evento.asesor_propuesto && (
                  <div>
                    <p className="text-xs text-muted-foreground">Asesor</p>
                    {(() => {
                      const { texto, personaId } = resolveVal(String(evento.asesor_propuesto))
                      return personaId ? (
                        <Link href={`/personas/${personaId}`} className="text-primary underline underline-offset-2 hover:opacity-80 font-medium">
                          {texto}
                          {evento.asesor_voluntario && <span className="ml-2 text-xs text-muted-foreground font-normal">(voluntario)</span>}
                        </Link>
                      ) : (
                        <p className="text-foreground">
                          {texto}
                          {evento.asesor_voluntario && <span className="ml-2 text-xs text-muted-foreground">(voluntario)</span>}
                        </p>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coordinador y asesor asignados por EqT */}
          {(coordinadorAsignado || asesorAsignado) && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Personas asignadas (Equipo Timón)</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {coordinadorAsignado && (
                  <div>
                    <p className="text-xs text-muted-foreground">Coordinador asignado</p>
                    <Link href={`/personas/${coordinadorAsignado.id}`} className="text-primary underline underline-offset-2 hover:opacity-80 font-medium">
                      {coordinadorAsignado.nombre} {coordinadorAsignado.apellido}
                    </Link>
                  </div>
                )}
                {asesorAsignado && (
                  <div>
                    <p className="text-xs text-muted-foreground">Asesor asignado</p>
                    <Link href={`/personas/${asesorAsignado.id}`} className="text-primary underline underline-offset-2 hover:opacity-80 font-medium">
                      {asesorAsignado.nombre} {asesorAsignado.apellido}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Centralizadores — always show on published events */}
          {(() => {
            const centralizadoresList = [
              { personaId: (evento as Record<string, unknown>).centralizador_1_persona_id as string | null, nombre: evento.centralizador_1_nombre as string | null, email: evento.centralizador_1_email as string | null, telefono: evento.centralizador_1_telefono as string | null, label: 'Centralizador 1' },
              { personaId: (evento as Record<string, unknown>).centralizador_2_persona_id as string | null, nombre: evento.centralizador_2_nombre as string | null, email: evento.centralizador_2_email as string | null, telefono: evento.centralizador_2_telefono as string | null, label: 'Centralizador 2' },
              { personaId: (evento as Record<string, unknown>).centralizador_3_persona_id as string | null, nombre: evento.centralizador_3_nombre as string | null, email: evento.centralizador_3_email as string | null, telefono: evento.centralizador_3_telefono as string | null, label: 'Centralizador 3' },
            ]
            const tieneAlguno = centralizadoresList.some(c => c.nombre)
            const showSection = tieneAlguno || evento.estado === 'publicado' || evento.estado === 'finalizado'
            if (!showSection) return null
            return (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Centralizadores</p>
                {tieneAlguno ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {centralizadoresList.filter(c => c.nombre).map((c) => (
                      <div key={c.label} className="space-y-0.5 text-sm">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        {c.personaId ? (
                          <Link href={`/personas/${c.personaId}`} className="block font-medium text-primary underline underline-offset-2 hover:opacity-80">
                            {c.nombre}
                          </Link>
                        ) : (
                          <p className="font-medium text-foreground">{c.nombre}</p>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="block text-xs text-primary hover:underline truncate">
                            {c.email}
                          </a>
                        )}
                        {c.telefono && (
                          <a href={`tel:${c.telefono}`} className="block text-xs text-primary hover:underline">
                            {c.telefono}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No definidos aún.</p>
                )}
              </div>
            )
          })()}

          {/* Discernimiento — proceso ya cerrado una vez publicado el evento */}
          {mostrarProcesoDiscernimiento && (
            <div className="grid gap-2 sm:grid-cols-2 text-sm border-t border-border pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Disc. Confraternidad / Delegado</p>
                <p className="text-foreground">{evento.requiere_discernimiento_confra ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Disc. Equipo Timón</p>
                <p className="text-foreground">{evento.requiere_discernimiento_eqt ? 'Sí' : 'No'}</p>
              </div>
            </div>
          )}

          {/* Notas del evento */}
          {evento.notas && (
            <div className="space-y-1 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Notas aclaratorias</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{evento.notas}</p>
            </div>
          )}

          {/* Notas de discernimiento */}
          {evento.notas_discernimiento && (
            <div className="space-y-1 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Notas de discernimiento</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{evento.notas_discernimiento}</p>
            </div>
          )}

          {/* Historial — proceso ya cerrado una vez publicado el evento */}
          {mostrarProcesoDiscernimiento && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Historial</p>

            {timelineHistorial.length > 0 && (
              <div className="space-y-1.5">
                {timelineHistorial.map((entrada, i) => (
                  <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                    <span className={`font-medium ${entrada.tipo === 'rechazo' ? 'text-destructive' : entrada.tipo === 'publicacion' ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                      {entrada.label}
                    </span>
                    {entrada.persona && (
                      entrada.personaId ? (
                        <span> · <Link href={`/personas/${entrada.personaId}`} className="text-primary underline underline-offset-1 hover:opacity-80">{entrada.persona}</Link></span>
                      ) : (
                        <span> · {entrada.persona}</span>
                      )
                    )}
                    <span> · {formatDateAR(entrada.fecha)}</span>
                    {entrada.extra && (
                      <p className="mt-0.5 pl-1 text-muted-foreground italic">{entrada.extra}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cambiosHistorial && cambiosHistorial.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cambios registrados</p>
                {(cambiosHistorial as Array<{
                  id: string
                  nivel_disc: string
                  campo: string
                  valor_anterior: string | null
                  valor_nuevo: string | null
                  fecha: string | null
                  modificado_por: string | null
                  modificado_por_persona: { nombre: string; apellido: string } | null
                }>).map((c) => {
                  const resolvedNuevo = c.valor_nuevo ? resolveVal(c.valor_nuevo) : null
                  const resolvedAnterior = c.valor_anterior ? resolveVal(c.valor_anterior) : null
                  const modPor = c.modificado_por_persona
                  const modPorId = c.modificado_por
                  return (
                    <div key={c.id} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                      <span className="font-medium text-foreground">{campoLabel[c.campo] ?? c.campo}</span>
                      {': '}
                      <span className="line-through opacity-60">
                        {resolvedAnterior ? resolvedAnterior.texto : '—'}
                      </span>
                      {' → '}
                      {resolvedNuevo?.personaId ? (
                        <Link href={`/personas/${resolvedNuevo.personaId}`} className="text-primary underline underline-offset-1 hover:opacity-80">
                          {resolvedNuevo.texto}
                        </Link>
                      ) : (
                        <span className="text-foreground">{resolvedNuevo ? resolvedNuevo.texto : '—'}</span>
                      )}
                      {modPor && (
                        modPorId ? (
                          <span> · <Link href={`/personas/${modPorId}`} className="text-primary underline underline-offset-1 hover:opacity-80">{modPor.nombre} {modPor.apellido}</Link></span>
                        ) : (
                          <span> · {modPor.nombre} {modPor.apellido}</span>
                        )
                      )}
                      <span> · {nivelDiscLabel[c.nivel_disc] ?? c.nivel_disc}</span>
                      {c.fecha && <span> · {formatDateAR(c.fecha.split('T')[0])}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Discernimiento sidebar */}
      {discNiveles.length > 0 && (
        <div className="lg:col-span-1 order-first lg:order-last">
          <div className="sticky top-6">
            <DiscernimientoPanel
              eventoId={id}
              niveles={discNiveles}
              evento={{
                nombre: evento.nombre,
                fecha_inicio: evento.fecha_inicio ?? null,
                fecha_fin: evento.fecha_fin ?? null,
                ciudad: evento.ciudad ?? null,
                provincia_evento: evento.provincia_evento ?? null,
                pais_evento: evento.pais_evento ?? null,
                codigo_postal: evento.codigo_postal ?? null,
                diocesis: evento.diocesis ?? null,
                coordinadores_propuestos: evento.coordinadores_propuestos ?? null,
                asesor_propuesto: evento.asesor_propuesto ?? null,
                asesor_voluntario: evento.asesor_voluntario ?? null,
                modalidad: evento.modalidad ?? null,
                notas: evento.notas ?? null,
                casa_retiro_id: (evento as Record<string, unknown>).casa_retiro_id as string | null,
                coordinador_asignado_id: (evento as Record<string, unknown>).coordinador_asignado_id as string | null,
                asesor_asignado_id: (evento as Record<string, unknown>).asesor_asignado_id as string | null,
              }}
              fechasEjecucion={(fechasEjecucion ?? []) as { id: string; fecha_inicio: string; fecha_fin: string }[]}
              casasRetiro={(casasRetiro ?? []) as { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }[]}
              personas={(personasCecistas ?? []) as { id: string; nombre: string; apellido: string }[]}
              coordinadoresRol={coordinadoresRolDisponibles}
              asesoresRol={asesoresRolDisponibles}
              serviciosBusqueda={personasServidoresFamiliares}
            />
          </div>
        </div>
      )}

      {/* Datos Noticias sidebar */}
      {canDatosNoticias && (
        <div className="lg:col-span-1 order-first lg:order-last">
          <div className="sticky top-6">
            <DatosNoticiasPannel
              eventoId={id}
              inicial={{
                casa_retiro_id: (evento as Record<string, unknown>).casa_retiro_id as string | null,
                precio: (evento as Record<string, unknown>).precio as number | null,
                pension: (evento as Record<string, unknown>).pension as number | null,
                centralizador_1_persona_id: (evento as Record<string, unknown>).centralizador_1_persona_id as string | null,
                centralizador_1_nombre: (evento as Record<string, unknown>).centralizador_1_nombre as string | null,
                centralizador_1_email: (evento as Record<string, unknown>).centralizador_1_email as string | null,
                centralizador_1_telefono: (evento as Record<string, unknown>).centralizador_1_telefono as string | null,
                centralizador_2_persona_id: (evento as Record<string, unknown>).centralizador_2_persona_id as string | null,
                centralizador_2_nombre: (evento as Record<string, unknown>).centralizador_2_nombre as string | null,
                centralizador_2_email: (evento as Record<string, unknown>).centralizador_2_email as string | null,
                centralizador_2_telefono: (evento as Record<string, unknown>).centralizador_2_telefono as string | null,
                centralizador_3_persona_id: (evento as Record<string, unknown>).centralizador_3_persona_id as string | null,
                centralizador_3_nombre: (evento as Record<string, unknown>).centralizador_3_nombre as string | null,
                centralizador_3_email: (evento as Record<string, unknown>).centralizador_3_email as string | null,
                centralizador_3_telefono: (evento as Record<string, unknown>).centralizador_3_telefono as string | null,
                manuales_stock: (evento as Record<string, unknown>).manuales_stock as number | null,
                manuales_necesarios: (evento as Record<string, unknown>).manuales_necesarios as number | null,
                notas_noticias: (evento as Record<string, unknown>).notas_noticias as string | null,
              }}
              casasRetiro={(casasRetiro ?? []) as { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }[]}
              personas={(personasCecistas ?? []) as { id: string; nombre: string; apellido: string; email?: string | null; telefono?: string | null }[]}
              motivoDevolucion={(evento as Record<string, unknown>).notas_aprobacion_final as string | null}
            />
          </div>
        </div>
      )}

      {/* Aprobación Final sidebar (EqT) */}
      {canAprobacionFinal && (
        <div className="lg:col-span-1 order-first lg:order-last">
          <div className="sticky top-6">
            <AprobacionFinalPanel
              eventoId={id}
              inicial={{
                casa_retiro_id: (evento as Record<string, unknown>).casa_retiro_id as string | null,
                coordinador_asignado_id: (evento as Record<string, unknown>).coordinador_asignado_id as string | null,
                asesor_asignado_id: (evento as Record<string, unknown>).asesor_asignado_id as string | null,
                centralizador_1_persona_id: (evento as Record<string, unknown>).centralizador_1_persona_id as string | null,
                centralizador_1_nombre: (evento as Record<string, unknown>).centralizador_1_nombre as string | null,
                centralizador_1_email: (evento as Record<string, unknown>).centralizador_1_email as string | null,
                centralizador_1_telefono: (evento as Record<string, unknown>).centralizador_1_telefono as string | null,
                centralizador_2_persona_id: (evento as Record<string, unknown>).centralizador_2_persona_id as string | null,
                centralizador_2_nombre: (evento as Record<string, unknown>).centralizador_2_nombre as string | null,
                centralizador_2_email: (evento as Record<string, unknown>).centralizador_2_email as string | null,
                centralizador_2_telefono: (evento as Record<string, unknown>).centralizador_2_telefono as string | null,
                centralizador_3_persona_id: (evento as Record<string, unknown>).centralizador_3_persona_id as string | null,
                centralizador_3_nombre: (evento as Record<string, unknown>).centralizador_3_nombre as string | null,
                centralizador_3_email: (evento as Record<string, unknown>).centralizador_3_email as string | null,
                centralizador_3_telefono: (evento as Record<string, unknown>).centralizador_3_telefono as string | null,
                notas_aprobacion_final: (evento as Record<string, unknown>).notas_aprobacion_final as string | null,
              }}
              casasRetiro={(casasRetiro ?? []) as { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }[]}
              personas={(personasCecistas ?? []) as { id: string; nombre: string; apellido: string; email?: string | null; telefono?: string | null }[]}
            />
          </div>
        </div>
      )}

      {/* Solicitar Suspensión sidebar (confra/solicitante) */}
      {canSolicitarSuspension && (
        <div className="lg:col-span-1 order-first lg:order-last">
          <div className="sticky top-6">
            <SolicitarSuspensionPanel
              eventoId={id}
              inicial={{
                solicitud_suspension_notas: (evento as Record<string, unknown>).solicitud_suspension_notas as string | null,
                solicitud_suspension_fecha: (evento as Record<string, unknown>).solicitud_suspension_fecha as string | null,
              }}
            />
          </div>
        </div>
      )}

      </div>

      {/* Becas en Pensión — visible mientras el evento está publicado/en curso/finalizado */}
      {canPension && (
        <PensionBecasPanel
          eventoId={id}
          precioEvento={{
            cuota_inscripcion: Number((evento as Record<string, unknown>).precio ?? 0),
            pension: Number((evento as Record<string, unknown>).pension ?? 0),
          }}
          participantes={participantesPension.map(p => ({
            id: p.id,
            persona: p.persona,
            valor_inscripcion: p.valor_inscripcion,
            valor_pension: p.valor_pension,
            beca_pension: p.beca_pension,
            notas_beca: p.notas_beca,
          }))}
        />
      )}

      {/* Cierre de la Convivencia — visible en finalizado/cerrado a quien tenga acceso */}
      {showCierre && (
        <CierrePanel
          eventoId={id}
          estado={evento.estado}
          eventoInfo={{
            nombre: evento.nombre,
            fecha_inicio: evento.fecha_inicio ?? null,
            confraternidad_nombre: confraternidad?.nombre ?? null,
          }}
          canEditar={!!canEditarCierrePanel}
          canVerConfidencial={!!canVerConfidencial}
          canEditarConfidencial={!!canEditarConfidencial}
          canCerrar={!!canCerrar}
          conviventes={conviventesCierre}
          servidores={servidoresCierre}
          cecistas={cecistasSoloList}
          preguntas={preguntasInforme}
          canVerInformeEconomico={showIE}
          inicial={{
            cierre_foto_convivencia_url: (ev.cierre_foto_convivencia_url as string | null) ?? null,
            cierre_foto_servidores_url: (ev.cierre_foto_servidores_url as string | null) ?? null,
            cierre_bolso_manuales_completo: (ev.cierre_bolso_manuales_completo as boolean | null) ?? null,
            cierre_manuales_saldo_final: (ev.cierre_manuales_saldo_final as number | null) ?? null,
            cierre_manuales_recibidos_de: (ev.cierre_manuales_recibidos_de as string | null) ?? null,
            cierre_manuales_entrego_a: (ev.cierre_manuales_entrego_a as string | null) ?? null,
            cierre_manuales_notas: (ev.cierre_manuales_notas as string | null) ?? null,
            // Confidenciales: solo se envían al cliente si el usuario tiene permiso de verlos —
            // de lo contrario viajarían en el payload aunque la UI las oculte.
            informe_coordinador_respuestas: canVerConfidencial ? (ev.informe_coordinador_respuestas as Record<string, string> | null) ?? null : null,
            informe_carismas: canVerConfidencial ? (ev.informe_carismas as { persona_id: string; texto: string }[] | null) ?? null : null,
          }}
        />
      )}

      {/* Flyers — admin only, desde Pendiente Datos Noticias */}
      {ctx?.is_admin && muestraFlyers(evento.estado) && (
        <FlyerUploadPanel
          eventoId={id}
          flyerHorizontalUrl={(ev.flyer_horizontal_url as string | null) ?? null}
          flyerCuadradoUrl={(ev.flyer_cuadrado_url as string | null) ?? null}
        />
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, MapPin, Users, Wallet, ClipboardList, ExternalLink } from 'lucide-react'
import { formatDateAR } from '@/lib/utils'
import { esCentralizadorDeEvento, ROLES_SERVIDORES, formatMonto } from '@/lib/eventos/cierre'
import { canGestionarPension } from '@/lib/eventos/pension'
import { canGestionarAsignaciones, canGestionarParticipantes, ROLES_EVENTO_LABEL } from '@/lib/eventos/equipo'
import { cargarGruposDelEvento } from '@/lib/eventos/grupos'
import PensionBecasPanel from '../_components/pension-becas-panel'
import EquipoEventoPanel, {
  type AsignacionesEvento,
  type ParticipanteEquipo,
} from '../_components/equipo-evento-panel'
import { CopyLinkButton } from './_components/copy-link-button'

const estadoClases: Record<string, string> = {
  publicado: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  en_curso: 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
}

const estadoLabel: Record<string, string> = {
  publicado: 'Publicado',
  en_curso: 'En Curso',
}

const participacionClases: Record<string, string> = {
  interesado: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  inscripto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  en_curso: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

const participacionLabel: Record<string, string> = {
  interesado: 'Interesado',
  inscripto: 'Inscripto',
  en_curso: 'Conviviente',
}

type ParticipanteRow = {
  id: string
  persona_id: string
  rol_en_evento: string
  estado_participacion: string
  fecha_inscripcion: string | null
  valor_inscripcion: number | null
  valor_pension: number | null
  beca_pension: number
  grupo_id: string | null
  notas: string | null
  notas_beca: string | null
  persona: { id: string; nombre: string; apellido: string; email: string | null; telefono: string | null } | null
}

export default async function EventoGestionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx) redirect('/auth/login')

  const { data: evento } = await supabase
    .from('eventos')
    .select(`
      id, nombre, tipo, estado, fecha_inicio, fecha_fin, ciudad, provincia_evento,
      precio, pension, cupo_maximo,
      organizacion_id, fraternidad_id, tipo_evento_id,
      coordinador_asignado_id, asesor_asignado_id,
      centralizador_1_persona_id, centralizador_1_nombre, centralizador_1_email, centralizador_1_telefono,
      centralizador_2_persona_id, centralizador_2_nombre, centralizador_2_email, centralizador_2_telefono,
      centralizador_3_persona_id, centralizador_3_nombre, centralizador_3_email, centralizador_3_telefono,
      confraternidad:organizaciones!organizacion_id(id, nombre),
      fraternidad:organizaciones!fraternidad_id(id, nombre)
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const cierreEvento = {
    estado: evento.estado,
    organizacion_id: evento.organizacion_id ?? null,
    fraternidad_id: evento.fraternidad_id ?? null,
    coordinador_asignado_id: (evento as Record<string, unknown>).coordinador_asignado_id as string | null,
    centralizador_1_persona_id: (evento as Record<string, unknown>).centralizador_1_persona_id as string | null,
    centralizador_2_persona_id: (evento as Record<string, unknown>).centralizador_2_persona_id as string | null,
    centralizador_3_persona_id: (evento as Record<string, unknown>).centralizador_3_persona_id as string | null,
  }

  const canManage =
    canPerform(ctx, 'event.update', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id ? canPerform(ctx, 'event.update', evento.fraternidad_id) : false) ||
    esCentralizadorDeEvento(ctx, cierreEvento)

  if (!canManage) notFound()

  const confraternidad = evento.confraternidad as { id: string; nombre: string } | null
  const fraternidad = evento.fraternidad as { id: string; nombre: string } | null

  const disponible = evento.estado === 'publicado' || evento.estado === 'en_curso'

  if (!disponible) {
    return (
      <div className="space-y-6">
        <Link href={`/eventos/${id}`} className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver a {evento.nombre}
        </Link>
        <div className="rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground">
          La Gestión del Evento solo está disponible mientras el evento está <strong>publicado</strong> o{' '}
          <strong>en curso</strong>. Estado actual: <strong>{evento.estado}</strong>.
        </div>
      </div>
    )
  }

  const { data: participantesRaw } = await supabase
    .from('evento_participantes')
    .select(
      'id, persona_id, rol_en_evento, estado_participacion, fecha_inscripcion, valor_inscripcion, valor_pension, beca_pension, grupo_id, notas, notas_beca, persona:personas!persona_id(id, nombre, apellido, email, telefono)'
    )
    .eq('evento_id', id)
    .order('fecha_inscripcion', { ascending: false })

  const participantes = (participantesRaw ?? []) as unknown as ParticipanteRow[]

  const conviventes = participantes.filter(
    p => p.rol_en_evento === 'convivente' && p.estado_participacion !== 'cancelado'
  )
  const equipos = participantes.filter(
    p => (ROLES_SERVIDORES as readonly string[]).includes(p.rol_en_evento) && p.estado_participacion !== 'cancelado'
  )

  const conteoConvivientes = {
    interesado: conviventes.filter(p => p.estado_participacion === 'interesado').length,
    inscripto: conviventes.filter(p => p.estado_participacion === 'inscripto').length,
    en_curso: conviventes.filter(p => p.estado_participacion === 'en_curso').length,
  }

  const { data: pagosEvento } = await supabase
    .from('pagos')
    .select('monto, estado_pago, concepto, participante:evento_participantes!evento_participante_id!inner(evento_id)')
    .eq('participante.evento_id', id)

  const resumenPagos = {
    inscripcion: { confirmado: 0, pendiente: 0 },
    pension: { confirmado: 0, pendiente: 0 },
  }
  for (const p of (pagosEvento ?? []) as { monto: number; estado_pago: string; concepto: string | null }[]) {
    const c: 'inscripcion' | 'pension' = p.concepto === 'pension' ? 'pension' : 'inscripcion'
    if (p.estado_pago === 'confirmado') resumenPagos[c].confirmado += Number(p.monto)
    else if (p.estado_pago === 'pendiente') resumenPagos[c].pendiente += Number(p.monto)
  }

  // Editar el equipo del evento: las asignaciones (coordinador/asesor/centralizadores)
  // quedan para quien tenga event.update; el padrón, también para el centralizador.
  const canAsignaciones = canGestionarAsignaciones(ctx, cierreEvento)
  const canParticipantes = canGestionarParticipantes(ctx, cierreEvento)

  const { grupos, nombresGrupos } = canParticipantes
    ? await cargarGruposDelEvento(supabase, id, (evento as Record<string, unknown>).tipo_evento_id as string | null)
    : { grupos: [], nombresGrupos: [] }

  const canPension = canGestionarPension(ctx, cierreEvento)
  const participantesPension = canPension
    ? conviventes.map(p => ({
        id: p.id,
        persona: p.persona,
        valor_inscripcion: p.valor_inscripcion,
        valor_pension: p.valor_pension,
        beca_pension: p.beca_pension,
        notas_beca: p.notas_beca,
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href={`/eventos/${id}`} className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver a {evento.nombre}
        </Link>
        <Link href={`/eventos/${id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Ver ficha del evento
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Gestión — {evento.nombre}</h1>
          <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${estadoClases[evento.estado]}`}>
            {estadoLabel[evento.estado]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {(evento.fecha_inicio || evento.fecha_fin) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateAR(evento.fecha_inicio)} — {formatDateAR(evento.fecha_fin)}
            </span>
          )}
          {(evento.ciudad || evento.provincia_evento) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {[evento.ciudad, evento.provincia_evento].filter(Boolean).join(', ')}
            </span>
          )}
          {confraternidad && <span>{confraternidad.nombre}{fraternidad ? ` · ${fraternidad.nombre}` : ''}</span>}
        </div>
      </div>

      {/* Inscripción y Pensión: links y montos */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5 text-primary" />
            Inscripción y Pensión
          </CardTitle>
          <CardDescription>Enlace público del evento y montos vigentes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Enlace público de inscripción</p>
              <p className="text-sm text-muted-foreground">Compartilo con quienes se quieran inscribir.</p>
            </div>
            <CopyLinkButton path={`/e/${id}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Monto de Inscripción</p>
              <p className="text-lg font-semibold text-foreground">${formatMonto(Number(evento.precio ?? 0))}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Monto de Pensión</p>
              <p className="text-lg font-semibold text-foreground">${formatMonto(Number(evento.pension ?? 0))}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Recaudado — Inscripción</p>
              <p className="text-sm text-foreground">
                Confirmado: <strong>${formatMonto(resumenPagos.inscripcion.confirmado)}</strong>
                {resumenPagos.inscripcion.pendiente > 0 && (
                  <span className="text-muted-foreground"> · Pendiente: ${formatMonto(resumenPagos.inscripcion.pendiente)}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Recaudado — Pensión</p>
              <p className="text-sm text-foreground">
                Confirmado: <strong>${formatMonto(resumenPagos.pension.confirmado)}</strong>
                {resumenPagos.pension.pendiente > 0 && (
                  <span className="text-muted-foreground"> · Pendiente: ${formatMonto(resumenPagos.pension.pendiente)}</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipo y padrón editables. Reemplazan a las tarjetas de solo lectura de
          más abajo para quien puede gestionar el evento. */}
      {(canAsignaciones || canParticipantes) && (
        <EquipoEventoPanel
          eventoId={id}
          asignaciones={evento as unknown as AsignacionesEvento}
          participantes={participantes as unknown as ParticipanteEquipo[]}
          grupos={grupos}
          nombresGrupos={nombresGrupos}
          canAsignaciones={canAsignaciones}
          canParticipantes={canParticipantes}
        />
      )}

      {/* Convivientes: interesados / inscriptos / en curso */}
      {!canParticipantes && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Convivientes
            </CardTitle>
            <CardDescription>
              {conteoConvivientes.interesado} interesados · {conteoConvivientes.inscripto} inscriptos · {conteoConvivientes.en_curso} convivientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conviventes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay convivientes registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Apellido, Nombre</th>
                      <th className="px-3 py-2 font-medium">Contacto</th>
                      <th className="px-3 py-2 font-medium">Fecha inscripción</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conviventes.map(p => (
                      <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.persona?.telefono ?? p.persona?.email ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.fecha_inscripcion ? formatDateAR(p.fecha_inscripcion) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${participacionClases[p.estado_participacion] ?? ''}`}>
                            {participacionLabel[p.estado_participacion] ?? p.estado_participacion}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Equipos asignados */}
      {!canParticipantes && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ClipboardList className="h-5 w-5 text-primary" />
              Equipos Asignados
            </CardTitle>
            <CardDescription>{equipos.length} servidores registrados en el evento.</CardDescription>
          </CardHeader>
          <CardContent>
            {equipos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay equipo asignado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ROLES_SERVIDORES.map(rol => {
                  const lista = equipos.filter(p => p.rol_en_evento === rol)
                  if (lista.length === 0) return null
                  return (
                    <div key={rol} className="rounded-lg border border-border p-4 space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {ROLES_EVENTO_LABEL[rol] ?? rol}
                      </p>
                      {lista.map(p => (
                        <p key={p.id} className="text-sm text-foreground">
                          {p.persona ? `${p.persona.nombre} ${p.persona.apellido}` : '—'}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Becas en Pensión */}
      {canPension && (
        <PensionBecasPanel
          eventoId={id}
          precioEvento={{
            cuota_inscripcion: Number(evento.precio ?? 0),
            pension: Number(evento.pension ?? 0),
          }}
          participantes={participantesPension}
        />
      )}

      {/* Información económica y de cierre */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Información Económica y Cierre</CardTitle>
          <CardDescription>
            El detalle de movimientos, informes y el cierre de la convivencia se habilitan cuando el evento finaliza.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/eventos/${id}`}>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              Ver ficha del evento
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

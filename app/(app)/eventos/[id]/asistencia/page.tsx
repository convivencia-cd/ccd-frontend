export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'
import { formatDateAR } from '@/lib/utils'
import { AsistenciaCheckin } from './asistencia-checkin'

export default async function AsistenciaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx) redirect('/auth/login')

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nombre, estado, organizacion_id, fecha_inicio, fecha_fin, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()

  if (!evento) notFound()

  // Tomar asistencia es tarea del Centralizador, que no tiene event.update.
  if (
    !canPerform(ctx, 'event.update', evento.organizacion_id ?? null) &&
    !esCentralizadorDeEvento(ctx, evento)
  ) {
    notFound()
  }

  const puedeTomar = evento.estado === 'publicado' || evento.estado === 'en_curso'

  const { data: participantesRaw } = await supabase
    .from('evento_participantes')
    .select(`
      id, rol_en_evento, estado_participacion, fecha_asistencia, asistencia_metodo,
      persona:personas!persona_id(id, nombre, apellido, email)
    `)
    .eq('evento_id', id)
    .in('estado_participacion', ['inscripto', 'en_curso'])

  type ParticipanteRow = {
    id: string
    rol_en_evento: string
    estado_participacion: string
    fecha_asistencia: string | null
    asistencia_metodo: string | null
    persona: { id: string; nombre: string; apellido: string; email: string | null } | null
  }

  const participantes = ((participantesRaw as unknown as ParticipanteRow[]) ?? [])
    .map((p) => ({
      ...p,
      persona: Array.isArray(p.persona) ? (p.persona[0] ?? null) : p.persona,
    }))
    .sort((a, b) => {
      const an = a.persona ? `${a.persona.apellido} ${a.persona.nombre}` : ''
      const bn = b.persona ? `${b.persona.apellido} ${b.persona.nombre}` : ''
      return an.localeCompare(bn)
    })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/eventos/${id}`}
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al retiro
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
          Tomar asistencia
        </h1>
        <p className="mt-1 text-muted-foreground">
          {evento.nombre}
          {evento.fecha_inicio ? ` · ${formatDateAR(evento.fecha_inicio)}` : ''}
        </p>
      </div>

      {!puedeTomar ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground">
          Solo se puede tomar asistencia en retiros publicados o en curso. Estado actual:{' '}
          <strong>{evento.estado}</strong>.
        </div>
      ) : (
        <AsistenciaCheckin
          eventoId={id}
          estadoEvento={evento.estado}
          participantes={participantes}
        />
      )}
    </div>
  )
}

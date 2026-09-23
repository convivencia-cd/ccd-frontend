export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { canGestionarAsignaciones, canGestionarParticipantes } from '@/lib/eventos/equipo'
import { cargarGruposDelEvento } from '@/lib/eventos/grupos'
import EditarEventoForm from './form'
import EquipoEventoPanel, {
  type AsignacionesEvento,
  type ParticipanteEquipo,
} from '../_components/equipo-evento-panel'

export default async function EditarEventoPage({
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
      id, organizacion_id, fraternidad_id, tipo_evento_id,
      coordinador_asignado_id, asesor_asignado_id,
      centralizador_1_persona_id, centralizador_1_nombre, centralizador_1_email, centralizador_1_telefono,
      centralizador_2_persona_id, centralizador_2_nombre, centralizador_2_email, centralizador_2_telefono,
      centralizador_3_persona_id, centralizador_3_nombre, centralizador_3_email, centralizador_3_telefono
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  // Mismo criterio que el botón "Editar" del detalle: event.update scopeado a la
  // organización del evento o a su fraternidad.
  const canEdit =
    canPerform(ctx, 'event.update', evento.organizacion_id ?? null) ||
    (evento.fraternidad_id
      ? canPerform(ctx, 'event.update', evento.fraternidad_id)
      : false)

  if (!canEdit) notFound()

  const [{ data: participantesRaw }, { grupos, nombresGrupos }] = await Promise.all([
    supabase
      .from('evento_participantes')
      .select(
        'id, persona_id, rol_en_evento, estado_participacion, fecha_inscripcion, grupo_id, notas, persona:personas!persona_id(id, nombre, apellido, email, telefono)'
      )
      .eq('evento_id', id)
      .order('fecha_inscripcion', { ascending: false }),
    cargarGruposDelEvento(supabase, id, evento.tipo_evento_id ?? null),
  ])

  return (
    <div className="space-y-6">
      <EditarEventoForm isAdmin={ctx.is_admin} />
      <div className="max-w-2xl">
        <EquipoEventoPanel
          eventoId={id}
          asignaciones={evento as unknown as AsignacionesEvento}
          participantes={(participantesRaw ?? []) as unknown as ParticipanteEquipo[]}
          grupos={grupos}
          nombresGrupos={nombresGrupos}
          canAsignaciones={canGestionarAsignaciones(ctx, evento)}
          canParticipantes={canGestionarParticipantes(ctx, evento)}
        />
      </div>
    </div>
  )
}

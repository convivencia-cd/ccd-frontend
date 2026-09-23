import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import {
  ESTADOS_PARTICIPACION,
  ROLES_EVENTO,
  ROLES_EVENTO_LABEL,
  canGestionarParticipantes,
} from '@/lib/eventos/equipo'

type EventoScope = {
  id: string
  organizacion_id: string | null
  fraternidad_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

async function cargarEventoAutorizado(id: string) {
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return { error: 'No autenticado', status: 401 as const, supabase: null, evento: null }

  const { data: evento } = await supabase
    .from('eventos')
    .select(
      'id, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id'
    )
    .eq('id', id)
    .single()

  if (!evento) return { error: 'Evento no encontrado', status: 404 as const, supabase: null, evento: null }

  if (!canGestionarParticipantes(ctx, evento as EventoScope)) {
    return {
      error: 'No tenés permiso para gestionar los participantes de este evento',
      status: 403 as const,
      supabase: null,
      evento: null,
    }
  }

  return { error: null, status: 200 as const, supabase, evento: evento as EventoScope }
}

function validarRolYEstado(rol: unknown, estado: unknown): string | null {
  if (rol !== undefined && !ROLES_EVENTO.includes(String(rol))) return 'Rol en el evento inválido'
  if (estado !== undefined && !ESTADOS_PARTICIPACION.includes(String(estado))) return 'Estado de participación inválido'
  return null
}

// POST — sumar una persona al evento (inscripto o servidor del equipo)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const body = (await request.json()) as {
    persona_id?: string
    rol_en_evento?: string
    estado_participacion?: string
    notas?: string | null
  }

  if (!body.persona_id) {
    return NextResponse.json({ error: 'Seleccioná una persona' }, { status: 400 })
  }

  const rol = body.rol_en_evento ?? 'convivente'
  const estado = body.estado_participacion ?? 'inscripto'
  const invalido = validarRolYEstado(rol, estado)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  const { data: persona } = await supabase
    .from('personas')
    .select('id, nombre, apellido, tipo_persona')
    .eq('id', body.persona_id)
    .single()

  if (!persona) return NextResponse.json({ error: 'La persona no existe' }, { status: 404 })

  // evento_participantes tiene UNIQUE(evento_id, persona_id): si la persona ya
  // figura, se reactiva la fila dada de baja en vez de crear una nueva.
  const { data: existente } = await supabase
    .from('evento_participantes')
    .select('id, rol_en_evento, estado_participacion')
    .eq('evento_id', id)
    .eq('persona_id', body.persona_id)
    .maybeSingle()

  if (existente) {
    if (existente.estado_participacion !== 'cancelado') {
      return NextResponse.json(
        {
          error: `${persona.nombre} ${persona.apellido} ya figura en el evento como ${
            ROLES_EVENTO_LABEL[existente.rol_en_evento] ?? existente.rol_en_evento
          }. Cambiá su rol o su estado desde la lista.`,
        },
        { status: 409 }
      )
    }

    const { error: reactivarError } = await supabase
      .from('evento_participantes')
      .update({
        rol_en_evento: rol,
        estado_participacion: estado,
        notas: body.notas?.trim() || null,
      })
      .eq('id', existente.id)

    if (reactivarError) return NextResponse.json({ error: reactivarError.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: existente.id, reactivado: true })
  }

  const { data: creado, error: insertError } = await supabase
    .from('evento_participantes')
    .insert({
      evento_id: id,
      persona_id: body.persona_id,
      rol_en_evento: rol,
      estado_participacion: estado,
      tipo_participante: persona.tipo_persona === 'cecista' ? 'cecista' : 'no_cecista',
      notas: body.notas?.trim() || null,
    })
    .select('id')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  return NextResponse.json({ ok: true, id: creado.id })
}

// PATCH — cambiar rol, estado o notas de alguien ya cargado en el evento
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const body = (await request.json()) as {
    participante_id?: string
    rol_en_evento?: string
    estado_participacion?: string
    notas?: string | null
  }

  if (!body.participante_id) {
    return NextResponse.json({ error: 'Falta el participante a modificar' }, { status: 400 })
  }

  const invalido = validarRolYEstado(body.rol_en_evento, body.estado_participacion)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.rol_en_evento !== undefined) updates.rol_en_evento = body.rol_en_evento
  if (body.estado_participacion !== undefined) updates.estado_participacion = body.estado_participacion
  if (body.notas !== undefined) updates.notas = body.notas?.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar' }, { status: 400 })
  }

  // .eq('evento_id', id) además del id de la fila: sin eso, un id de participante
  // de otro evento pasaría el chequeo de permisos hecho sobre ESTE evento.
  const { error: updateError } = await supabase
    .from('evento_participantes')
    .update(updates)
    .eq('id', body.participante_id)
    .eq('evento_id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// DELETE — baja lógica: el participante pasa a 'cancelado', la fila no se borra
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const participanteId = new URL(request.url).searchParams.get('participante_id')
  if (!participanteId) {
    return NextResponse.json({ error: 'Falta el participante a dar de baja' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('evento_participantes')
    .update({ estado_participacion: 'cancelado' })
    .eq('id', participanteId)
    .eq('evento_id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

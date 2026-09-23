import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canGestionarParticipantes } from '@/lib/eventos/equipo'

/**
 * Grupos de una convivencia (minuta #138): cada grupo tiene un nombre elegido
 * del listado del tipo de evento, 1 servidor a cargo y varios conviventes.
 * La asignación de conviventes a un grupo va por
 * PATCH /api/eventos/[id]/participantes con `grupo_id`.
 */

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

  if (!ctx) return { error: 'No autenticado', status: 401 as const, supabase: null }

  const { data: evento } = await supabase
    .from('eventos')
    .select(
      'id, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id'
    )
    .eq('id', id)
    .single()

  if (!evento) return { error: 'Evento no encontrado', status: 404 as const, supabase: null }

  if (!canGestionarParticipantes(ctx, evento as EventoScope)) {
    return {
      error: 'No tenés permiso para gestionar los grupos de este evento',
      status: 403 as const,
      supabase: null,
    }
  }

  return { error: null, status: 200 as const, supabase }
}

/**
 * El servidor a cargo tiene que ser alguien ya cargado en ESTE evento con rol
 * 'servidor'. Devuelve el mensaje de error, o null si está bien.
 */
async function validarServidor(
  supabase: NonNullable<Awaited<ReturnType<typeof cargarEventoAutorizado>>['supabase']>,
  eventoId: string,
  servidorParticipanteId: string
): Promise<string | null> {
  const { data: participante } = await supabase
    .from('evento_participantes')
    .select('id, rol_en_evento, estado_participacion')
    .eq('id', servidorParticipanteId)
    .eq('evento_id', eventoId)
    .maybeSingle()

  if (!participante) return 'El servidor elegido no está cargado en este evento'
  if (participante.rol_en_evento !== 'servidor') {
    return 'El responsable de un grupo tiene que estar cargado en el equipo con rol Servidor'
  }
  if (participante.estado_participacion === 'cancelado') {
    return 'El servidor elegido está dado de baja del evento'
  }
  return null
}

// POST — crear un grupo
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const body = (await request.json()) as { nombre?: string; servidor_participante_id?: string | null }

  const nombre = body.nombre?.trim()
  if (!nombre) return NextResponse.json({ error: 'Elegí un nombre para el grupo' }, { status: 400 })

  if (body.servidor_participante_id) {
    const problema = await validarServidor(supabase, id, body.servidor_participante_id)
    if (problema) return NextResponse.json({ error: problema }, { status: 400 })
  }

  const { data: creado, error: insertError } = await supabase
    .from('evento_grupos')
    .insert({
      evento_id: id,
      nombre,
      servidor_participante_id: body.servidor_participante_id || null,
    })
    .select('id')
    .single()

  // UNIQUE (evento_id, nombre): el mismo nombre no se repite en un evento.
  if (insertError) {
    const duplicado = insertError.code === '23505'
    return NextResponse.json(
      { error: duplicado ? `El evento ya tiene un grupo llamado "${nombre}"` : insertError.message },
      { status: duplicado ? 409 : 400 }
    )
  }

  return NextResponse.json({ ok: true, id: creado.id })
}

// PATCH — renombrar el grupo o cambiarle el servidor a cargo
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const body = (await request.json()) as {
    grupo_id?: string
    nombre?: string
    servidor_participante_id?: string | null
  }

  if (!body.grupo_id) return NextResponse.json({ error: 'Falta el grupo a modificar' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim()
    if (!nombre) return NextResponse.json({ error: 'El grupo necesita un nombre' }, { status: 400 })
    updates.nombre = nombre
  }

  if (body.servidor_participante_id !== undefined) {
    if (body.servidor_participante_id) {
      const problema = await validarServidor(supabase, id, body.servidor_participante_id)
      if (problema) return NextResponse.json({ error: problema }, { status: 400 })
    }
    updates.servidor_participante_id = body.servidor_participante_id || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('evento_grupos')
    .update(updates)
    .eq('id', body.grupo_id)
    .eq('evento_id', id)

  if (updateError) {
    const duplicado = updateError.code === '23505'
    return NextResponse.json(
      { error: duplicado ? 'El evento ya tiene un grupo con ese nombre' : updateError.message },
      { status: duplicado ? 409 : 400 }
    )
  }

  return NextResponse.json({ ok: true })
}

// DELETE — borrar el grupo. Los conviventes quedan sin grupo (FK ON DELETE SET NULL),
// no se los da de baja del evento.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, supabase } = await cargarEventoAutorizado(id)
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const grupoId = new URL(request.url).searchParams.get('grupo_id')
  if (!grupoId) return NextResponse.json({ error: 'Falta el grupo a borrar' }, { status: 400 })

  const { error: deleteError } = await supabase
    .from('evento_grupos')
    .delete()
    .eq('id', grupoId)
    .eq('evento_id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

type AprobacionFinalBody = {
  accion: 'publicar' | 'suspender' | 'devolver'
  notas_aprobacion_final?: string | null
  casa_retiro_id?: string | null
  coordinador_asignado_id?: string | null
  asesor_asignado_id?: string | null
  centralizador_1_persona_id?: string | null
  centralizador_1_nombre?: string | null
  centralizador_1_email?: string | null
  centralizador_1_telefono?: string | null
  centralizador_2_persona_id?: string | null
  centralizador_2_nombre?: string | null
  centralizador_2_email?: string | null
  centralizador_2_telefono?: string | null
  centralizador_3_persona_id?: string | null
  centralizador_3_nombre?: string | null
  centralizador_3_email?: string | null
  centralizador_3_telefono?: string | null
}

const CAMPOS_EDITABLES = [
  'casa_retiro_id',
  'coordinador_asignado_id',
  'asesor_asignado_id',
  'centralizador_1_persona_id', 'centralizador_1_nombre', 'centralizador_1_email', 'centralizador_1_telefono',
  'centralizador_2_persona_id', 'centralizador_2_nombre', 'centralizador_2_email', 'centralizador_2_telefono',
  'centralizador_3_persona_id', 'centralizador_3_nombre', 'centralizador_3_email', 'centralizador_3_telefono',
] as const

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!canPerform(ctx, 'event.approve_eqt')) {
    return NextResponse.json({ error: 'Solo el Equipo Timón puede realizar la aprobación final' }, { status: 403 })
  }

  const { data: evento, error: fetchError } = await supabase
    .from('eventos')
    .select('id, estado')
    .eq('id', id)
    .single()

  if (fetchError || !evento) {
    return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  }

  if (evento.estado !== 'pendiente_aprobacion_final') {
    return NextResponse.json(
      { error: `El retiro en estado "${evento.estado}" no permite aprobación final` },
      { status: 422 }
    )
  }

  const body = (await request.json()) as AprobacionFinalBody

  // 'devolver' manda el evento un paso atrás, a que corrijan los datos de
  // noticias (falta un flyer, un centralizador mal cargado, etc.). Sin esto la
  // única salida de este estado era publicar o suspender, y suspender un evento
  // por un dato mal cargado es desproporcionado.
  const ESTADO_POR_ACCION = {
    publicar: 'publicado',
    suspender: 'suspendido',
    devolver: 'pendiente_datos_noticias',
  } as const

  if (!(body.accion in ESTADO_POR_ACCION)) {
    return NextResponse.json(
      { error: 'Acción inválida. Debe ser "publicar", "suspender" o "devolver"' },
      { status: 400 }
    )
  }

  const motivo = body.notas_aprobacion_final?.trim() || null

  // Quien recibe el evento de vuelta tiene que saber qué corregir.
  if (body.accion === 'devolver' && !motivo) {
    return NextResponse.json(
      { error: 'Indicá en las notas qué hay que corregir antes de devolver el retiro' },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const updates: Record<string, unknown> = {
    estado: ESTADO_POR_ACCION[body.accion],
    notas_aprobacion_final: motivo,
  }

  // Devolver no es una aprobación: no se sella con quién/cuándo aprobó.
  if (body.accion !== 'devolver') {
    updates.aprobacion_final_por = ctx.persona_id
    updates.fecha_aprobacion_final = today
  }

  if (body.accion === 'publicar') {
    updates.publicado_por = ctx.persona_id
    updates.fecha_publicacion = today
  }

  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) {
      updates[campo] = body[campo as keyof AprobacionFinalBody] ?? null
    }
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  // La devolución queda en el historial del evento, que es donde la ve quien
  // tiene que corregir. Si falla, no se revierte el cambio de estado: es una
  // traza, no parte de la operación (mismo criterio que /aprobar).
  if (body.accion === 'devolver') {
    const { error: cambioError } = await supabase.from('evento_cambios').insert({
      evento_id: id,
      nivel_disc: 'eqt',
      campo: 'estado',
      valor_anterior: 'Pendiente de Aprobación Final',
      valor_nuevo: `Devuelto para corregir datos — ${motivo}`,
      modificado_por: ctx.persona_id,
    })
    if (cambioError) {
      console.error('[aprobacion-final] Failed to insert evento_cambios:', cambioError.message)
    }
  }

  return NextResponse.json({ estado: updates.estado })
}

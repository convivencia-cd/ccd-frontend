import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { camposFaltantesSolicitud, mensajeFaltantesSolicitud } from '@/lib/eventos/solicitud-requeridos'

type ResultadoDiscernimiento =
  | 'aprobado_sin_modificaciones'
  | 'aprobado_con_modificaciones'
  | 'rechazado'

type CampoEvento =
  | 'nombre'
  | 'fecha_inicio'
  | 'fecha_fin'
  | 'ciudad'
  | 'provincia_evento'
  | 'pais_evento'
  | 'codigo_postal'
  | 'diocesis'
  | 'coordinadores_propuestos'
  | 'asesor_propuesto'
  | 'asesor_voluntario'
  | 'modalidad'
  | 'notas'
  | 'casa_retiro_id'
  | 'coordinador_asignado_id'
  | 'asesor_asignado_id'

const CAMPOS_EDITABLES: CampoEvento[] = [
  'nombre', 'fecha_inicio', 'fecha_fin',
  'ciudad', 'provincia_evento', 'pais_evento', 'codigo_postal', 'diocesis',
  'coordinadores_propuestos', 'asesor_propuesto', 'asesor_voluntario',
  'modalidad', 'notas', 'casa_retiro_id',
  'coordinador_asignado_id', 'asesor_asignado_id',
]

type FechaEjecucion = {
  id?: string | null
  fecha_inicio: string
  fecha_fin: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const resultado = body.resultado_discernimiento as ResultadoDiscernimiento
  const notas = body.notas_discernimiento as string | undefined
  const cambios = (body.cambios ?? {}) as Partial<Record<CampoEvento, unknown>>
  const fechasEjecucion = body.fechas_ejecucion as FechaEjecucion[] | undefined

  const validResultados: ResultadoDiscernimiento[] = [
    'aprobado_sin_modificaciones',
    'aprobado_con_modificaciones',
    'rechazado',
  ]

  if (!validResultados.includes(resultado)) {
    return NextResponse.json({ error: 'Resultado de discernimiento inválido' }, { status: 400 })
  }

  const accion: 'aprobar' | 'rechazar' = resultado === 'rechazado' ? 'rechazar' : 'aprobar'

  if (accion === 'rechazar' && !notas?.trim()) {
    return NextResponse.json({ error: 'Las notas son obligatorias al rechazar' }, { status: 400 })
  }

  // Validate campo names
  const camposInvalidos = Object.keys(cambios).filter(k => !CAMPOS_EDITABLES.includes(k as CampoEvento))
  if (camposInvalidos.length > 0) {
    return NextResponse.json(
      { error: `Campos no permitidos: ${camposInvalidos.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .select(`
      id, estado, organizacion_id, fraternidad_id, tipo, tipo_evento_id,
      requiere_discernimiento_confra, requiere_discernimiento_eqt,
      nombre, fecha_inicio, fecha_fin,
      ciudad, provincia_evento, pais_evento, codigo_postal, diocesis,
      coordinadores_propuestos, asesor_propuesto, asesor_voluntario,
      modalidad, notas, casa_retiro_id,
      coordinador_asignado_id, asesor_asignado_id
    `)
    .eq('id', id)
    .single()

  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  }

  const estadoActual = evento.estado
  const requiereConfra = evento.requiere_discernimiento_confra ?? false
  const requiereEqt = evento.requiere_discernimiento_eqt ?? false
  const confraternidadId = evento.organizacion_id

  // Determine required permission and org scope
  let requiredPermission: 'event.approve_confra' | 'event.approve_eqt'
  let requiredOrgId: string | null = null
  let nivel: 'confra' | 'eqt'

  if (estadoActual === 'solicitud') {
    if (requiereConfra) {
      requiredPermission = 'event.approve_confra'
      requiredOrgId = confraternidadId ?? null
      nivel = 'confra'
    } else if (requiereEqt) {
      requiredPermission = 'event.approve_eqt'
      nivel = 'eqt'
    } else {
      return NextResponse.json(
        { error: 'Este retiro no requiere discernimiento' },
        { status: 422 }
      )
    }
  } else if (estadoActual === 'discernimiento_confra') {
    requiredPermission = 'event.approve_eqt'
    nivel = 'eqt'
  } else if (estadoActual === 'discernimiento_eqt') {
    requiredPermission = 'event.approve_eqt'
    nivel = 'eqt'
  } else {
    return NextResponse.json(
      { error: `El retiro en estado "${estadoActual}" no permite discernimiento` },
      { status: 422 }
    )
  }

  if (!canPerform(ctx, requiredPermission, requiredOrgId)) {
    return NextResponse.json(
      { error: 'No tenés permiso para realizar esta acción' },
      { status: 403 }
    )
  }

  // Build field update payload and cambios rows
  const fieldUpdates: Record<string, unknown> = {}
  const cambiosRows: Array<{
    evento_id: string
    nivel_disc: 'confra' | 'eqt'
    campo: string
    valor_anterior: string | null
    valor_nuevo: string | null
    modificado_por: string | null
  }> = []

  for (const [campo, nuevoValor] of Object.entries(cambios)) {
    const anteriorRaw = (evento as Record<string, unknown>)[campo]
    const valorAnterior = anteriorRaw == null ? null : String(anteriorRaw)
    const valorNuevo = nuevoValor == null ? null : String(nuevoValor)

    if (valorAnterior === valorNuevo) continue

    fieldUpdates[campo] = nuevoValor
    cambiosRows.push({
      evento_id: id,
      nivel_disc: nivel,
      campo,
      valor_anterior: valorAnterior,
      valor_nuevo: valorNuevo,
      modificado_por: ctx.persona_id,
    })
  }

  // No avanza si la solicitud (con los cambios del aprobador) quedó incompleta.
  if (accion === 'aprobar') {
    const faltantes = camposFaltantesSolicitud({ ...evento, ...fieldUpdates })
    if (faltantes.length > 0) {
      return NextResponse.json({ error: mensajeFaltantesSolicitud(faltantes) }, { status: 422 })
    }
  }

  // Compute next state
  // Flows:
  //   confra + eqt: solicitud → confra → discernimiento_confra → eqt → pendiente_datos_noticias
  //   solo confra:  solicitud → confra → discernimiento_confra → pendiente_datos_noticias (no eqt)
  //   solo eqt:     solicitud → eqt → pendiente_datos_noticias
  let nextEstado: string
  if (accion === 'rechazar') {
    nextEstado = 'rechazado'
  } else if (estadoActual === 'solicitud' && requiereConfra) {
    nextEstado = 'discernimiento_confra'
  } else {
    // EqT approved (directly or after confra) → pendiente_datos_noticias
    nextEstado = 'pendiente_datos_noticias'
  }

  const today = new Date().toISOString().split('T')[0]
  const updateData: Record<string, unknown> = { estado: nextEstado }

  if (nivel === 'confra') {
    updateData.disc_confra_estado = resultado
    updateData.disc_confra_fecha = today
    updateData.disc_confra_notas = notas || null
    updateData.disc_confra_por = ctx.persona_id
  } else {
    updateData.disc_eqt_estado = resultado
    updateData.disc_eqt_fecha = today
    updateData.disc_eqt_notas = notas || null
    updateData.disc_eqt_por = ctx.persona_id
  }

  if (accion === 'rechazar') {
    updateData.rechazado_por = ctx.persona_id
    updateData.motivo_rechazo = notas
    updateData.fecha_rechazo = today
  } else if (nextEstado === 'pendiente_datos_noticias') {
    updateData.aprobado_por = ctx.persona_id
    updateData.fecha_aprobacion = today
  }

  const { error: updateError } = await supabase
    .from('eventos')
    .update({ ...updateData, ...fieldUpdates })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Sync fechas_ejecucion if provided (EqT may modify event periods)
  if (fechasEjecucion !== undefined) {
    const validFechas = fechasEjecucion.filter(f => f.fecha_inicio && f.fecha_fin)

    // Delete all existing periods and re-insert
    const { error: deleteError } = await supabase
      .from('evento_fechas')
      .delete()
      .eq('evento_id', id)

    if (deleteError) {
      console.error('[aprobar] Failed to delete evento_fechas:', deleteError.message)
    } else if (validFechas.length > 0) {
      const { error: insertError } = await supabase
        .from('evento_fechas')
        .insert(validFechas.map(f => ({
          evento_id: id,
          fecha_inicio: f.fecha_inicio,
          fecha_fin: f.fecha_fin,
        })))

      if (insertError) {
        console.error('[aprobar] Failed to insert evento_fechas:', insertError.message)
      }
    }

    // Record the change in historial
    cambiosRows.push({
      evento_id: id,
      nivel_disc: nivel,
      campo: 'fechas_ejecucion',
      valor_anterior: null,
      valor_nuevo: JSON.stringify(validFechas.map(f => `${f.fecha_inicio} → ${f.fecha_fin}`)),
      modificado_por: ctx.persona_id,
    })
  }

  // Insert change rows
  if (cambiosRows.length > 0) {
    const { error: cambiosError } = await supabase
      .from('evento_cambios')
      .insert(cambiosRows)

    if (cambiosError) {
      console.error('[aprobar] Failed to insert evento_cambios:', cambiosError.message)
    }
  }

  return NextResponse.json({ estado: nextEstado })
}

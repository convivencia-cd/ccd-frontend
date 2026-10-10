import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { translateSupabaseError } from '@/lib/errors/supabase'
import { puedeSolicitarTipoEvento } from '@/lib/auth/tipos-eventos-permitidos'
import { camposFaltantesSolicitud, mensajeFaltantesSolicitud } from '@/lib/eventos/solicitud-requeridos'

export async function POST(request: Request) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const { organizacion_id, fraternidad_id } = body

  const scopeId = fraternidad_id ?? organizacion_id ?? null
  if (!canPerform(ctx, 'event.create', scopeId)) {
    return NextResponse.json(
      { error: 'No tenés permiso para crear retiros en esta organización' },
      { status: 403 }
    )
  }

  const supabase = await createClient()

  if (body.tipo_evento_id && !(await puedeSolicitarTipoEvento(supabase, ctx, body.tipo_evento_id))) {
    return NextResponse.json(
      { error: 'Tu ministerio no está habilitado para solicitar este tipo de retiro' },
      { status: 403 }
    )
  }

  // Admins can set any state; regular users always submit as 'solicitud'
  const estado = ctx.is_admin && body.estado ? body.estado : 'solicitud'

  if (estado === 'solicitud') {
    const faltantes = camposFaltantesSolicitud(body)
    if (faltantes.length > 0) {
      return NextResponse.json({ error: mensajeFaltantesSolicitud(faltantes) }, { status: 400 })
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const insertData: Record<string, unknown> = {
    nombre: body.nombre,
    tipo: body.tipo,
    tipo_evento_id: body.tipo_evento_id || null,
    modalidad: body.modalidad ?? 'presencial',
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin,
    estado,
    precio: body.precio != null && body.precio !== '' ? Number(body.precio) : 0,
    pension: body.pension != null && body.pension !== '' ? Number(body.pension) : 0,
    organizacion_id: organizacion_id || null,       // confraternidad
    fraternidad_id: fraternidad_id || null,
    requiere_discernimiento_confra: body.requiere_discernimiento_confra ?? false,
    requiere_discernimiento_eqt: body.requiere_discernimiento_eqt ?? false,
    coordinadores_propuestos: body.coordinadores_propuestos || null,
    asesor_propuesto: body.asesor_propuesto || null,
    asesor_voluntario: body.asesor_voluntario ?? false,
    es_apv: body.es_apv ?? false,
    ciudad: body.ciudad || null,
    codigo_postal: body.codigo_postal || null,
    diocesis: body.diocesis || null,
    provincia_evento: body.provincia_evento || null,
    pais_evento: body.pais_evento || 'Argentina',
    notas: body.notas || null,
    solicitado_por: ctx.persona_id ?? null,
    // No se toma del cliente: la fecha de solicitud es siempre la fecha real de envío.
    fecha_solicitud: estado === 'solicitud' ? today : null,
  }

  const { data, error } = await supabase
    .from('eventos')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: translateSupabaseError(error.message) }, { status: 400 })
  }

  const fechasValidas = ((body.fechas_ejecucion ?? []) as Array<{ fecha_inicio: string; fecha_fin: string }>)
    .filter(f => f.fecha_inicio && f.fecha_fin)
  if (fechasValidas.length > 0) {
    await supabase.from('evento_fechas').insert(
      fechasValidas.map(f => ({ evento_id: data.id, fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin }))
    )
  }

  return NextResponse.json({ id: data.id })
}

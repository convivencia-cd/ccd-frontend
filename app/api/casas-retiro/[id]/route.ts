import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { translateSupabaseError } from '@/lib/errors/supabase'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const [{ data: casa, error }, { data: orgs }] = await Promise.all([
    supabase.from('casas_retiro').select('*').eq('id', id).single(),
    supabase
      .from('casa_retiro_organizaciones')
      .select('organizacion_id')
      .eq('casa_retiro_id', id),
  ])

  if (error || !casa) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    ...casa,
    organizaciones_cercanas: (orgs ?? []).map((r: { organizacion_id: string }) => r.organizacion_id),
    // El form de edición deshabilita el Estado si no lo puede cambiar.
    puede_dar_de_baja: canPerform(ctx, 'casas_retiro.delete'),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canPerform(ctx, 'organization.update')) {
    return NextResponse.json(
      { error: 'No tenés permiso para editar esta casa de retiro' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const { data: actual } = await supabase.from('casas_retiro').select('estado').eq('id', id).single()
  if (!actual) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  // Dar de baja o reactivar es "eliminar" (baja lógica): permiso propio, card #61.
  const nuevoEstado = body.estado || actual.estado
  const cambiaEstado = nuevoEstado !== actual.estado
  if (cambiaEstado && !canPerform(ctx, 'casas_retiro.delete')) {
    return NextResponse.json(
      { error: 'No tenés permiso para dar de baja o reactivar casas de retiro' },
      { status: 403 }
    )
  }

  const updateData: Record<string, unknown> = {
    nombre: body.nombre,
    tipo_propiedad: body.tipo_propiedad || 'terceros',
    estado: nuevoEstado,
    pais: body.pais || 'Argentina',
    codigo_interno: body.codigo_interno || null,
    contacto_persona_id: body.contacto_persona_id || null,
    telefono: body.telefono || null,
    mail: body.mail || null,
    aforo: body.aforo ? parseInt(body.aforo) || null : null,
    direccion_calle: body.direccion_calle || null,
    direccion_nro: body.direccion_nro || null,
    ciudad: body.ciudad || null,
    cp: body.cp || null,
    diocesis: body.diocesis || null,
    provincia: body.provincia || null,
    notas: body.notas || null,
    estacionamiento: body.estacionamiento ?? false,
    rampa_discapacitados: body.rampa_discapacitados ?? false,
    capilla: body.capilla ?? false,
    comedor_amplio: body.comedor_amplio ?? false,
    salon: body.salon ?? false,
    banos_en_habit: body.banos_en_habit ?? false,
    tiene_escaleras: body.tiene_escaleras ?? false,
    tiene_ascensor: body.tiene_ascensor ?? false,
    latitud: body.latitud ? parseFloat(body.latitud) || null : null,
    longitud: body.longitud ? parseFloat(body.longitud) || null : null,
    link_maps: body.link_maps || null,
    cant_hab_x2: parseInt(body.cant_hab_x2) || 0,
    cant_hab_x3: parseInt(body.cant_hab_x3) || 0,
    cant_hab_x4: parseInt(body.cant_hab_x4) || 0,
    cant_banos: parseInt(body.cant_banos) || 0,
  }

  // fecha_baja solo se toca cuando cambia el estado: editar otros datos de
  // una casa inactiva no pisa la fecha en que se dio de baja.
  if (cambiaEstado) {
    updateData.fecha_baja = nuevoEstado === 'inactiva' ? new Date().toISOString() : null
  }

  const { error } = await supabase
    .from('casas_retiro')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: translateSupabaseError(error.message) }, { status: 400 })
  }

  // Sync organizaciones cercanas: delete-then-reinsert
  await supabase.from('casa_retiro_organizaciones').delete().eq('casa_retiro_id', id)
  if (Array.isArray(body.organizaciones_cercanas) && body.organizaciones_cercanas.length > 0) {
    const rows = body.organizaciones_cercanas.map((org_id: string) => ({
      casa_retiro_id: id,
      organizacion_id: org_id,
    }))
    await supabase.from('casa_retiro_organizaciones').insert(rows)
  }

  return NextResponse.json({ ok: true })
}

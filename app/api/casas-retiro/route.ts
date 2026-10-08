import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { translateSupabaseError } from '@/lib/errors/supabase'

export async function POST(request: Request) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canPerform(ctx, 'casas_retiro.create')) {
    return NextResponse.json(
      { error: 'No tenés permiso para crear casas de retiro' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const supabase = await createClient()

  const insertData: Record<string, unknown> = {
    nombre: body.nombre,
    tipo_propiedad: body.tipo_propiedad || 'terceros',
    pais: body.pais || 'Argentina',
    estacionamiento: body.estacionamiento ?? false,
    rampa_discapacitados: body.rampa_discapacitados ?? false,
    capilla: body.capilla ?? false,
    comedor_amplio: body.comedor_amplio ?? false,
    salon: body.salon ?? false,
    banos_en_habit: body.banos_en_habit ?? false,
    tiene_escaleras: body.tiene_escaleras ?? false,
    tiene_ascensor: body.tiene_ascensor ?? false,
    cant_hab_x2: parseInt(body.cant_hab_x2) || 0,
    cant_hab_x3: parseInt(body.cant_hab_x3) || 0,
    cant_hab_x4: parseInt(body.cant_hab_x4) || 0,
    cant_banos: parseInt(body.cant_banos) || 0,
  }

  if (body.codigo_interno) insertData.codigo_interno = body.codigo_interno
  if (body.contacto_persona_id) insertData.contacto_persona_id = body.contacto_persona_id
  if (body.telefono) insertData.telefono = body.telefono
  if (body.mail) insertData.mail = body.mail
  if (body.aforo) insertData.aforo = parseInt(body.aforo) || null
  if (body.direccion_calle) insertData.direccion_calle = body.direccion_calle
  if (body.direccion_nro) insertData.direccion_nro = body.direccion_nro
  if (body.ciudad) insertData.ciudad = body.ciudad
  if (body.cp) insertData.cp = body.cp
  if (body.diocesis) insertData.diocesis = body.diocesis
  if (body.provincia) insertData.provincia = body.provincia
  if (body.notas) insertData.notas = body.notas
  if (body.latitud) insertData.latitud = parseFloat(body.latitud) || null
  if (body.longitud) insertData.longitud = parseFloat(body.longitud) || null
  if (body.link_maps) insertData.link_maps = body.link_maps

  const { data, error } = await supabase
    .from('casas_retiro')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: translateSupabaseError(error.message) }, { status: 400 })
  }

  // Insertar organizaciones cercanas
  if (Array.isArray(body.organizaciones_cercanas) && body.organizaciones_cercanas.length > 0) {
    const junctionRows = body.organizaciones_cercanas.map((org_id: string) => ({
      casa_retiro_id: data.id,
      organizacion_id: org_id,
    }))
    await supabase.from('casa_retiro_organizaciones').insert(junctionRows)
  }

  return NextResponse.json({ id: data.id })
}

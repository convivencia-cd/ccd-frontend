import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { actualizarEstadoEvento } from '@/lib/eventos/actualizar-estado'

const ESTADOS = new Set([
  'borrador', 'solicitud', 'discernimiento_confra', 'discernimiento_eqt',
  'pendiente_datos_noticias', 'aprobado', 'pendiente_aprobacion_final',
  'publicado', 'en_curso', 'suspendido', 'rechazado', 'finalizado', 'cerrado', 'cancelado',
])

// Datos que el formulario guarda junto al cambio manual de estado.
const CAMPOS_EDITABLES = [
  'nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'audiencia', 'modalidad',
  'organizacion_id', 'casa_retiro_id', 'cupo_maximo', 'precio', 'pension',
  'descripcion', 'link_pago_mercadopago', 'ciudad', 'codigo_postal', 'diocesis',
  'provincia_evento', 'pais_evento',
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!ctx.is_admin) return NextResponse.json({ error: 'Solo el administrador puede cambiar el estado manualmente' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  if (!body || typeof body.estado !== 'string' || !ESTADOS.has(body.estado) ||
      typeof body.estadoAnterior !== 'string' || !ESTADOS.has(body.estadoAnterior)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: evento, error: fetchError } = await supabase.from('eventos')
    .select('estado, fecha_publicacion, fecha_inicio_real').eq('id', id).single()
  if (fetchError || !evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (evento.estado !== body.estadoAnterior) {
    return NextResponse.json({ error: 'El retiro cambió de estado mientras lo editabas. Recargá la página y volvé a intentar.' }, { status: 409 })
  }

  const updates: Record<string, unknown> & { estado: string } = { estado: body.estado }
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) updates[campo] = body[campo]
  }
  if (body.estado !== evento.estado) {
    if (body.estado === 'publicado' && !evento.fecha_publicacion) {
      updates.fecha_publicacion = new Date().toISOString().split('T')[0]
      updates.publicado_por = ctx.persona_id
    }
    if (body.estado === 'en_curso' && !evento.fecha_inicio_real) {
      updates.fecha_inicio_real = new Date().toISOString()
    }
  }

  const { error } = await actualizarEstadoEvento(supabase, request, id, evento.estado, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ estado: body.estado })
}

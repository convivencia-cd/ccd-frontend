import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tipos_eventos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canPerform(ctx, 'tipos_eventos.update')) {
    return NextResponse.json({ error: 'Sin permiso para editar tipos de eventos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    nombre: body.nombre,
    categoria: body.categoria,
    alcance: body.alcance,
    requiere_discernimiento_confra: body.requiere_discernimiento_confra ?? false,
    requiere_discernimiento_eqt: body.requiere_discernimiento_eqt ?? false,
    requisitos: body.requisitos || null,
    activo: body.activo ?? true,
  }

  if (Array.isArray(body.preguntas_informe)) {
    updateData.preguntas_informe = body.preguntas_informe
  }

  // Nombres de grupo de la convivencia (ej. "Jerusalem"): lista de strings sin
  // vacíos ni repetidos — de acá salen las opciones al armar los grupos.
  if (Array.isArray(body.nombres_grupos)) {
    updateData.nombres_grupos = Array.from(
      new Set(body.nombres_grupos.map((n: unknown) => String(n).trim()).filter(Boolean))
    )
  }

  const { error } = await supabase
    .from('tipos_eventos')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

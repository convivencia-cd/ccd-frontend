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

  // Step 1: get the event.create permission ID
  const { data: permiso } = await supabase
    .from('permisos')
    .select('id')
    .eq('clave', 'event.create')
    .eq('activo', true)
    .single()

  if (!permiso) {
    return NextResponse.json({ opciones: [], seleccionados: [] })
  }

  // Step 2: fetch ministerios that have this permission, and current selections in parallel
  const [ministeriosRes, seleccionadosRes] = await Promise.all([
    supabase
      .from('ministerio_permisos')
      .select('ministerios!inner(id, nombre)')
      .eq('permiso_id', permiso.id)
      .eq('ministerios.activo', true),
    supabase
      .from('tipo_evento_roles_solicitantes')
      .select('ministerio_id')
      .eq('tipo_evento_id', id),
  ])

  if (ministeriosRes.error) {
    return NextResponse.json({ error: ministeriosRes.error.message }, { status: 400 })
  }

  const opciones = (ministeriosRes.data ?? [])
    .map((row: any) => ({ id: row.ministerios.id as string, nombre: row.ministerios.nombre as string }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const seleccionados = (seleccionadosRes.data ?? []).map((row) => row.ministerio_id)

  return NextResponse.json({ opciones, seleccionados })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canPerform(ctx, 'tipos_eventos.update')) {
    return NextResponse.json({ error: 'Sin permiso para editar tipos de retiros' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const ministerio_ids: string[] = Array.isArray(body.ministerio_ids) ? body.ministerio_ids : []

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('tipo_evento_roles_solicitantes')
    .delete()
    .eq('tipo_evento_id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  if (ministerio_ids.length > 0) {
    const rows = ministerio_ids.map((ministerio_id) => ({ tipo_evento_id: id, ministerio_id }))
    const { error: insertError } = await supabase
      .from('tipo_evento_roles_solicitantes')
      .insert(rows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}

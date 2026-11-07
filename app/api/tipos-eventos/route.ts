import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'

/** '' / null → null (sin valor estándar); número ≥ 0 → número; otra cosa → error. */
function valorEstandar(v: unknown): { ok: true; valor: number | null } | { ok: false } {
  if (v === undefined || v === null || v === '') return { ok: true, valor: null }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, valor: n }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const soloActivos = searchParams.get('activo') === 'true'

  const supabase = await createClient()
  let query = supabase
    .from('tipos_eventos')
    .select('id, nombre, categoria, alcance, requiere_discernimiento_confra, requiere_discernimiento_eqt, requisitos, activo')
    .order('nombre')

  if (soloActivos) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const ctx = await getUserContext()

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canPerform(ctx, 'tipos_eventos.create')) {
    return NextResponse.json({ error: 'Sin permiso para crear tipos de retiros' }, { status: 403 })
  }

  const body = await request.json()
  const supabase = await createClient()

  const insertData: Record<string, unknown> = {
    nombre: body.nombre,
    categoria: body.categoria,
    alcance: body.alcance,
    requiere_discernimiento_confra: body.requiere_discernimiento_confra ?? false,
    requiere_discernimiento_eqt: body.requiere_discernimiento_eqt ?? false,
    activo: body.activo ?? true,
  }

  // Card #93: valores estándar que se copian al crear un retiro de este tipo.
  for (const campo of ['precio_inscripcion', 'precio_pension'] as const) {
    if (!(campo in body)) continue
    const r = valorEstandar(body[campo])
    if (!r.ok) return NextResponse.json({ error: 'Los valores de inscripción y pensión deben ser números mayores o iguales a 0' }, { status: 400 })
    insertData[campo] = r.valor
  }
  if (body.requisitos) insertData.requisitos = body.requisitos
  if (Array.isArray(body.preguntas_informe)) insertData.preguntas_informe = body.preguntas_informe

  const { data, error } = await supabase.from('tipos_eventos').insert(insertData).select('id').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ id: data.id })
}

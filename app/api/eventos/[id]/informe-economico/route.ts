import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canEditarInformeEconomico } from '@/lib/eventos/informe-economico'

const CAMPOS_SALDO = {
  saldo_inicial_caja: 'ie_saldo_inicial_caja',
  saldo_inicial_banco: 'ie_saldo_inicial_banco',
  saldo_inicial_mp: 'ie_saldo_inicial_mp',
} as const

// Actualiza los datos de cabecera del Informe Económico: saldos iniciales por medio y observaciones.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { data: evento } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()
  if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  if (!canEditarInformeEconomico(ctx, evento)) {
    return NextResponse.json({ error: 'No tenés permiso para cargar el informe económico (o el evento ya está cerrado)' }, { status: 403 })
  }

  const body = await request.json()
  const update: Record<string, unknown> = {}

  for (const [campo, columna] of Object.entries(CAMPOS_SALDO)) {
    if (!(campo in body)) continue
    const n = Number(body[campo] ?? 0)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Saldo inicial inválido' }, { status: 400 })
    update[columna] = n
  }
  if ('observaciones' in body) {
    update.ie_observaciones = typeof body.observaciones === 'string' && body.observaciones.trim() ? body.observaciones : null
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('eventos').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

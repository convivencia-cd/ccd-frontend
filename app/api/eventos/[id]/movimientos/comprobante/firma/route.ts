import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canEditarInformeEconomico } from '@/lib/eventos/informe-economico'
import {
  adminComprobantes,
  COMPROBANTES_BUCKET,
  pathComprobante,
} from '@/lib/eventos/comprobantes-movimientos'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { data: evento } = await supabase.from('eventos')
    .select('estado, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id).single()
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canEditarInformeEconomico(ctx, evento)) {
    return NextResponse.json({ error: 'No tenés permiso para adjuntar comprobantes' }, { status: 403 })
  }

  let body: { tipo?: unknown; tamano?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const result = pathComprobante(id, ctx.auth_user_id, body.tipo, body.tamano)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, error } = await adminComprobantes().storage
    .from(COMPROBANTES_BUCKET).createSignedUploadUrl(result.path)
  if (error) return NextResponse.json({ error: 'No se pudo preparar la subida del comprobante' }, { status: 500 })
  return NextResponse.json({ path: data.path, token: data.token })
}

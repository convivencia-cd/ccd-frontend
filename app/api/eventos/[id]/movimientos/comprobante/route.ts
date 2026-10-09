import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canVerInformeEconomico } from '@/lib/eventos/informe-economico'
import { adminComprobantes, COMPROBANTES_BUCKET } from '@/lib/eventos/comprobantes-movimientos'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const movimientoId = new URL(request.url).searchParams.get('movimiento_id')
  if (!movimientoId) return NextResponse.json({ error: 'Falta movimiento_id' }, { status: 400 })

  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = await createClient()
  const { data: evento } = await supabase.from('eventos')
    .select('estado, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id).single()
  if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  if (!canVerInformeEconomico(ctx, evento)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: movimiento } = await supabase.from('evento_movimientos')
    .select('comprobante_path').eq('id', movimientoId).eq('evento_id', id).single()
  if (!movimiento?.comprobante_path || !movimiento.comprobante_path.startsWith(`${id}/`)) {
    return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
  }
  const { data, error } = await adminComprobantes().storage
    .from(COMPROBANTES_BUCKET).createSignedUrl(movimiento.comprobante_path, 60)
  if (error) return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}

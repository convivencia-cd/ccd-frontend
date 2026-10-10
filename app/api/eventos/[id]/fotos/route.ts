import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canSubirFotosCierre } from '@/lib/eventos/cierre'
import { EVENTO_CIERRE_SELECT, esPathDelEvento, registrarFoto } from '@/lib/eventos/fotos-cierre'

// Paso 2 de la subida: registra en evento_fotos_cierre la foto que el navegador
// ya subió con la URL firmada de /api/eventos/[id]/fotos/firma.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .select(EVENTO_CIERRE_SELECT)
    .eq('id', id)
    .single()
  if (eventoError || !evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })

  if (!canSubirFotosCierre(ctx, evento)) {
    return NextResponse.json(
      { error: 'No tenés permiso para adjuntar fotos (o el retiro no está finalizado)' },
      { status: 403 }
    )
  }

  const body = await request.json()
  if (!esPathDelEvento(id, body.path)) {
    return NextResponse.json({ error: 'Foto inválida' }, { status: 400 })
  }
  const descripcion = typeof body.descripcion === 'string' && body.descripcion.trim() ? body.descripcion.trim() : null

  try {
    const foto = await registrarFoto(id, body.path, descripcion, ctx.persona_id)
    return NextResponse.json({ foto })
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message ?? 'No se pudo registrar la foto'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

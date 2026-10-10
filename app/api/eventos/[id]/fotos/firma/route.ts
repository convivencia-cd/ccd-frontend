import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canSubirFotosCierre } from '@/lib/eventos/cierre'
import { EVENTO_CIERRE_SELECT, firmarSubida, pathParaFoto } from '@/lib/eventos/fotos-cierre'

// Paso 1 de la subida de una foto del cierre: devuelve una URL firmada para que
// el navegador suba el archivo directo al bucket. Paso 2: POST /api/eventos/[id]/fotos.
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
  const res = pathParaFoto(id, body.tipo, body.tamano)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 })

  try {
    const firma = await firmarSubida(res.path)
    return NextResponse.json({ path: firma.path, token: firma.token })
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message ?? 'No se pudo preparar la subida'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

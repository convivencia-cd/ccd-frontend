import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canSubirFotosCierre } from '@/lib/eventos/cierre'
import { EVENTO_CIERRE_SELECT, quitarFoto } from '@/lib/eventos/fotos-cierre'

// Quita una foto del cierre (baja lógica).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fotoId: string }> }
) {
  const { id, fotoId } = await params
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
      { error: 'No tenés permiso para quitar fotos (o el retiro no está finalizado)' },
      { status: 403 }
    )
  }

  try {
    const ok = await quitarFoto(id, fotoId, ctx.persona_id)
    if (!ok) return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message ?? 'No se pudo quitar la foto'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

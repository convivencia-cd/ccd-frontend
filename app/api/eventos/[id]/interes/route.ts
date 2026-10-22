import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { getPublicOrigin } from '@/lib/http'
import { notificarAltaInteresado } from '@/lib/interesados/notificar-alta'

/** Alta propia de un usuario registrado; la identidad siempre viene de la sesión. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!ctx.persona_id) return NextResponse.json({ error: 'Tu cuenta no está vinculada a una persona.' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  if (!body || (body.notas != null && typeof body.notas !== 'string')) {
    return NextResponse.json({ error: 'Las notas deben ser texto.' }, { status: 400 })
  }
  const supabase = await createClient()
  const { data: evento } = await supabase.from('eventos').select('id')
    .eq('id', id).eq('estado', 'publicado').single()
  if (!evento) return NextResponse.json({ error: 'El retiro no está disponible.' }, { status: 404 })

  const { data: creado, error } = await supabase.from('evento_participantes').insert({
    evento_id: id,
    persona_id: ctx.persona_id,
    rol_en_evento: 'convivente',
    estado_participacion: 'interesado',
    notas: body.notas?.trim() || null,
  }).select('id').single()

  if (error || !creado) {
    return NextResponse.json({
      error: error?.code === '23505' ? 'Ya estás inscrito en este retiro.' : 'No se pudo registrar el interés.',
    }, { status: error?.code === '23505' ? 409 : 400 })
  }

  await notificarAltaInteresado(creado.id, getPublicOrigin(request))
  return NextResponse.json({ ok: true, id: creado.id })
}

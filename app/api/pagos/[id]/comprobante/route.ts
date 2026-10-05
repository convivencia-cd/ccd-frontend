import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Adjunta el comprobante a un pago cargado a mano desde el panel interno
// (p. ej. una pensión por transferencia). El comprobante de inscripción que sube
// el conviviente desde la landing va por /api/public/pago-transferencia.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([getUserContext(), createClient()])

  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá el comprobante.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 10 MB.' }, { status: 400 })
  }
  const ext = EXT_BY_MIME[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Formato no permitido. Usá PDF, JPG, PNG o WebP.' }, { status: 400 })
  }

  const { data: pago } = await supabase
    .from('pagos')
    .select(`
      id, medio_pago, comprobante_url, evento_participante_id,
      participante:evento_participantes!evento_participante_id(
        evento:eventos!evento_id(organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id)
      )
    `)
    .eq('id', id)
    .single()

  if (!pago) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  }

  const evento = (pago.participante as unknown as {
    evento: {
      organizacion_id: string | null
      fraternidad_id: string | null
      centralizador_1_persona_id: string | null
      centralizador_2_persona_id: string | null
      centralizador_3_persona_id: string | null
    } | null
  } | null)?.evento ?? null

  const puedeEnOrg = (orgId: string | null) =>
    canPerform(ctx, 'payment.verify', orgId) || canPerform(ctx, 'event.update', orgId)

  const autorizado =
    !!evento &&
    (puedeEnOrg(evento.organizacion_id) ||
      (evento.fraternidad_id ? puedeEnOrg(evento.fraternidad_id) : false) ||
      esCentralizadorDeEvento(ctx, evento))

  if (!autorizado) {
    return NextResponse.json({ error: 'No tenés permiso para adjuntar comprobantes a este pago' }, { status: 403 })
  }

  if (pago.medio_pago === 'mercadopago') {
    return NextResponse.json({ error: 'Los pagos por Mercado Pago no llevan comprobante.' }, { status: 422 })
  }
  if (pago.comprobante_url) {
    return NextResponse.json({ error: 'Este pago ya tiene un comprobante adjunto.' }, { status: 409 })
  }

  // El bucket solo admite INSERT con service-role (ver migración 042).
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const path = `${pago.evento_participante_id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('pagos-comprobantes')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'No se pudo subir el comprobante. Intentá de nuevo.' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('pagos')
    .update({ comprobante_url: path })
    .eq('id', id)

  if (updateError) {
    // Limpiar el archivo huérfano si falla el update
    await supabaseAdmin.storage.from('pagos-comprobantes').remove([path])
    return NextResponse.json({ error: 'No se pudo guardar el comprobante. Intentá de nuevo.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

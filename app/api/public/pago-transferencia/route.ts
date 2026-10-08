import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const eventoParticipanteId = form.get('evento_participante_id')
  const file = form.get('file')

  if (typeof eventoParticipanteId !== 'string' || !eventoParticipanteId) {
    return NextResponse.json({ error: 'Falta la inscripción.' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá el comprobante.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 10 MB.' }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no permitido. Usá PDF, JPG, PNG o WebP.' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar que el participante existe y traer el precio del evento
  const { data: participante } = await supabaseAdmin
    .from('evento_participantes')
    .select('id, evento:eventos!evento_id(precio)')
    .eq('id', eventoParticipanteId)
    .single()

  if (!participante) {
    return NextResponse.json({ error: 'No se encontró la inscripción.' }, { status: 404 })
  }

  // Evitar comprobantes duplicados para una inscripción ya con pago en curso
  const { data: pagoExistente } = await supabaseAdmin
    .from('pagos')
    .select('id')
    .eq('evento_participante_id', eventoParticipanteId)
    .eq('concepto', 'inscripcion')
    .in('estado_pago', ['pendiente', 'confirmado'])
    .limit(1)
    .maybeSingle()

  if (pagoExistente) {
    return NextResponse.json(
      { error: 'Ya recibimos un comprobante para esta inscripción. Nos comunicaremos para verificarlo.' },
      { status: 409 }
    )
  }

  const evento = participante.evento as unknown as { precio: number | null } | null
  const monto = Number(evento?.precio ?? 0)

  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const path = `${eventoParticipanteId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('pagos-comprobantes')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'No se pudo subir el comprobante. Intentá de nuevo.' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error: pagoError } = await supabaseAdmin.from('pagos').insert({
    evento_participante_id: eventoParticipanteId,
    concepto: 'inscripcion',
    monto,
    medio_pago: 'transferencia',
    estado_pago: 'pendiente',
    comprobante_url: path,
    fecha_pago: today,
  })

  if (pagoError) {
    // Limpiar el archivo huérfano si falla el insert
    await supabaseAdmin.storage.from('pagos-comprobantes').remove([path])
    return NextResponse.json({ error: 'No se pudo registrar el pago. Intentá de nuevo.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

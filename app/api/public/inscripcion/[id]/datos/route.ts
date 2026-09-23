import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Completá-tus-datos del stepper público `/pago/[id]`.
 *
 * Sin sesión: la credencial es el UUID del `evento_participantes` que viajó en
 * el mail de confirmación. Por eso el endpoint es deliberadamente angosto:
 * - solo escribe columnas de contacto/ubicación de `personas` (nunca nombre,
 *   apellido, email ni nada institucional), y
 * - solo completa lo que hoy está vacío. Quien tenga el link no puede pisar
 *   datos ya cargados, ni siquiera mandándolos a mano (el `disabled` del
 *   formulario es una comodidad, esta regla es la barrera real).
 */

const CAMPOS_EDITABLES = [
  'telefono',
  'tipo_documento',
  'documento',
  'fecha_nacimiento',
  'direccion',
  'direccion_nro',
  'localidad',
  'codigo_postal',
  'provincia',
  'pais',
] as const

type CampoEditable = (typeof CAMPOS_EDITABLES)[number]

const TIPOS_DOCUMENTO = ['dni', 'pasaporte', 'cedula', 'otro']
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: participante } = await supabaseAdmin
    .from('evento_participantes')
    .select('id, estado_participacion, persona_id')
    .eq('id', id)
    .maybeSingle()

  if (!participante) {
    return NextResponse.json({ error: 'No se encontró la inscripción.' }, { status: 404 })
  }
  if (participante.estado_participacion !== 'interesado') {
    return NextResponse.json(
      { error: 'Esta inscripción ya no está en revisión. Contactate con los organizadores.' },
      { status: 409 }
    )
  }

  const { data: persona } = await supabaseAdmin
    .from('personas')
    .select(`id, ${CAMPOS_EDITABLES.join(', ')}`)
    .eq('id', participante.persona_id)
    .maybeSingle()

  if (!persona) {
    return NextResponse.json({ error: 'No se encontró la persona.' }, { status: 404 })
  }

  const actual = persona as unknown as Record<string, unknown>
  const updates: Record<string, string> = {}

  for (const campo of CAMPOS_EDITABLES) {
    const enviado = body[campo]
    if (typeof enviado !== 'string') continue
    const valor = enviado.trim()
    if (!valor) continue

    // Solo se completa lo vacío.
    const yaCargado = actual[campo]
    if (typeof yaCargado === 'string' ? yaCargado.trim() !== '' : yaCargado != null) continue

    if (campo === 'tipo_documento' && !TIPOS_DOCUMENTO.includes(valor)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }
    if (campo === 'fecha_nacimiento' && !FECHA_RE.test(valor)) {
      return NextResponse.json({ error: 'Fecha de nacimiento inválida.' }, { status: 400 })
    }

    updates[campo as CampoEditable] = valor
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, actualizados: 0 })
  }

  const { error } = await supabaseAdmin.from('personas').update(updates).eq('id', participante.persona_id)

  if (error) {
    // personas.documento es UNIQUE: el número puede pertenecer a otra ficha.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'Ese número de documento ya figura registrado. Contactate con los organizadores.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'No se pudieron guardar tus datos. Intentá de nuevo.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, actualizados: Object.keys(updates).length })
}

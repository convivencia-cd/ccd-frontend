import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  CAMPOS_PERSONA_INSCRIPCION,
  ESTADOS_ECLESIALES,
  ESTADO_ECLESIAL_RANGOS,
  OPCIONES_CAMPO_PERSONA,
  normalizarEventosRealizados,
  normalizarInscripcionDatos,
} from '@/lib/eventos/inscripcion-datos'
import { agregarEventosRealizados, guardarInscripcionDatos } from '@/lib/eventos/inscripcion-datos-server'

/**
 * Completá-tus-datos del stepper público `/pago/[id]`.
 *
 * Sin sesión: la credencial es el UUID del `evento_participantes` que viajó en
 * el mail de confirmación. Por eso el endpoint es deliberadamente angosto:
 * - de `personas` solo escribe las columnas de CAMPOS_PERSONA_INSCRIPCION
 *   (nunca nombre, apellido, email ni nada institucional), y
 * - solo completa lo que hoy está vacío. Quien tenga el link no puede pisar
 *   datos ya cargados, ni siquiera mandándolos a mano (el `disabled` del
 *   formulario es una comodidad, esta regla es la barrera real).
 * - las respuestas propias de la inscripción (`body.inscripcion`) van a la
 *   tabla cerrada `evento_inscripcion_datos` y sí se pueden corregir mientras
 *   la persona siga como interesada: son suyas y de este evento.
 */

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXTO = 2000

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const inscripcion = normalizarInscripcionDatos(body.inscripcion)
  if (inscripcion.error !== null) {
    return NextResponse.json({ error: inscripcion.error }, { status: 400 })
  }

  const realizados = normalizarEventosRealizados(body.eventos_realizados)
  if (realizados.error !== null) {
    return NextResponse.json({ error: realizados.error }, { status: 400 })
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
    .select(`id, estado_eclesial, ${CAMPOS_PERSONA_INSCRIPCION.join(', ')}`)
    .eq('id', participante.persona_id)
    .maybeSingle()

  if (!persona) {
    return NextResponse.json({ error: 'No se encontró la persona.' }, { status: 404 })
  }

  const actual = persona as unknown as Record<string, unknown>
  const updates: Record<string, string> = {}

  for (const campo of CAMPOS_PERSONA_INSCRIPCION) {
    const enviado = body[campo]
    if (typeof enviado !== 'string') continue
    const valor = enviado.trim().slice(0, MAX_TEXTO)
    if (!valor) continue

    // Solo se completa lo vacío. Un estado civil "sin especificar" cuenta como vacío.
    const yaCargado = actual[campo]
    const sinEspecificar = campo === 'estado_vida' && yaCargado === 'sin_especificar'
    if (!sinEspecificar && (typeof yaCargado === 'string' ? yaCargado.trim() !== '' : yaCargado != null)) continue

    const opciones = OPCIONES_CAMPO_PERSONA[campo]
    if (opciones && !opciones.includes(valor)) {
      return NextResponse.json({ error: 'Hay una opción inválida en tus datos.' }, { status: 400 })
    }
    if (campo === 'fecha_nacimiento' && !FECHA_RE.test(valor)) {
      return NextResponse.json({ error: 'Fecha de nacimiento inválida.' }, { status: 400 })
    }

    updates[campo] = valor
  }

  // estado_eclesial es NOT NULL DEFAULT 'laico': nunca está "vacío", así que la
  // regla de arriba no lo dejaría cargar. Se acepta solo si la ficha sigue en
  // el valor por defecto; un estado ya definido por la comunidad no se pisa.
  const estadoEclesial = typeof body.estado_eclesial === 'string' ? body.estado_eclesial.trim() : ''
  if (estadoEclesial && estadoEclesial !== 'laico' && (actual.estado_eclesial ?? 'laico') === 'laico') {
    if (!ESTADOS_ECLESIALES.some(o => o.value === estadoEclesial)) {
      return NextResponse.json({ error: 'Estado eclesial inválido.' }, { status: 400 })
    }
    updates.estado_eclesial = estadoEclesial

    // Segundo nivel, igual que el perfil: rango solo para clérigos; institución
    // para clérigos y consagrados.
    const rango = typeof body.estado_eclesial_rango === 'string' ? body.estado_eclesial_rango.trim() : ''
    if (estadoEclesial === 'clerigo' && rango) {
      if (!ESTADO_ECLESIAL_RANGOS.some(o => o.value === rango)) {
        return NextResponse.json({ error: 'Rango eclesial inválido.' }, { status: 400 })
      }
      updates.estado_eclesial_rango = rango
    }
    const institucion =
      typeof body.institucion_religiosa === 'string' ? body.institucion_religiosa.trim().slice(0, 200) : ''
    if (institucion) updates.institucion_religiosa = institucion
  }

  if (Object.keys(updates).length > 0) {
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
  }

  try {
    await guardarInscripcionDatos(id, inscripcion.datos)
    await agregarEventosRealizados(participante.persona_id as string, realizados.eventos)
  } catch (err) {
    console.error('[inscripcion/datos] error guardando los datos de la inscripción:', err)
    return NextResponse.json({ error: 'No se pudieron guardar tus datos. Intentá de nuevo.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, actualizados: Object.keys(updates).length })
}

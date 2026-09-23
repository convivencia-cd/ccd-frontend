import { NextResponse } from 'next/server'

import { getUserContext } from '@/lib/auth/context'
import { sendTemplateEmail, templates } from '@/lib/email'
import { getPublicOrigin } from '@/lib/http'
import { puedeGestionarInteresado } from '@/lib/interesados/access'
import { hayCuentaCobroCentral } from '@/lib/mercadopago/org-account'
import { createClient } from '@/lib/supabase/server'

const ESTADOS_CONTACTO = ['no_contactado', 'confirmado', 'cancelado'] as const
const MEDIOS_CONTACTO = ['telefono', 'email', 'whatsapp', 'personal', 'otro'] as const

type EstadoContacto = (typeof ESTADOS_CONTACTO)[number]

type Body = {
  estado_contacto?: string
  medio_contacto?: string | null
  notas_seguimiento?: string | null
  /** Fuerza el reenvío del mail aunque el interesado ya estuviera confirmado. */
  reenviar?: boolean
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const estado = body.estado_contacto
  if (typeof estado !== 'string' || !ESTADOS_CONTACTO.includes(estado as EstadoContacto)) {
    return NextResponse.json({ error: 'Estado de contacto inválido.' }, { status: 400 })
  }
  const medio = body.medio_contacto?.trim() || null
  if (medio && !MEDIOS_CONTACTO.includes(medio as (typeof MEDIOS_CONTACTO)[number])) {
    return NextResponse.json({ error: 'Medio de contacto inválido.' }, { status: 400 })
  }
  const notas = body.notas_seguimiento?.trim() || null

  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])
  if (!ctx) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: participante } = await supabase
    .from('evento_participantes')
    .select(`
      id, evento_id, estado_contacto, estado_participacion,
      persona:personas!persona_id(id, nombre, email),
      evento:eventos!evento_id(
        id, nombre, fecha_inicio, fecha_fin, precio, ciudad, provincia_evento,
        casa_retiro:casas_retiro!casa_retiro_id(nombre)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!participante) {
    return NextResponse.json({ error: 'No se encontró el interesado.' }, { status: 404 })
  }

  const puede = await puedeGestionarInteresado(supabase, ctx, participante.evento_id as string)
  if (!puede) {
    return NextResponse.json({ error: 'No tenés permiso para gestionar este interesado.' }, { status: 403 })
  }

  const estadoPrevio = (participante.estado_contacto as string) ?? 'no_contactado'
  const contactado = estado !== 'no_contactado'

  const { error: updateError } = await supabase
    .from('evento_participantes')
    .update({
      estado_contacto: estado,
      medio_contacto: medio,
      notas_seguimiento: notas,
      // Mismo criterio que tenía la UI: volver a "no contactado" borra la marca.
      fecha_contacto: contactado ? new Date().toISOString() : null,
      contactado_por: contactado ? ctx.persona_id ?? null : null,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo guardar el seguimiento.' }, { status: 400 })
  }

  // El mail sale solo al confirmar (transición) o cuando se pide el reenvío
  // explícito desde el listado. `estado_participacion` no se toca: el pase a
  // 'inscripto' lo hace el webhook de Mercado Pago cuando se acredita el pago.
  const debeEnviar = estado === 'confirmado' && (estadoPrevio !== 'confirmado' || body.reenviar === true)
  if (!debeEnviar) {
    return NextResponse.json({ ok: true, emailEnviado: false })
  }

  const persona = participante.persona as unknown as { id: string; nombre: string; email: string | null } | null
  const evento = participante.evento as unknown as {
    id: string
    nombre: string
    fecha_inicio: string | null
    fecha_fin: string | null
    precio: number | null
    ciudad: string | null
    provincia_evento: string | null
    casa_retiro: { nombre: string } | null
  } | null

  if (!persona?.email) {
    return NextResponse.json({
      ok: true,
      emailEnviado: false,
      motivo: 'la persona no tiene email cargado',
    })
  }

  const monto = Number(evento?.precio ?? 0)
  let pagoUrl: string | undefined
  let motivo: string | undefined

  if (monto <= 0) {
    motivo = 'el evento no tiene precio de inscripción'
  } else if (!(await hayCuentaCobroCentral())) {
    motivo = 'falta conectar Mercado Pago en la organización EQT'
  } else {
    pagoUrl = `${getPublicOrigin(request)}/pago/${id}`
  }

  const lugar = [evento?.casa_retiro?.nombre, evento?.ciudad, evento?.provincia_evento].filter(Boolean).join(', ')

  const resultado = await sendTemplateEmail(
    templates.interesConfirmado,
    {
      nombre: persona.nombre,
      evento: evento?.nombre ?? 'la convivencia',
      fechaInicio: evento?.fecha_inicio ?? null,
      fechaFin: evento?.fecha_fin ?? null,
      lugar: lugar || null,
      monto: monto > 0 ? monto : null,
      pagoUrl,
    },
    {
      to: persona.email,
      // Incluye el timestamp para que un reenvío no quede deduplicado en Resend.
      idempotencyKey: `interes-confirmado-${id}-${Date.now()}`,
    }
  )

  if (!resultado.ok) {
    // El seguimiento ya quedó guardado: no se revierte por un fallo de envío.
    return NextResponse.json({ ok: true, emailEnviado: false, motivo: 'falló el envío del correo' })
  }
  if (resultado.skipped) {
    return NextResponse.json({ ok: true, emailEnviado: false, motivo: 'el envío de correos está deshabilitado' })
  }

  await supabase
    .from('evento_participantes')
    .update({ pago_link_enviado_en: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({
    ok: true,
    emailEnviado: true,
    conLinkDePago: !!pagoUrl,
    email: persona.email,
    motivo,
  })
}

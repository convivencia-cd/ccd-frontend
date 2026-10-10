import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canGestionarPension, valorPensionEfectivo, calcularSaldoPension } from '@/lib/eventos/pension'

async function loadEvento(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, precio, pension, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()
  return { supabase, evento: data }
}

// Lista los participantes (conviventes no cancelados) con sus campos de pensión/beca.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canGestionarPension(ctx, evento)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data, error } = await supabase
    .from('evento_participantes')
    .select('id, valor_inscripcion, valor_pension, beca_pension, notas_beca, persona:personas!persona_id(id, nombre, apellido)')
    .eq('evento_id', id)
    .eq('rol_en_evento', 'convivente')
    .neq('estado_participacion', 'cancelado')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const participantes = (data ?? []).map((p) => {
    const saldo = calcularSaldoPension(
      valorPensionEfectivo(p.valor_pension, evento.pension),
      Number(p.beca_pension || 0)
    )
    return { ...p, saldo_pension: saldo }
  })

  return NextResponse.json({
    evento: { cuota_inscripcion: evento.precio, pension: evento.pension },
    participantes,
  })
}

// Actualiza el valor de inscripción/pensión, la beca o las notas de un participante.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canGestionarPension(ctx, evento)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await request.json()
  const participanteId = body.participante_id
  if (!participanteId) return NextResponse.json({ error: 'Falta participante_id' }, { status: 400 })

  const update: Record<string, unknown> = {}

  for (const campo of ['valor_inscripcion', 'valor_pension'] as const) {
    if (campo in body) {
      const v = body[campo]
      if (v === null) {
        update[campo] = null
      } else {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${campo} inválido` }, { status: 400 })
        }
        update[campo] = n
      }
    }
  }

  if ('beca_pension' in body) {
    const n = Number(body.beca_pension)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'beca_pension inválida' }, { status: 400 })
    }
    update.beca_pension = n
  }

  if ('notas_beca' in body) {
    update.notas_beca = body.notas_beca || null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('evento_participantes')
    .update(update)
    .eq('id', participanteId)
    .eq('evento_id', id)
    .select('id, valor_inscripcion, valor_pension, beca_pension, notas_beca')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Participante no encontrado en este retiro' }, { status: 404 })

  const valorPensionVal = valorPensionEfectivo(data.valor_pension, evento.pension)
  const saldo = calcularSaldoPension(valorPensionVal, Number(data.beca_pension || 0))
  const warning = Number(data.beca_pension || 0) > valorPensionVal
    ? 'La beca supera el valor de pensión'
    : undefined

  return NextResponse.json({ participante: { ...data, saldo_pension: saldo }, warning })
}

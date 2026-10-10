import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import {
  canEditarInformeEconomico,
  canVerInformeEconomico,
  categoriasDe,
  MEDIOS,
} from '@/lib/eventos/informe-economico'
import {
  adminComprobantes,
  COMPROBANTES_BUCKET,
  esPathComprobante,
  existeComprobante,
} from '@/lib/eventos/comprobantes-movimientos'

async function loadEvento(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id, ie_saldo_inicial_caja, ie_saldo_inicial_banco, ie_saldo_inicial_mp, ie_observaciones')
    .eq('id', id)
    .single()
  return { supabase, evento: data }
}

const SIN_PERMISO_EDICION = 'No tenés permiso para cargar el informe económico (o el retiro ya está cerrado)'

type MovimientoInput = {
  tipo?: unknown
  medio?: unknown
  categoria?: unknown
  concepto?: unknown
  monto?: unknown
  fecha?: unknown
  comprobante_path?: unknown
  comprobante_nombre?: unknown
}

async function validarComprobante(body: MovimientoInput, eventoId: string, usuarioId: string) {
  if (body.comprobante_path === undefined) return { valores: {} } as const
  if (!esPathComprobante(eventoId, usuarioId, body.comprobante_path)) {
    return { error: 'Comprobante inválido' } as const
  }
  const nombre = typeof body.comprobante_nombre === 'string'
    ? body.comprobante_nombre.trim().replace(/[\\/]/g, '').slice(0, 200)
    : ''
  if (!nombre) return { error: 'Falta el nombre del comprobante' } as const
  try {
    if (!await existeComprobante(body.comprobante_path)) {
      return { error: 'No se encontró el comprobante subido' } as const
    }
  } catch {
    return { error: 'No se pudo verificar el comprobante' } as const
  }
  return { valores: { comprobante_path: body.comprobante_path, comprobante_nombre: nombre } } as const
}

/** Valida los campos de un asiento. Devuelve el error o los valores normalizados. */
function validarAsiento(body: MovimientoInput):
  | { error: string }
  | { tipo: 'ingreso' | 'egreso'; medio: string; categoria: string; concepto: string | null; monto: number; fecha: string } {
  const tipo = body.tipo === 'egreso' ? 'egreso' : body.tipo === 'ingreso' ? 'ingreso' : null
  if (!tipo) return { error: 'Tipo inválido' }
  if (!MEDIOS.some(m => m.value === body.medio)) return { error: 'Medio inválido' }
  if (typeof body.categoria !== 'string' || !categoriasDe(tipo).includes(body.categoria)) {
    return { error: 'Concepto inválido' }
  }
  const monto = Number(body.monto)
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'Monto inválido' }
  if (typeof body.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)) {
    return { error: 'La fecha es obligatoria' }
  }
  return {
    tipo,
    medio: body.medio as string,
    categoria: body.categoria,
    concepto: typeof body.concepto === 'string' && body.concepto.trim() ? body.concepto.trim() : null,
    monto,
    fecha: body.fecha,
  }
}

// Lista los movimientos del evento (incluidos los anulados) + saldos iniciales y observaciones.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canVerInformeEconomico(ctx, evento)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data, error } = await supabase
    .from('evento_movimientos')
    .select('*')
    .eq('evento_id', id)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({
    movimientos: data ?? [],
    saldos_iniciales: {
      caja: Number(evento.ie_saldo_inicial_caja ?? 0),
      banco: Number(evento.ie_saldo_inicial_banco ?? 0),
      mp: Number(evento.ie_saldo_inicial_mp ?? 0),
    },
    observaciones: evento.ie_observaciones ?? null,
  })
}

// Crea un asiento manual. Las inscripciones pagadas por Mercado Pago se registran
// solas (trigger sobre pagos, migración 082) — no pasan por acá.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canEditarInformeEconomico(ctx, evento)) {
    return NextResponse.json({ error: SIN_PERMISO_EDICION }, { status: 403 })
  }

  // ── Alta manual de un asiento ──
  const body = await request.json() as MovimientoInput
  const valid = validarAsiento(body)
  if ('error' in valid) return NextResponse.json({ error: valid.error }, { status: 400 })
  const comprobante = await validarComprobante(body, id, ctx.auth_user_id)
  if ('error' in comprobante) return NextResponse.json({ error: comprobante.error }, { status: 400 })

  if (comprobante.valores.comprobante_path) {
    const { data: usado } = await supabase.from('evento_movimientos').select('id')
      .eq('comprobante_path', comprobante.valores.comprobante_path).maybeSingle()
    if (usado) return NextResponse.json({ error: 'El comprobante ya está asociado a otro movimiento' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('evento_movimientos')
    .insert({ evento_id: id, ...valid, ...comprobante.valores, created_by: ctx.persona_id })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ movimiento: data })
}

// Edita un asiento (?movimiento_id=...). Los importados de pagos solo cambian descripción y fecha.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const movimientoId = url.searchParams.get('movimiento_id')
  if (!movimientoId) return NextResponse.json({ error: 'Falta movimiento_id' }, { status: 400 })

  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canEditarInformeEconomico(ctx, evento)) {
    return NextResponse.json({ error: SIN_PERMISO_EDICION }, { status: 403 })
  }

  const { data: actual } = await supabase
    .from('evento_movimientos')
    .select('*')
    .eq('id', movimientoId)
    .eq('evento_id', id)
    .single()
  if (!actual) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  if (actual.anulado_at) return NextResponse.json({ error: 'No se puede editar un movimiento anulado' }, { status: 400 })

  const body = await request.json() as MovimientoInput
  // Importado de un pago: tipo/medio/concepto/monto quedan fijos (vienen del pago).
  const valid = validarAsiento(
    actual.pago_id
      ? { ...actual, concepto: body.concepto, fecha: body.fecha }
      : body,
  )
  if ('error' in valid) return NextResponse.json({ error: valid.error }, { status: 400 })
  const comprobante = await validarComprobante(body, id, ctx.auth_user_id)
  if ('error' in comprobante) return NextResponse.json({ error: comprobante.error }, { status: 400 })
  if (comprobante.valores.comprobante_path) {
    const { data: usado } = await supabase.from('evento_movimientos').select('id')
      .eq('comprobante_path', comprobante.valores.comprobante_path).neq('id', movimientoId).maybeSingle()
    if (usado) return NextResponse.json({ error: 'El comprobante ya está asociado a otro movimiento' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('evento_movimientos')
    .update({ ...valid, ...comprobante.valores, updated_at: new Date().toISOString() })
    .eq('id', movimientoId)
    .eq('evento_id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (comprobante.valores.comprobante_path && actual.comprobante_path && actual.comprobante_path !== comprobante.valores.comprobante_path) {
    await adminComprobantes().storage.from(COMPROBANTES_BUCKET).remove([actual.comprobante_path])
  }
  return NextResponse.json({ movimiento: data })
}

// Anula un asiento (?movimiento_id=...&motivo=...). Baja lógica: nunca se borra.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const movimientoId = url.searchParams.get('movimiento_id')
  if (!movimientoId) return NextResponse.json({ error: 'Falta movimiento_id' }, { status: 400 })

  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, evento } = await loadEvento(id)
  if (!evento) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!canEditarInformeEconomico(ctx, evento)) {
    return NextResponse.json({ error: SIN_PERMISO_EDICION }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('evento_movimientos')
    .update({
      anulado_at: now,
      anulado_por: ctx.persona_id,
      motivo_anulacion: url.searchParams.get('motivo')?.trim() || null,
      updated_at: now,
    })
    .eq('id', movimientoId)
    .eq('evento_id', id)
    .is('anulado_at', null)
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Movimiento no encontrado o ya anulado' }, { status: 404 })
  return NextResponse.json({ movimiento: data })
}

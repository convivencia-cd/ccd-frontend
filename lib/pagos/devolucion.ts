// Devolución de la inscripción al dar de baja a un participante (card #104).
//
// Regla acordada con Coti:
//   - Se devuelve solo la INSCRIPCIÓN (no la pensión), siempre el total.
//   - Pagada por Mercado Pago → se devuelve automáticamente por MP.
//   - Pagada por transferencia u otro medio → la baja sigue, la devolución es a mano.
//   - Si Mercado Pago rechaza la devolución, NO se da de baja (lo decide la ruta).
//
// Al pasar el pago a `reembolsado`, el trigger de la 082 anula el ingreso en el
// Informe Económico con el motivo. Solo servidor: usa service role.
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'
import { obtenerAccessTokenVigente } from '@/lib/mercadopago/org-account'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type PagoInscripcion = {
  id: string
  medio_pago: string | null
  monto: number | null
  mp_payment_id: string | number | null
  mp_organizacion_id: string | null
}

export type ResultadoDevolucion =
  | { ok: true; devolucion: { tipo: 'mercadopago'; monto: number } | { tipo: 'manual'; monto: number } | null }
  | { ok: false; error: string }

/**
 * Devuelve por Mercado Pago las inscripciones confirmadas del participante.
 * No toca el participante: si devuelve `ok: false`, quien llama no da de baja.
 */
export async function devolverInscripcion(participanteId: string): Promise<ResultadoDevolucion> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('pagos')
    .select('id, medio_pago, monto, mp_payment_id, mp_organizacion_id')
    .eq('evento_participante_id', participanteId)
    .eq('concepto', 'inscripcion')
    .eq('estado_pago', 'confirmado')
  if (error) return { ok: false, error: 'No se pudieron consultar los pagos de la inscripción.' }

  const pagos = (data ?? []) as PagoInscripcion[]
  if (pagos.length === 0) return { ok: true, devolucion: null }

  const porMp = pagos.filter(p => p.medio_pago === 'mercadopago')
  const manuales = pagos.filter(p => p.medio_pago !== 'mercadopago')

  let devueltoMp = 0
  for (const pago of porMp) {
    if (!pago.mp_payment_id || !pago.mp_organizacion_id) {
      return { ok: false, error: 'El pago por Mercado Pago no tiene los datos para devolverlo. Avisale a Finanzas.' }
    }
    const accessToken = await obtenerAccessTokenVigente(pago.mp_organizacion_id)
    if (!accessToken) {
      return { ok: false, error: 'La cuenta de Mercado Pago que cobró la inscripción no está conectada. Avisale a Finanzas.' }
    }

    try {
      await new PaymentRefund(new MercadoPagoConfig({ accessToken })).create({
        payment_id: String(pago.mp_payment_id),
        // Si se reintenta la baja, Mercado Pago no devuelve dos veces.
        requestOptions: { idempotencyKey: `devolucion-inscripcion-${pago.id}` },
      })
    } catch (e) {
      console.error('[devolucion] Mercado Pago rechazó la devolución', { pago_id: pago.id, error: e })
      const detalle = (e as { message?: string })?.message
      return {
        ok: false,
        error: `Mercado Pago no pudo devolver la inscripción${detalle ? ` (${detalle})` : ''}. La persona sigue inscripta; probá de nuevo o avisale a Finanzas.`,
      }
    }

    // El webhook de MP también lo marca como reembolsado; esto lo deja registrado ya.
    const { error: updError } = await supabase
      .from('pagos')
      .update({ estado_pago: 'reembolsado' })
      .eq('id', pago.id)
    if (updError) console.error('[devolucion] Devuelto en MP pero no se pudo marcar el pago', { pago_id: pago.id, error: updError })

    devueltoMp += Number(pago.monto ?? 0)
  }

  if (porMp.length > 0) return { ok: true, devolucion: { tipo: 'mercadopago', monto: devueltoMp } }
  if (manuales.length > 0) {
    return { ok: true, devolucion: { tipo: 'manual', monto: manuales.reduce((s, p) => s + Number(p.monto ?? 0), 0) } }
  }
  return { ok: true, devolucion: null }
}

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { formatDateAR } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'
import { VerificacionPendientes, type PagoPendiente } from '@/components/pagos/VerificacionPendientes'

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripción',
  pension: 'Pensión',
}

const estadoClases: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  confirmado: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  reembolsado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
}

export default async function PagosPage() {
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  const { data: pagos } = await supabase
    .from('pagos')
    .select(`
      id, monto, medio_pago, estado_pago, fecha_pago, referencia, concepto,
      participante:evento_participantes!evento_participante_id(
        persona:personas!persona_id(nombre, apellido),
        evento:eventos!evento_id(nombre)
      )
    `)
    .order('fecha_pago', { ascending: false })

  // Pendientes de verificación: todo pago manual pendiente (transferencia, efectivo,
  // otro), tenga o no comprobante; los de Mercado Pago los resuelve el webhook. Visibles para quien
  // tiene payment.verify scopeado a la org del evento, o es Centralizador del evento.
  const tienePermisoVerificar = !!ctx && canPerform(ctx, 'payment.verify')
  let pagosPendientes: PagoPendiente[] = []

  if (ctx) {
    const { data: pendientes } = await supabase
      .from('pagos')
      .select(`
        id, monto, fecha_pago, comprobante_url, concepto, medio_pago,
        participante:evento_participantes!evento_participante_id(
          persona:personas!persona_id(nombre, apellido),
          evento:eventos!evento_id(nombre, organizacion_id, fraternidad_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id)
        )
      `)
      .neq('medio_pago', 'mercadopago')
      .eq('estado_pago', 'pendiente')
      .order('fecha_pago', { ascending: true })

    const visibles = (pendientes ?? []).filter((p: any) => {
      if (ctx.is_admin) return true
      const ev = p.participante?.evento
      if (!ev) return false
      return (
        (ev.organizacion_id && ctx.org_ids.includes(ev.organizacion_id)) ||
        (ev.fraternidad_id && ctx.org_ids.includes(ev.fraternidad_id)) ||
        esCentralizadorDeEvento(ctx, ev)
      )
    })

    pagosPendientes = await Promise.all(
      visibles.map(async (p: any) => {
        let signedUrl: string | null = null
        if (p.comprobante_url) {
          const { data } = await supabase.storage
            .from('pagos-comprobantes')
            .createSignedUrl(p.comprobante_url, 3600)
          signedUrl = data?.signedUrl ?? null
        }
        return {
          id: p.id,
          monto: Number(p.monto),
          fecha_pago: p.fecha_pago,
          comprobante_signed_url: signedUrl,
          concepto: p.concepto ?? 'inscripcion',
          medio_pago: p.medio_pago,
          persona: p.participante?.persona
            ? `${p.participante.persona.apellido}, ${p.participante.persona.nombre}`
            : '—',
          evento: p.participante?.evento?.nombre ?? '—',
        }
      })
    )
  }

  const totalConfirmado = (pagos ?? [])
    .filter(p => p.estado_pago === 'confirmado')
    .reduce((sum, p) => sum + Number(p.monto), 0)
  const totalPendiente = (pagos ?? [])
    .filter(p => p.estado_pago === 'pendiente')
    .reduce((sum, p) => sum + Number(p.monto), 0)

  const totalPorConcepto = (concepto: string, estado: string) =>
    (pagos ?? [])
      .filter(p => (p.concepto ?? 'inscripcion') === concepto && p.estado_pago === estado)
      .reduce((sum, p) => sum + Number(p.monto), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          Gestión de Pagos
        </h1>
        <p className="mt-2 text-muted-foreground">
          Registra y controla los pagos de retiros
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Confirmados</CardDescription>
            <CardTitle className="text-2xl text-green-600">${totalConfirmado.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Pendientes</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">${totalPendiente.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Inscripciones vs Pensiones */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Inscripciones</CardDescription>
            <CardTitle className="text-lg text-foreground">
              <span className="text-green-600">${totalPorConcepto('inscripcion', 'confirmado').toFixed(2)}</span>
              <span className="mx-1 text-muted-foreground text-sm">confirmado</span>
              {' · '}
              <span className="text-yellow-600">${totalPorConcepto('inscripcion', 'pendiente').toFixed(2)}</span>
              <span className="mx-1 text-muted-foreground text-sm">pendiente</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Pensiones</CardDescription>
            <CardTitle className="text-lg text-foreground">
              <span className="text-green-600">${totalPorConcepto('pension', 'confirmado').toFixed(2)}</span>
              <span className="mx-1 text-muted-foreground text-sm">confirmado</span>
              {' · '}
              <span className="text-yellow-600">${totalPorConcepto('pension', 'pendiente').toFixed(2)}</span>
              <span className="mx-1 text-muted-foreground text-sm">pendiente</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {(tienePermisoVerificar || pagosPendientes.length > 0) && (
        <VerificacionPendientes pagos={pagosPendientes} mostrarVacio={tienePermisoVerificar} />
      )}

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Pagos Registrados</CardTitle>
            <CardDescription>Historial de todos los pagos en el sistema</CardDescription>
          </div>
          <Link href="/pagos/nuevo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Pago
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pagos && pagos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Persona</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Retiro</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Concepto</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Monto</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Fecha</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Medio</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((pago: any) => (
                    <tr key={pago.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">
                        {pago.participante?.persona
                          ? `${pago.participante.persona.apellido}, ${pago.participante.persona.nombre}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {pago.participante?.evento?.nombre ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {conceptoLabel[pago.concepto ?? 'inscripcion'] ?? pago.concepto}
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium">
                        ${Number(pago.monto).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDateAR(pago.fecha_pago)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{pago.medio_pago}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoClases[pago.estado_pago] ?? ''}`}>
                          {pago.estado_pago}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No hay pagos registrados</h3>
              <p className="mt-2 text-muted-foreground">Comienza registrando el primer pago en el sistema</p>
              <Link href="/pagos/nuevo" className="mt-4 inline-block">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Pago
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

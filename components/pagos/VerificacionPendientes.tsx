'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Check, X, ExternalLink, Paperclip } from 'lucide-react'
import { formatDateAR } from '@/lib/utils'

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url)
}

export type PagoPendiente = {
  id: string
  monto: number
  fecha_pago: string | null
  comprobante_signed_url: string | null
  concepto: string
  medio_pago: string
  persona: string
  evento: string
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripción',
  pension: 'Pensión',
}

const medioLabel: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
}

export function VerificacionPendientes({
  pagos,
  mostrarVacio = false,
}: {
  pagos: PagoPendiente[]
  mostrarVacio?: boolean
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comprobante, setComprobante] = useState<PagoPendiente | null>(null)

  async function verificar(id: string, accion: 'aprobar' | 'rechazar') {
    setError(null)
    let notas: string | undefined
    if (accion === 'rechazar') {
      const motivo = window.prompt('Motivo del rechazo (opcional):') ?? ''
      notas = motivo.trim() || undefined
    }
    setLoadingId(id)
    try {
      const res = await fetch(`/api/pagos/${id}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, notas }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'No se pudo procesar el pago.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoadingId(null)
    }
  }

  async function adjuntar(id: string, file: File | undefined) {
    if (!file) return
    setError(null)
    setLoadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/pagos/${id}/comprobante`, { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'No se pudo subir el comprobante.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoadingId(null)
    }
  }

  if (pagos.length === 0 && !mostrarVacio) return null

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Pendientes de verificación</CardTitle>
        <CardDescription>
          Pagos cargados como pendientes (con o sin comprobante) que esperan tu aprobación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pagos pendientes de verificación.</p>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pagos.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="font-medium text-foreground">{p.persona}</p>
                <p className="text-sm text-muted-foreground">{p.evento}</p>
                <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {conceptoLabel[p.concepto] ?? p.concepto}
                </span>
                <span className="mt-1 ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {medioLabel[p.medio_pago] ?? p.medio_pago}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">${Number(p.monto).toFixed(2)}</span>
                <span className="text-muted-foreground">{p.fecha_pago ? formatDateAR(p.fecha_pago) : '—'}</span>
              </div>
              {p.comprobante_signed_url ? (
                <button
                  type="button"
                  onClick={() => setComprobante(p)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  Ver comprobante
                </button>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-primary hover:underline">
                  <Paperclip className="h-4 w-4" />
                  Sin comprobante — adjuntar
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={loadingId === p.id}
                    onChange={(e) => adjuntar(p.id, e.target.files?.[0])}
                  />
                </label>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={loadingId === p.id}
                  onClick={() => verificar(p.id, 'aprobar')}
                >
                  <Check className="h-4 w-4" />
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 bg-transparent"
                  disabled={loadingId === p.id}
                  onClick={() => verificar(p.id, 'rechazar')}
                >
                  <X className="h-4 w-4" />
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>

      <Dialog open={!!comprobante} onOpenChange={(open) => !open && setComprobante(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprobante de transferencia</DialogTitle>
            {comprobante && (
              <DialogDescription>
                {comprobante.persona} — ${Number(comprobante.monto).toFixed(2)}
              </DialogDescription>
            )}
          </DialogHeader>
          {comprobante?.comprobante_signed_url && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                {isPdfUrl(comprobante.comprobante_signed_url) ? (
                  <iframe
                    src={comprobante.comprobante_signed_url}
                    title="Comprobante"
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <img
                    src={comprobante.comprobante_signed_url}
                    alt="Comprobante de transferencia"
                    className="mx-auto max-h-[70vh] w-auto object-contain"
                  />
                )}
              </div>
              <a
                href={comprobante.comprobante_signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en una pestaña nueva
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AlertTriangle } from 'lucide-react'
import { formatDateAR } from '@/lib/utils'

type Props = {
  eventoId: string
  inicial: {
    solicitud_suspension_notas: string | null
    solicitud_suspension_fecha: string | null
  }
}

export default function SolicitarSuspensionPanel({ eventoId, inicial }: Props) {
  const router = useRouter()
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState<'solicitar' | 'cancelar' | null>(null)
  const [error, setError] = useState('')
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)

  const tieneSolicitud = !!inicial.solicitud_suspension_fecha

  async function handleSolicitar() {
    if (!notas.trim()) {
      setError('El motivo de la solicitud es obligatorio')
      return
    }
    setLoading('solicitar')
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/solicitar-suspension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas }),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error inesperado')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancelar() {
    setConfirmandoCancelar(false)
    setLoading('cancelar')
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/solicitar-suspension`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error inesperado')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800 pb-3">
        <AlertTriangle className="h-4 w-4" />
        Solicitar Suspensión
      </h3>

      {tieneSolicitud ? (
        <div className="space-y-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Solicitud enviada el {formatDateAR(inicial.solicitud_suspension_fecha!)}
          </p>
          <div className="rounded bg-amber-100 dark:bg-amber-900/30 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Motivo:</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{inicial.solicitud_suspension_notas}</p>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            El Equipo Timón está revisando tu solicitud.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmandoCancelar(true)}
            disabled={loading !== null}
            className="w-full bg-transparent border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
          >
            {loading === 'cancelar' ? 'Cancelando...' : 'Cancelar solicitud'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Si necesitás suspender este retiro, enviá una solicitud al Equipo Timón con el motivo.
          </p>
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">Motivo <span className="text-destructive">*</span></p>
            <textarea
              className="w-full rounded border border-amber-300 dark:border-amber-700 bg-background px-3 py-2 text-sm text-foreground min-h-20"
              value={notas}
              placeholder="Explicá por qué necesitás suspender este retiro..."
              onChange={e => { setNotas(e.target.value); setError('') }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="sm"
            onClick={handleSolicitar}
            disabled={loading !== null}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading === 'solicitar' ? 'Enviando...' : 'Solicitar Suspensión'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmandoCancelar}
        onOpenChange={setConfirmandoCancelar}
        titulo="¿Cancelar la solicitud de suspensión?"
        descripcion="El Equipo Timón dejará de ver el pedido. Podés volver a solicitarla más adelante."
        confirmar="Cancelar solicitud"
        tono="advertencia"
        onConfirm={handleCancelar}
      />
    </div>
  )
}

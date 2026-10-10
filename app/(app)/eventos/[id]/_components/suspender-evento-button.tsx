'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OctagonX } from 'lucide-react'

type Props = {
  eventoId: string
}

export default function SuspenderEventoButton({ eventoId }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  function pedirConfirmacion() {
    if (!notas.trim()) {
      setError('El motivo de la suspensión es obligatorio')
      return
    }
    setError('')
    setConfirmando(true)
  }

  async function handleSuspender() {
    setConfirmando(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/suspender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas_suspension: notas }),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error inesperado')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30 bg-transparent"
      >
        <OctagonX className="h-4 w-4" />
        Suspender Retiro
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20 p-4 space-y-3 w-full">
      <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
        <OctagonX className="h-4 w-4" />
        Suspender Retiro
      </p>
      <p className="text-xs text-orange-700 dark:text-orange-400">
        Esta acción es definitiva. El retiro quedará en estado Suspendido y no podrá reactivarse.
      </p>
      <div>
        <p className="text-xs text-orange-700 dark:text-orange-400 mb-1">Motivo de la suspensión <span className="text-destructive">*</span></p>
        <textarea
          className="w-full rounded border border-orange-300 dark:border-orange-700 bg-background px-3 py-2 text-sm text-foreground min-h-20"
          value={notas}
          placeholder="Describí el motivo de la suspensión..."
          onChange={e => { setNotas(e.target.value); setError('') }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setExpanded(false); setNotas(''); setError('') }}
          disabled={loading}
          className="flex-1 bg-transparent"
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={pedirConfirmacion}
          disabled={loading}
          className="flex-1"
        >
          {loading ? 'Suspendiendo...' : 'Confirmar Suspensión'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="¿Suspender este retiro?"
        descripcion="Esta acción es definitiva: el retiro queda en estado Suspendido y no puede reactivarse."
        confirmar="Suspender retiro"
        tono="destructivo"
        onConfirm={handleSuspender}
      >
        <div className="rounded-md border border-orange-300 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/40">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-800 dark:text-orange-400">
            Motivo
          </p>
          <p className="mt-1 text-sm text-orange-900 dark:text-orange-200">{notas.trim()}</p>
        </div>
      </ConfirmDialog>
    </div>
  )
}

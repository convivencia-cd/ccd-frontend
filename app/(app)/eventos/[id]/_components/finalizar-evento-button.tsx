'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function FinalizarEventoButton({ eventoId }: { eventoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const handleFinalizar = async () => {
    setConfirmando(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/finalizar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al finalizar el retiro')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={() => setConfirmando(true)}
        disabled={loading}
        size="sm"
        variant="outline"
        className="gap-2 bg-transparent"
      >
        <Flag className="h-4 w-4" />
        {loading ? 'Finalizando...' : 'Finalizar Retiro'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="¿Finalizar el retiro?"
        descripcion='Pasará a estado "Finalizado".'
        confirmar="Finalizar retiro"
        onConfirm={handleFinalizar}
      />
    </div>
  )
}

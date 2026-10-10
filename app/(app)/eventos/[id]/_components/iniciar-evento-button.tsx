'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function IniciarEventoButton({ eventoId }: { eventoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const handleIniciar = async () => {
    setConfirmando(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/iniciar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al iniciar el retiro')
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
        className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
      >
        <Play className="h-4 w-4" />
        {loading ? 'Iniciando...' : 'Iniciar Retiro'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="¿Iniciar el retiro?"
        descripcion='Pasará a estado "En Curso" y dejará de mostrarse en la home pública.'
        confirmar="Iniciar retiro"
        onConfirm={handleIniciar}
      />
    </div>
  )
}

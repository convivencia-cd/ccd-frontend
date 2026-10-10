'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link2, CheckCircle2 } from 'lucide-react'

type Estado = { conectado: boolean; mp_user_id?: number; conectado_en?: string }

export default function MercadoPagoPanel({ organizacionId }: { organizacionId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/organizaciones/${organizacionId}/mercadopago/estado`)
      .then((res) => res.json())
      .then((data) => setEstado(data))
      .catch(() => setEstado({ conectado: false }))
  }, [organizacionId])

  async function handleDesconectar() {
    setLoading(true)
    try {
      await fetch(`/api/organizaciones/${organizacionId}/mercadopago/desconectar`, { method: 'POST' })
      setEstado({ conectado: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Mercado Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Las inscripciones de todos los retiros se cobran en la cuenta de Mercado Pago del Equipo Timón.
          La cuenta de esta organización se usa solo para los pagos de pensión de sus retiros.
        </p>

        {!estado ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : estado.conectado ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Conectado (cuenta MP #{estado.mp_user_id})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDesconectar}
              disabled={loading}
              className="text-destructive hover:text-destructive"
            >
              {loading ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </div>
        ) : (
          <Button size="sm" className="gap-1.5" asChild>
            <a href={`/api/organizaciones/${organizacionId}/mercadopago/conectar`}>
              <Link2 className="h-3.5 w-3.5" />
              Conectar con Mercado Pago
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

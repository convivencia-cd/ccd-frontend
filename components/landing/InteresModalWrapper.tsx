'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InteresModal } from './InteresModal'

interface Props {
  eventoId: string
  eventoNombre: string
  volverAlListadoHref?: string
}

export function InteresModalWrapper({ eventoId, eventoNombre, volverAlListadoHref }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        Quiero participar
      </Button>
      <InteresModal
        eventoId={eventoId}
        eventoNombre={eventoNombre}
        open={open}
        onOpenChange={setOpen}
        volverAlListadoHref={volverAlListadoHref}
      />
    </>
  )
}

'use client'

import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'

/** Debe renderizarse dentro de Link para seguir su transición, incluso antes del fallback. */
export function NavigationPending() {
  const { pending } = useLinkStatus()

  return (
    <span className="ml-auto inline-flex h-4 w-4 shrink-0" role="status">
      {pending && (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          <span className="sr-only">Cargando destino…</span>
        </>
      )}
    </span>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

/** Fallback compartido: mantiene la navegación disponible mientras llegan los datos. */
export function PageLoading() {
  return (
    <div className="space-y-8 pt-12 md:pt-0" aria-busy="true">
      <p role="status" className="text-sm text-muted-foreground">
        Cargando pantalla…
      </p>
      <div aria-hidden="true" className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 max-w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-64 max-w-full motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-10 w-32 motion-reduce:animate-none" />
        </div>
        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-10 w-full max-w-sm motion-reduce:animate-none" />
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 motion-reduce:animate-none" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-1/3 motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

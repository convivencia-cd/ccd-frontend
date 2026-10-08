'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { InteresModal } from './InteresModal'

const TIPO_LABELS: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro corto',
  taller: 'Taller',
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  bimodal: 'Bimodal',
}

function formatDateRange(inicio: string, fin: string) {
  const start = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const locale = 'es-AR'
  if (inicio === fin) return start.toLocaleDateString(locale, opts)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} al ${end.toLocaleDateString(locale, opts)}`
  }
  return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString(locale, opts)}`
}

interface Evento {
  id: string
  nombre: string
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  ciudad?: string | null
  provincia_evento?: string | null
  modalidad?: string | null
  cupo_maximo?: number | null
  flyer_horizontal_url?: string | null
  flyer_cuadrado_url?: string | null
  organizacion?: unknown
}

interface Props {
  eventos: Evento[]
}

export function EventosPublicosGrid({ eventos }: Props) {
  const [modalEvento, setModalEvento] = useState<{ id: string; nombre: string } | null>(null)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventos.map((evento) => {
          const org = evento.organizacion as unknown as { nombre: string } | null
          const flyerH = evento.flyer_horizontal_url ?? null
          const flyerC = evento.flyer_cuadrado_url ?? null
          return (
            <Card key={evento.id} className="flex flex-col overflow-hidden">
              {(flyerH || flyerC) && (
                <Link href={`/e/${evento.id}`} className="block relative hover:opacity-95 transition-opacity">
                  {flyerC && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flyerC} alt="" className={`w-full aspect-square object-cover${flyerH ? ' sm:hidden' : ''}`} />
                  )}
                  {flyerH && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flyerH} alt="" className={`w-full aspect-video object-cover${flyerC ? ' hidden sm:block' : ''}`} />
                  )}
                </Link>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {TIPO_LABELS[evento.tipo] ?? evento.tipo}
                  </Badge>
                  {evento.modalidad && evento.modalidad !== 'presencial' && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {MODALIDAD_LABELS[evento.modalidad] ?? evento.modalidad}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-2 text-base leading-snug line-clamp-2">
                  {evento.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{formatDateRange(evento.fecha_inicio, evento.fecha_fin)}</span>
                </div>
                {(evento.ciudad || evento.provincia_evento) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {[evento.ciudad, evento.provincia_evento].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {evento.cupo_maximo && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Cupo: {evento.cupo_maximo} personas</span>
                  </div>
                )}
                {org?.nombre && (
                  <p className="mt-1 text-xs text-muted-foreground/70">{org.nombre}</p>
                )}
              </CardContent>
              <CardFooter className="mt-auto pt-3">
                <Button size="sm" className="w-full" asChild>
                  <Link href={`/e/${evento.id}`}>Más información</Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {modalEvento && (
        <InteresModal
          eventoId={modalEvento.id}
          eventoNombre={modalEvento.nombre}
          open={!!modalEvento}
          onOpenChange={(open) => { if (!open) setModalEvento(null) }}
        />
      )}
    </>
  )
}

'use client'

import Link from 'next/link'
import { ChevronRight, MapPin, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIPO_LABEL, nombreMes, type CalendarioEvento } from '@/lib/eventos/calendario-shared'
import { estiloTipo } from './estilos'
import { BadgeEstado, ChipsRoles, fechasDeEvento } from './evento-detalle'

const fmtDiaSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })

function FilaAgenda({ evento, hoy }: { evento: CalendarioEvento; hoy: string }) {
  const estilo = estiloTipo(evento.tipo)
  const mio = evento.misRoles.length > 0
  const pasado = evento.fechaFin < hoy
  const enCurso = evento.fechaInicio <= hoy && evento.fechaFin >= hoy
  const organizacion = [evento.confraternidad?.nombre, evento.fraternidad?.nombre].filter(Boolean).join(' · ')
  const dia = new Date(`${evento.fechaInicio}T00:00:00Z`)

  const contenido = (
    <>
      <div className="w-12 shrink-0 text-center">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">
          {fmtDiaSemana.format(dia).replace('.', '')}
        </p>
        <p
          className={cn(
            'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold',
            enCurso ? 'bg-primary text-primary-foreground' : 'text-foreground',
          )}
        >
          {Number(evento.fechaInicio.slice(8, 10))}
        </p>
      </div>
      <span className={cn('w-1 shrink-0 self-stretch rounded-full', estilo.punto, !mio && 'opacity-40')} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('font-medium text-foreground', evento.estado === 'suspendido' && 'line-through')}>
            {evento.nombre}
          </p>
          <BadgeEstado evento={evento} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className={cn('font-medium', estilo.texto)}>
            {evento.tipoEventoNombre ?? TIPO_LABEL[evento.tipo] ?? evento.tipo}
          </span>
          <span>{fechasDeEvento(evento)}</span>
          {evento.lugar && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {evento.lugar}
            </span>
          )}
          {organizacion && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" aria-hidden="true" />
              {organizacion}
            </span>
          )}
        </p>
        <ChipsRoles roles={evento.misRoles} className="pt-0.5" />
      </div>
      {evento.href && <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" aria-hidden="true" />}
    </>
  )

  const clases = cn('flex items-start gap-3 rounded-lg px-2 py-3', pasado && 'opacity-60')
  return (
    <li>
      {evento.href ? (
        <Link href={evento.href} className={cn(clases, 'transition-colors hover:bg-muted/60')}>
          {contenido}
        </Link>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </li>
  )
}

/** Lista cronológica agrupada por mes (el "Agenda" de Google Calendar). */
export function VistaAgenda({ eventos, hoy, vacio }: { eventos: CalendarioEvento[]; hoy: string; vacio: string }) {
  if (eventos.length === 0) {
    return <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">{vacio}</p>
  }

  const porMes = new Map<string, CalendarioEvento[]>()
  for (const ev of eventos) {
    const mes = ev.fechaInicio.slice(0, 7)
    const lista = porMes.get(mes) ?? []
    lista.push(ev)
    porMes.set(mes, lista)
  }

  return (
    <div className="space-y-6">
      {[...porMes.entries()].map(([mes, lista]) => (
        <section key={mes} aria-label={nombreMes(mes)}>
          <h3 className="sticky top-0 z-10 border-b border-border bg-background/95 py-2 text-sm font-semibold text-foreground backdrop-blur">
            {nombreMes(mes)}
            <span className="ml-2 font-normal text-muted-foreground">
              {lista.length} {lista.length === 1 ? 'retiro' : 'retiros'}
            </span>
          </h3>
          <ul className="divide-y divide-border/60">
            {lista.map(ev => (
              <FilaAgenda key={ev.id} evento={ev} hoy={hoy} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

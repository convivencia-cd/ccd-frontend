'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  addDias,
  diaSemanaLunes,
  diffDias,
  fechaLarga,
  primerDiaDelMes,
  ultimoDiaDelMes,
  type CalendarioEvento,
} from '@/lib/eventos/calendario-shared'
import { estiloTipo } from './estilos'
import { EventoDetalle, fechasDeEvento, textoRol } from './evento-detalle'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Segmento = {
  evento: CalendarioEvento
  col: number
  span: number
  carril: number
  continuaAntes: boolean
  continuaDespues: boolean
}

type Semana = {
  dias: string[]
  segmentos: Segmento[]
  /** Por columna: cuántos eventos quedaron sin lugar visible. */
  ocultos: number[]
  /** Por columna: todos los eventos del día (para el "+N más"). */
  delDia: CalendarioEvento[][]
}

function armarSemanas(mes: string, eventos: CalendarioEvento[], maxCarriles: number): Semana[] {
  const primero = primerDiaDelMes(mes)
  const ultimo = ultimoDiaDelMes(mes)
  const inicio = addDias(primero, -diaSemanaLunes(primero))
  const fin = addDias(ultimo, 6 - diaSemanaLunes(ultimo))
  const cantidad = (diffDias(inicio, fin) + 1) / 7

  const semanas: Semana[] = []
  for (let w = 0; w < cantidad; w++) {
    const lunes = addDias(inicio, w * 7)
    const domingo = addDias(lunes, 6)
    const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i))

    const crudos: Omit<Segmento, 'carril'>[] = []
    for (const evento of eventos) {
      for (const t of evento.tramos) {
        if (t.inicio > domingo || t.fin < lunes) continue
        const desde = t.inicio < lunes ? lunes : t.inicio
        const hasta = t.fin > domingo ? domingo : t.fin
        crudos.push({
          evento,
          col: diffDias(lunes, desde),
          span: diffDias(desde, hasta) + 1,
          continuaAntes: t.inicio < lunes,
          continuaDespues: t.fin > domingo,
        })
      }
    }
    // Primero los que arrancan antes; ante empate, los propios y luego los más largos.
    crudos.sort(
      (a, b) =>
        a.col - b.col ||
        Number(b.evento.misRoles.length > 0) - Number(a.evento.misRoles.length > 0) ||
        b.span - a.span ||
        a.evento.nombre.localeCompare(b.evento.nombre, 'es'),
    )

    const ocupado: boolean[][] = []
    const segmentos: Segmento[] = []
    const ocultos = Array(7).fill(0) as number[]
    const delDia: CalendarioEvento[][] = Array.from({ length: 7 }, () => [])

    for (const s of crudos) {
      for (let c = s.col; c < s.col + s.span; c++) {
        if (!delDia[c].includes(s.evento)) delDia[c].push(s.evento)
      }
      let carril = 0
      for (; ; carril++) {
        ocupado[carril] ??= Array(7).fill(false)
        let libre = true
        for (let c = s.col; c < s.col + s.span; c++) if (ocupado[carril][c]) libre = false
        if (libre) break
      }
      for (let c = s.col; c < s.col + s.span; c++) ocupado[carril][c] = true
      if (carril < maxCarriles) segmentos.push({ ...s, carril })
      else for (let c = s.col; c < s.col + s.span; c++) ocultos[c]++
    }

    semanas.push({ dias, segmentos, ocultos, delDia })
  }
  return semanas
}

function BarraEvento({ segmento, compacto }: { segmento: Segmento; compacto: boolean }) {
  const { evento } = segmento
  const estilo = estiloTipo(evento.tipo)
  const mio = evento.misRoles.length > 0
  const rolPrincipal = evento.misRoles[0]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{ gridColumn: `${segmento.col + 1} / span ${segmento.span}`, gridRow: segmento.carril + 2 }}
          className={cn(
            'z-10 mx-0.5 flex min-w-0 items-center gap-1 overflow-hidden px-1.5 text-left text-[11px] font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mio ? estilo.solido : estilo.suave,
            segmento.continuaAntes ? 'ml-0 rounded-l-none' : 'rounded-l',
            segmento.continuaDespues ? 'mr-0 rounded-r-none' : 'rounded-r',
            evento.enTramite && 'border border-dashed border-current opacity-80',
            evento.estado === 'suspendido' && 'line-through opacity-70',
          )}
          aria-label={`${evento.nombre}, ${fechasDeEvento(evento)}${
            mio ? `, tu rol: ${evento.misRoles.map(textoRol).join(', ')}` : ''
          }`}
        >
          <span className="truncate">{evento.nombre}</span>
          {mio && !compacto && segmento.span > 1 && (
            <span className="ml-auto hidden shrink-0 rounded bg-black/15 px-1 text-[10px] leading-4 md:inline dark:bg-white/25">
              {rolPrincipal.label}
              {evento.misRoles.length > 1 ? ` +${evento.misRoles.length - 1}` : ''}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <EventoDetalle evento={evento} />
      </PopoverContent>
    </Popover>
  )
}

function MasEventos({ dia, col, fila, cantidad, eventos }: { dia: string; col: number; fila: number; cantidad: number; eventos: CalendarioEvento[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{ gridColumn: col + 1, gridRow: fila }}
          className="z-10 mx-0.5 truncate rounded px-1.5 text-left text-[11px] font-medium leading-5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{cantidad} más
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <p className="mb-2 text-sm font-semibold text-foreground">{fechaLarga(dia)}</p>
        <ul className="space-y-1">
          {eventos.map(ev => {
            const estilo = estiloTipo(ev.tipo)
            const contenido = (
              <>
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-sm', estilo.punto)} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{ev.nombre}</span>
                  {ev.misRoles.length > 0 && (
                    <span className="block truncate text-xs text-primary">
                      Tu rol: {ev.misRoles.map(textoRol).join(', ')}
                    </span>
                  )}
                </span>
              </>
            )
            return (
              <li key={ev.id}>
                {ev.href ? (
                  <Link href={ev.href} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-muted">
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2 p-1.5">{contenido}</div>
                )}
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function VistaMes({
  mes,
  eventos,
  hoy,
  compacto = false,
}: {
  mes: string
  eventos: CalendarioEvento[]
  hoy: string
  compacto?: boolean
}) {
  const maxCarriles = compacto ? 3 : 4
  const semanas = useMemo(() => armarSemanas(mes, eventos, maxCarriles), [mes, eventos, maxCarriles])

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {semanas.map((semana, w) => {
        const carrilesUsados = semana.segmentos.reduce((m, s) => Math.max(m, s.carril + 1), 0)
        const hayOcultos = semana.ocultos.some(n => n > 0)
        const filaMas = carrilesUsados + 2
        return (
          <div
            key={semana.dias[0]}
            className={cn('grid gap-y-0.5', w < semanas.length - 1 && 'border-b border-border')}
            style={{
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              // repeat(0, …) es CSS inválido: sin carriles la fila no lleva esa parte.
              gridTemplateRows: [
                '1.75rem',
                carrilesUsados > 0 ? `repeat(${carrilesUsados}, 1.25rem)` : '',
                hayOcultos ? '1.25rem' : '',
                'minmax(0.25rem, 1fr)',
              ]
                .filter(Boolean)
                .join(' '),
              minHeight: compacto ? '5.25rem' : '7.5rem',
            }}
          >
            {semana.dias.map((dia, i) => {
              const delMes = dia.slice(0, 7) === mes
              const esHoy = dia === hoy
              return (
                <div
                  key={dia}
                  style={{ gridColumn: i + 1, gridRow: '1 / -1' }}
                  className={cn(
                    'px-1 pt-1',
                    i < 6 && 'border-r border-border',
                    !delMes && 'bg-muted/30',
                    i >= 5 && delMes && 'bg-muted/15',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs',
                      esHoy
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : delMes
                          ? 'text-foreground'
                          : 'text-muted-foreground/60',
                    )}
                    aria-current={esHoy ? 'date' : undefined}
                  >
                    {Number(dia.slice(8, 10))}
                  </span>
                </div>
              )
            })}
            {semana.segmentos.map(s => (
              <BarraEvento key={`${s.evento.id}-${s.col}-${s.carril}`} segmento={s} compacto={compacto} />
            ))}
            {semana.ocultos.map((n, col) =>
              n > 0 ? (
                <MasEventos
                  key={col}
                  dia={semana.dias[col]}
                  col={col}
                  fila={filaMas}
                  cantidad={n}
                  eventos={semana.delDia[col]}
                />
              ) : null,
            )}
          </div>
        )
      })}
    </div>
  )
}

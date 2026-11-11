'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, List, Loader2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  TIPO_LABEL,
  addDias,
  addMeses,
  diaSemanaLunes,
  nombreMes,
  primerDiaDelMes,
  solapa,
  ultimoDiaDelMes,
  type CalendarioEvento,
} from '@/lib/eventos/calendario-shared'
import { TIPOS_LEYENDA, estiloTipo } from './estilos'
import { ChipsRoles, fechasDeEvento } from './evento-detalle'
import { VistaAgenda } from './vista-agenda'
import { VistaMes } from './vista-mes'

type Vista = 'mes' | 'agenda'

export type CalendarioEventosProps = {
  eventos: CalendarioEvento[]
  hoy: string
  mesInicial: string
  /** Ventana que trajo el servidor; navegar fuera de ella recarga /calendario. */
  rango: { desde: string; hasta: string }
  variante: 'inicio' | 'completo'
  vistaInicial?: Vista
  puedeVerEnTramite?: boolean
  incluyeEnTramite?: boolean
}

function bordesGrilla(mes: string) {
  const primero = primerDiaDelMes(mes)
  const ultimo = ultimoDiaDelMes(mes)
  return {
    inicio: addDias(primero, -diaSemanaLunes(primero)),
    fin: addDias(ultimo, 6 - diaSemanaLunes(ultimo)),
  }
}

function urlCalendario(mes: string, vista: Vista, tramite: boolean) {
  const params = new URLSearchParams({ mes })
  if (vista !== 'mes') params.set('vista', vista)
  if (tramite) params.set('tramite', '1')
  return `/calendario?${params.toString()}`
}

function Leyenda({ tipos }: { tipos: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {tipos.map(t => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', estiloTipo(t).punto)} aria-hidden="true" />
          {TIPO_LABEL[t] ?? t}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm bg-blue-600 dark:bg-blue-500" aria-hidden="true" />
        Tenés un rol
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm bg-blue-100 dark:bg-blue-950" aria-hidden="true" />
        Sin rol
      </span>
    </div>
  )
}

function MisProximos({ eventos, hoy, max }: { eventos: CalendarioEvento[]; hoy: string; max: number }) {
  const mios = eventos.filter(e => e.misRoles.length > 0 && e.fechaFin >= hoy).slice(0, max)
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        Tus próximos retiros
      </h3>
      {mios.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenés un rol asignado en los próximos retiros.</p>
      ) : (
        <ul className="space-y-2">
          {mios.map(ev => {
            const estilo = estiloTipo(ev.tipo)
            const contenido = (
              <>
                <span className={cn('w-1 shrink-0 self-stretch rounded-full', estilo.punto)} aria-hidden="true" />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">{ev.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{fechasDeEvento(ev)}</span>
                  <ChipsRoles roles={ev.misRoles} />
                </span>
              </>
            )
            return (
              <li key={ev.id}>
                {ev.href ? (
                  <Link href={ev.href} className="flex gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/60">
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex gap-2.5 p-2">{contenido}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function CalendarioEventos({
  eventos,
  hoy,
  mesInicial,
  rango,
  variante,
  vistaInicial = 'mes',
  puedeVerEnTramite = false,
  incluyeEnTramite = false,
}: CalendarioEventosProps) {
  const router = useRouter()
  const [navegando, startTransition] = useTransition()
  const [mes, setMes] = useState(mesInicial)
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [tipos, setTipos] = useState<string[]>([])
  const [soloMios, setSoloMios] = useState(false)
  const [confraId, setConfraId] = useState('')
  const completo = variante === 'completo'

  // Mantener la URL al día para poder compartir/recargar sin volver a pedir datos.
  useEffect(() => {
    if (!completo) return
    const url = urlCalendario(mes, vista, incluyeEnTramite)
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url)
  }, [completo, mes, vista, incluyeEnTramite])

  const irAMes = (nuevo: string) => {
    const { inicio, fin } = bordesGrilla(nuevo)
    if (inicio >= rango.desde && fin <= rango.hasta) {
      setMes(nuevo)
      return
    }
    startTransition(() => router.push(urlCalendario(nuevo, vista, incluyeEnTramite)))
  }

  const tiposPresentes = useMemo(() => {
    const set = new Set<string>(TIPOS_LEYENDA.filter(t => eventos.some(e => e.tipo === t)))
    for (const e of eventos) set.add(e.tipo)
    return [...set]
  }, [eventos])

  const confraternidades = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of eventos) if (e.confraternidad) map.set(e.confraternidad.id, e.confraternidad.nombre)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [eventos])

  const filtrados = useMemo(
    () =>
      eventos.filter(
        e =>
          (tipos.length === 0 || tipos.includes(e.tipo)) &&
          (!soloMios || e.misRoles.length > 0) &&
          (!confraId || e.confraternidad?.id === confraId),
      ),
    [eventos, tipos, soloMios, confraId],
  )

  const { inicio: gridInicio, fin: gridFin } = bordesGrilla(mes)
  const delMes = filtrados.filter(e => solapa(e.fechaInicio, e.fechaFin, primerDiaDelMes(mes), ultimoDiaDelMes(mes)))
  const enGrilla = filtrados.filter(e => solapa(e.fechaInicio, e.fechaFin, gridInicio, gridFin))
  const agenda = filtrados.filter(e => e.fechaFin >= primerDiaDelMes(mes))
  const mesHoy = hoy.slice(0, 7)

  const toggleTipo = (t: string) => setTipos(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const barra = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => irAMes(mesHoy)} disabled={mes === mesHoy && vista === 'mes'}>
          Hoy
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon-sm" onClick={() => irAMes(addMeses(mes, -1))} aria-label="Mes anterior">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => irAMes(addMeses(mes, 1))} aria-label="Mes siguiente">
            <ChevronRight />
          </Button>
        </div>
        <h2 className={cn('font-semibold text-foreground', completo ? 'text-xl' : 'text-base')} aria-live="polite">
          {vista === 'agenda' ? `Desde ${nombreMes(mes).toLocaleLowerCase('es')}` : nombreMes(mes)}
        </h2>
        {navegando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {delMes.length} {delMes.length === 1 ? 'retiro' : 'retiros'} en el mes
        </span>
        {completo && (
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Vista">
            {(
              [
                { v: 'mes', label: 'Mes', icon: CalendarDays },
                { v: 'agenda', label: 'Agenda', icon: List },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors',
                  vista === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (!completo) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-3">
          {barra}
          <VistaMes mes={mes} eventos={enGrilla} hoy={hoy} compacto />
          <Leyenda tipos={tiposPresentes.length ? tiposPresentes : ['convivencia', 'retiro']} />
        </div>
        <aside className="space-y-4 lg:border-l lg:border-border lg:pl-6">
          <MisProximos eventos={eventos} hoy={hoy} max={4} />
          <Link href={urlCalendario(mes, 'mes', false)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver calendario completo <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {barra}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo">
            {tiposPresentes.map(t => {
              const activo = tipos.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTipo(t)}
                  aria-pressed={activo}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    activo ? 'border-foreground/30 bg-background text-foreground shadow-xs' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-sm', estiloTipo(t).punto)} aria-hidden="true" />
                  {TIPO_LABEL[t] ?? t}
                </button>
              )
            })}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Switch checked={soloMios} onCheckedChange={setSoloMios} />
            Solo donde tengo un rol
          </label>
          {confraternidades.length > 1 && (
            <select
              value={confraId}
              onChange={e => setConfraId(e.target.value)}
              aria-label="Filtrar por confraternidad"
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              <option value="">Todas las confraternidades</option>
              {confraternidades.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          )}
          {puedeVerEnTramite && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Switch
                checked={incluyeEnTramite}
                disabled={navegando}
                onCheckedChange={v => startTransition(() => router.push(urlCalendario(mes, vista, v)))}
              />
              Incluir en trámite
            </label>
          )}
        </div>

        {vista === 'mes' ? (
          <VistaMes mes={mes} eventos={enGrilla} hoy={hoy} />
        ) : (
          <>
            <VistaAgenda
              eventos={agenda}
              hoy={hoy}
              vacio={soloMios || tipos.length || confraId ? 'No hay retiros con estos filtros.' : 'No hay retiros en este período.'}
            />
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={navegando}
                onClick={() =>
                  startTransition(() => router.push(urlCalendario(addMeses(mes, 12), 'agenda', incluyeEnTramite)))
                }
              >
                Ver los 12 meses siguientes
              </Button>
            </div>
          </>
        )}
        <Leyenda tipos={tiposPresentes.length ? tiposPresentes : ['convivencia', 'retiro']} />
      </div>

      <aside className="space-y-4 xl:border-l xl:border-border xl:pl-6">
        <MisProximos eventos={eventos} hoy={hoy} max={8} />
      </aside>
    </div>
  )
}

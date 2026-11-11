'use client'

import Link from 'next/link'
import { ArrowRight, Building2, CalendarDays, MapPin, User, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ESTADO_LABEL,
  TIPO_LABEL,
  fechaLarga,
  rangoCorto,
  type CalendarioEvento,
  type RolCalendario,
} from '@/lib/eventos/calendario-shared'
import { ESTADO_BADGE, ESTADO_BADGE_TRAMITE, estiloTipo } from './estilos'

export function textoRol(r: RolCalendario) {
  return r.detalle ? `${r.label} · ${r.detalle}` : r.label
}

export function ChipsRoles({ roles, className }: { roles: RolCalendario[]; className?: string }) {
  if (roles.length === 0) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {roles.map(r => (
        <span
          key={r.rol}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          <UserCheck className="h-3 w-3" aria-hidden="true" />
          {textoRol(r)}
        </span>
      ))}
    </span>
  )
}

export function BadgeEstado({ evento }: { evento: CalendarioEvento }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        evento.enTramite ? ESTADO_BADGE_TRAMITE : ESTADO_BADGE[evento.estado] ?? ESTADO_BADGE.finalizado,
      )}
    >
      {evento.enTramite ? `En trámite · ${ESTADO_LABEL[evento.estado] ?? evento.estado}` : ESTADO_LABEL[evento.estado] ?? evento.estado}
    </span>
  )
}

export function fechasDeEvento(evento: CalendarioEvento): string {
  return evento.tramos.map(t => rangoCorto(t.inicio, t.fin)).join(' · ')
}

/** Contenido del popover que se abre al tocar un evento en el calendario. */
export function EventoDetalle({ evento }: { evento: CalendarioEvento }) {
  const estilo = estiloTipo(evento.tipo)
  const organizacion = [evento.confraternidad?.nombre, evento.fraternidad?.nombre].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className={cn('mt-1.5 h-3 w-3 shrink-0 rounded-sm', estilo.punto)} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className={cn('font-semibold leading-snug text-foreground', evento.estado === 'suspendido' && 'line-through')}>
            {evento.nombre}
          </p>
          <p className={cn('text-xs font-medium', estilo.texto)}>
            {evento.tipoEventoNombre ?? TIPO_LABEL[evento.tipo] ?? evento.tipo}
          </p>
        </div>
      </div>

      <BadgeEstado evento={evento} />

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {evento.tramos.length === 1 && evento.tramos[0].inicio === evento.tramos[0].fin
              ? fechaLarga(evento.tramos[0].inicio)
              : fechasDeEvento(evento)}
          </span>
        </li>
        {evento.lugar && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{evento.lugar}</span>
          </li>
        )}
        {organizacion && (
          <li className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{organizacion}</span>
          </li>
        )}
        {evento.coordinador && (
          <li className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Coordina: {evento.coordinador}</span>
          </li>
        )}
      </ul>

      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu rol</p>
        {evento.misRoles.length > 0 ? (
          <ChipsRoles roles={evento.misRoles} />
        ) : (
          <p className="text-sm text-muted-foreground">No tenés un rol en este retiro.</p>
        )}
      </div>

      {evento.href && (
        <Link
          href={evento.href}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ver retiro
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

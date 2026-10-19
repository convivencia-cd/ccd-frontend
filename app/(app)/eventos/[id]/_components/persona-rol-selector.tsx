'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { apellidoNombreConApodo } from '@/lib/personas/nombre'

type PersonaOpt = { id: string; nombre: string; apellido: string; apodo?: string | null }

const OTRO = '__otro__'

type OtroConfig =
  | { tipo: 'buscador'; opciones: PersonaOpt[]; personasFallback?: PersonaOpt[] }
  | { tipo: 'texto'; placeholder?: string }

type Props = {
  /** Valor actual: id de persona (mode="id") o "Nombre Apellido" en texto libre (mode="nombre"). */
  value: string
  onChange: (value: string) => void
  /** Personas con el ministerio institucional correspondiente activo — opciones del desplegable principal. */
  opcionesRol: PersonaOpt[]
  mode: 'id' | 'nombre'
  /** Qué mostrar al elegir "Otro": un buscador de personas, o un input de texto libre
   *  (para casos como asesor voluntario, que puede no estar cargado en el sistema). */
  otro: OtroConfig
  className?: string
}

function nombreCompleto(p: PersonaOpt): string {
  return `${p.nombre} ${p.apellido}`
}

export function PersonaRolSelector({ value, onChange, opcionesRol, mode, otro, className }: Props) {
  const matched = useMemo(() => {
    if (!value) return undefined
    if (mode === 'id') return opcionesRol.find(p => p.id === value)
    const v = value.trim().toLowerCase()
    return opcionesRol.find(p => nombreCompleto(p).toLowerCase() === v)
  }, [value, mode, opcionesRol])

  const [otroForzado, setOtroForzado] = useState(false)
  const mostrarOtro = otroForzado || (!!value && !matched)

  const selectValue = matched ? matched.id : (mostrarOtro ? OTRO : '')

  function handleSelectRol(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === OTRO) {
      setOtroForzado(true)
      onChange('')
      return
    }
    setOtroForzado(false)
    if (!v) {
      onChange('')
      return
    }
    const p = opcionesRol.find(x => x.id === v)
    if (!p) return
    onChange(mode === 'id' ? p.id : nombreCompleto(p))
  }

  const searchOptions = useMemo<ComboboxOption[]>(() => {
    if (otro.tipo !== 'buscador') return []
    // El buscador matchea por palabras contra la etiqueta y el "Nombre Apellido",
    // así "Diego Pascualini" encuentra a "Garcia Pascualini, Diego Rodolfo".
    const opts: ComboboxOption[] = otro.opciones.map(p => ({
      label: apellidoNombreConApodo(p),
      value: mode === 'id' ? p.id : nombreCompleto(p),
      keywords: [nombreCompleto(p)],
    }))
    if (mostrarOtro && value && !opts.some(o => o.value === value)) {
      const fallback = mode === 'id' ? otro.personasFallback?.find(p => p.id === value) : undefined
      opts.unshift({ label: fallback ? apellidoNombreConApodo(fallback) : value, value })
    }
    return opts
  }, [otro, mode, mostrarOtro, value])

  return (
    <div className={className}>
      <select
        className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        value={selectValue}
        onChange={handleSelectRol}
      >
        <option value="">— Sin asignar —</option>
        {opcionesRol.map(p => (
          <option key={p.id} value={p.id}>{apellidoNombreConApodo(p)}</option>
        ))}
        <option value={OTRO}>Otro…</option>
      </select>
      {mostrarOtro && (
        <div className="mt-2">
          {otro.tipo === 'buscador' ? (
            <Combobox
              value={value}
              onSelect={onChange}
              options={searchOptions}
              placeholder="Buscar servidor o familiar..."
              searchPlaceholder="Buscar por nombre, apellido o apodo..."
              emptyText="No se encontraron servidores ni familiares."
            />
          ) : (
            <input
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              value={value}
              placeholder={otro.placeholder ?? 'Nombre y apellido'}
              onChange={e => onChange(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  )
}

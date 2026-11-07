'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { apellidoNombreConApodo } from '@/lib/personas/nombre'

type PersonaOpt = { id: string; nombre: string; apellido: string; apodo?: string | null }

const OTRO = '__otro__'
const ACTUAL = '__actual__'

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
   *  (para casos como asesor voluntario, que puede no estar cargado en el sistema).
   *  null = sin "Otro…": solo se puede elegir de opcionesRol (coordinadores, card #47). */
  otro: OtroConfig | null
  /** Sin "Otro…": para mostrar el nombre de un valor ya guardado que no está en opcionesRol. */
  personasFallback?: PersonaOpt[]
  /** Sin "Otro…": texto cuando opcionesRol está vacío. */
  sinOpcionesTexto?: string
  className?: string
}

function nombreCompleto(p: PersonaOpt): string {
  return `${p.nombre} ${p.apellido}`
}

export function PersonaRolSelector({ value, onChange, opcionesRol, mode, otro, personasFallback, sinOpcionesTexto, className }: Props) {
  const matched = useMemo(() => {
    if (!value) return undefined
    if (mode === 'id') return opcionesRol.find(p => p.id === value)
    const v = value.trim().toLowerCase()
    return opcionesRol.find(p => nombreCompleto(p).toLowerCase() === v)
  }, [value, mode, opcionesRol])

  const [otroForzado, setOtroForzado] = useState(false)
  const mostrarOtro = !!otro && (otroForzado || (!!value && !matched))

  // Sin "Otro…", un valor guardado que ya no está habilitado se muestra como
  // opción propia (y se conserva) hasta que se elija a otra persona.
  const actualFueraDeLista = !otro && !!value && !matched
  const actualLabel = useMemo(() => {
    if (!actualFueraDeLista) return ''
    const p = mode === 'id' ? personasFallback?.find(x => x.id === value) : undefined
    return `${p ? apellidoNombreConApodo(p) : mode === 'id' ? 'Persona asignada' : value} (no habilitado para este tipo)`
  }, [actualFueraDeLista, mode, personasFallback, value])

  const selectValue = matched ? matched.id : actualFueraDeLista ? ACTUAL : (mostrarOtro ? OTRO : '')

  function handleSelectRol(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === OTRO) {
      setOtroForzado(true)
      onChange('')
      return
    }
    setOtroForzado(false)
    if (v === ACTUAL) return
    if (!v) {
      onChange('')
      return
    }
    const p = opcionesRol.find(x => x.id === v)
    if (!p) return
    onChange(mode === 'id' ? p.id : nombreCompleto(p))
  }

  const searchOptions = useMemo<ComboboxOption[]>(() => {
    if (otro?.tipo !== 'buscador') return []
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
        <option value="">
          {!otro && opcionesRol.length === 0 ? (sinOpcionesTexto ?? '— Sin opciones —') : '— Sin asignar —'}
        </option>
        {actualFueraDeLista && <option value={ACTUAL}>{actualLabel}</option>}
        {opcionesRol.map(p => (
          <option key={p.id} value={p.id}>{apellidoNombreConApodo(p)}</option>
        ))}
        {otro && <option value={OTRO}>Otro…</option>}
      </select>
      {mostrarOtro && otro && (
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

"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { createClient } from "@/lib/supabase/client"

export interface DiocesisRow {
  nombre: string
  pais: string | null
  provincia: string | null
}

interface DiocesisComboboxProps {
  value: string
  onChange: (val: string) => void
  /** Si se pasa, prioriza las diócesis de ese país (cae al listado completo si no hay). */
  pais?: string
  /** Si se pasa, prioriza las diócesis de esa provincia (cae al listado del país si no hay). */
  provincia?: string
  disabled?: boolean
  id?: string
  /**
   * Catálogo ya cargado en el servidor. Lo usan las páginas públicas sin
   * sesión (/pago/[id]): la RLS de `diocesis` solo deja leer a usuarios
   * logueados, así que la consulta del navegador volvía vacía y el campo caía
   * a texto libre.
   */
  catalogo?: DiocesisRow[]
}

/**
 * Desplegable de diócesis alimentado por el catálogo `diocesis` (migración 060).
 * Mientras la tabla esté vacía —o no se pueda leer— cae a un campo de texto
 * libre, que es como venía funcionando el campo hasta ahora.
 */
export function DiocesisCombobox({
  value,
  onChange,
  pais,
  provincia,
  disabled,
  id = "diocesis",
  catalogo,
}: DiocesisComboboxProps) {
  const [rows, setRows] = React.useState<DiocesisRow[]>(catalogo ?? [])
  const [loading, setLoading] = React.useState(!catalogo)

  React.useEffect(() => {
    if (catalogo) return
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("diocesis")
        .select("nombre, pais, provincia")
        .eq("estado", "activa")
        .order("nombre")
      if (cancelled) return
      // Si la tabla todavía no existe o está vacía, el campo cae a texto libre.
      setRows(error ? [] : ((data as DiocesisRow[]) ?? []))
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [catalogo])

  const options = React.useMemo<ComboboxOption[]>(() => {
    if (rows.length === 0) return []
    // País: filtro estricto. Si el catálogo no tiene diócesis de ese país,
    // el campo vuelve a ser texto libre (mejor que ofrecer las de otro país).
    const base = pais ? rows.filter((r) => !r.pais || r.pais === pais) : rows
    // Provincia: filtro blando. Si ninguna fila declara esa provincia
    // (dato incompleto), se muestran todas las del país.
    const deLaProvincia = provincia
      ? base.filter((r) => !r.provincia || r.provincia === provincia)
      : base
    const finales = deLaProvincia.length > 0 ? deLaProvincia : base
    const opts = finales.map((r) => ({ label: r.nombre, value: r.nombre }))
    // Conserva un valor ya cargado que no esté en el catálogo (dato histórico).
    if (value && !opts.some((o) => o.value === value)) {
      opts.unshift({ label: value, value })
    }
    return opts
  }, [rows, pais, provincia, value])

  // Si la provincia elegida tiene una sola diócesis, se completa sola.
  React.useEffect(() => {
    if (!disabled && !value && options.length === 1) onChange(options[0].value)
  }, [disabled, value, options, onChange])

  if (!loading && options.length === 0) {
    return (
      <Input
        id={id}
        name={id}
        placeholder="Ej: Diócesis de Corrientes"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  return (
    <Combobox
      value={value ?? ""}
      onSelect={onChange}
      options={options}
      loading={loading}
      placeholder="Seleccionar diócesis..."
      searchPlaceholder="Buscar diócesis..."
      emptyText="No se encontró la diócesis."
      disabled={disabled}
    />
  )
}

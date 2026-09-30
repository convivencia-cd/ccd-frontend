"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { DiocesisCombobox } from "@/components/diocesis-field"
import { PAISES } from "@/lib/geo/paises"
import { getSubdivisiones } from "@/lib/geo/subdivisiones"

export { PAISES }

interface GeorefProvincia {
  id: string
  nombre: string
}

interface GeorefLocalidad {
  id: string
  nombre: string
}

interface LocationFieldsProps {
  pais: string
  provincia: string
  localidad: string
  codigoPostal?: string
  diocesis?: string
  onPaisChange: (val: string) => void
  onProvinciaChange: (val: string) => void
  onLocalidadChange: (val: string) => void
  onCodigoPostalChange?: (val: string) => void
  onDiocesisChange?: (val: string) => void
  disabled?: boolean
  /** Marca los campos con " *" (solo visual; la validación la hace quien usa el componente). */
  required?: boolean
  paisLabel?: string
  provinciaLabel?: string
}

const GEOREF_BASE = "https://apis.datos.gob.ar/georef/api"

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function LocationFields({
  pais,
  provincia,
  localidad,
  codigoPostal,
  diocesis,
  onPaisChange,
  onProvinciaChange,
  onLocalidadChange,
  onCodigoPostalChange,
  onDiocesisChange,
  disabled,
  required = false,
  paisLabel = "País",
  provinciaLabel = "Provincia",
}: LocationFieldsProps) {
  const isArgentina = pais === "Argentina"
  const req = required ? " *" : ""

  // Provincias / estados del país seleccionado (Argentina se resuelve por API, más abajo).
  const subdivisiones = React.useMemo<ComboboxOption[] | null>(() => {
    if (isArgentina) return null
    const nombres = getSubdivisiones(pais)
    if (!nombres) return null
    const opts = nombres.map((n) => ({ label: n, value: n }))
    // Conserva un valor ya cargado que no figure en el listado.
    if (provincia && !opts.some((o) => o.value === provincia)) {
      opts.unshift({ label: provincia, value: provincia })
    }
    return opts
  }, [isArgentina, pais, provincia])

  // Province typeahead state
  const [provinciaQuery, setProvinciaQuery] = React.useState("")
  const [provincias, setProvincias] = React.useState<ComboboxOption[]>([])
  const [provinciasLoading, setProvinciasLoading] = React.useState(false)
  const debouncedProvinciaQuery = useDebounce(provinciaQuery, 300)

  // Localidad typeahead state
  const [localidadQuery, setLocalidadQuery] = React.useState("")
  const [localidades, setLocalidades] = React.useState<ComboboxOption[]>([])
  const [localidadesLoading, setLocalidadesLoading] = React.useState(false)
  const debouncedLocalidadQuery = useDebounce(localidadQuery, 300)

  // Fetch provinces when Argentina and query changes
  React.useEffect(() => {
    if (!isArgentina) return
    setProvinciasLoading(true)
    const params = new URLSearchParams({ max: "30", campos: "id,nombre" })
    if (debouncedProvinciaQuery) params.set("nombre", debouncedProvinciaQuery)
    fetch(`${GEOREF_BASE}/provincias?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const opts: ComboboxOption[] = (data.provincias ?? [])
          .map((p: GeorefProvincia) => ({
            label: p.nombre,
            value: p.nombre,
          }))
          .sort((a: ComboboxOption, b: ComboboxOption) => a.label.localeCompare(b.label, "es"))
        setProvincias(opts)
      })
      .catch(() => setProvincias([]))
      .finally(() => setProvinciasLoading(false))
  }, [isArgentina, debouncedProvinciaQuery])

  // Fetch localidades when Argentina, province selected, and query changes
  React.useEffect(() => {
    if (!isArgentina || !provincia) {
      setLocalidades([])
      return
    }
    setLocalidadesLoading(true)
    const params = new URLSearchParams({ provincia, max: "50", campos: "id,nombre" })
    if (debouncedLocalidadQuery) params.set("nombre", debouncedLocalidadQuery)
    fetch(`${GEOREF_BASE}/localidades?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const opts: ComboboxOption[] = (data.localidades ?? [])
          .map((l: GeorefLocalidad) => ({
            label: l.nombre,
            value: l.nombre,
          }))
          .sort((a: ComboboxOption, b: ComboboxOption) => a.label.localeCompare(b.label, "es"))
        setLocalidades(opts)
      })
      .catch(() => setLocalidades([]))
      .finally(() => setLocalidadesLoading(false))
  }, [isArgentina, provincia, debouncedLocalidadQuery])

  function handlePaisChange(val: string) {
    onPaisChange(val)
    // Reset downstream fields when country changes
    onProvinciaChange("")
    onLocalidadChange("")
    setProvinciaQuery("")
    setLocalidadQuery("")
  }

  function handleProvinciaChange(val: string) {
    onProvinciaChange(val)
    onLocalidadChange("")
    setLocalidadQuery("")
  }

  return (
    <div className="space-y-4">
      {/* País */}
      <div className="space-y-2">
        <Label>{paisLabel}{req}</Label>
        <Combobox
          value={pais}
          onSelect={handlePaisChange}
          options={PAISES}
          placeholder="Seleccionar país..."
          searchPlaceholder="Buscar país..."
          emptyText="País no encontrado."
          disabled={disabled}
        />
      </div>

      {/* Provincia */}
      <div className="space-y-2">
        <Label>{provinciaLabel}{req}</Label>
        {isArgentina ? (
          <Combobox
            value={provincia}
            onSelect={handleProvinciaChange}
            options={provincias}
            placeholder="Buscar provincia..."
            searchPlaceholder="Escribir para buscar..."
            emptyText="No se encontró la provincia."
            onSearch={setProvinciaQuery}
            loading={provinciasLoading}
            disabled={disabled}
          />
        ) : subdivisiones ? (
          <Combobox
            value={provincia}
            onSelect={handleProvinciaChange}
            options={subdivisiones}
            placeholder="Seleccionar provincia / estado..."
            searchPlaceholder="Escribir para buscar..."
            emptyText="No se encontró la provincia / estado."
            disabled={disabled}
          />
        ) : (
          <Input
            placeholder="Provincia / Estado"
            value={provincia}
            onChange={(e) => onProvinciaChange(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>

      {/* Ciudad + CP */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ciudad{req}</Label>
          {isArgentina ? (
            <Combobox
              value={localidad}
              onSelect={onLocalidadChange}
              options={localidades}
              placeholder={provincia ? "Buscar ciudad..." : "Seleccionar provincia primero"}
              searchPlaceholder="Escribir para buscar..."
              emptyText="No se encontró la ciudad."
              onSearch={setLocalidadQuery}
              loading={localidadesLoading}
              disabled={disabled || !provincia}
            />
          ) : (
            <Input
              placeholder="Ciudad"
              value={localidad}
              onChange={(e) => onLocalidadChange(e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
        {onCodigoPostalChange !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="codigo_postal">CP{req}</Label>
            <Input
              id="codigo_postal"
              name="codigo_postal"
              placeholder="3400"
              value={codigoPostal ?? ""}
              onChange={(e) => onCodigoPostalChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Diócesis */}
      {onDiocesisChange !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="diocesis">Diócesis{req}</Label>
          <DiocesisCombobox
            value={diocesis ?? ""}
            onChange={onDiocesisChange}
            pais={pais}
            provincia={provincia}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

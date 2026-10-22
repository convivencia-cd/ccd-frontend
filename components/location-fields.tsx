"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { DiocesisCombobox } from "@/components/diocesis-field"
import { PAISES } from "@/lib/geo/paises"
import { getSubdivisiones } from "@/lib/geo/subdivisiones"
import { buscarCodigoPostal } from "@/lib/geo/codigos-postales"

export { PAISES }

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

/** Cuántas ciudades se listan a la vez (Buenos Aires tiene ~900: pintarlas todas traba el popover). */
const MAX_LOCALIDADES = 50

/** Minúsculas y sin tildes, para que "cordoba" encuentre "Córdoba". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
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
  const req = required ? <span className="text-destructive"> *</span> : null

  // Provincias / estados del país seleccionado, del listado estático (para Argentina
  // son los mismos nombres oficiales que usa Georef para las localidades).
  const subdivisiones = React.useMemo<ComboboxOption[] | null>(() => {
    const nombres = getSubdivisiones(pais)
    if (!nombres) return null
    const opts = nombres.map((n) => ({ label: n, value: n }))
    // Conserva un valor ya cargado que no figure en el listado.
    if (provincia && !opts.some((o) => o.value === provincia)) {
      opts.unshift({ label: provincia, value: provincia })
    }
    return opts
  }, [pais, provincia])

  // Localidades de la provincia (Argentina). Se trae el listado completo una sola
  // vez y se filtra acá: la búsqueda por nombre de Georef no devuelve nada con
  // menos de 4 letras, y obligaba a tipear cuatro para ver resultados.
  const [localidadQuery, setLocalidadQuery] = React.useState("")
  const [todasLocalidades, setTodasLocalidades] = React.useState<string[]>([])
  const [localidadesLoading, setLocalidadesLoading] = React.useState(false)

  React.useEffect(() => {
    if (!isArgentina || !provincia) {
      setTodasLocalidades([])
      return
    }
    let cancelado = false
    setLocalidadesLoading(true)
    const params = new URLSearchParams({ provincia, max: "5000", campos: "id,nombre" })
    fetch(`${GEOREF_BASE}/localidades?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return
        const nombres = ((data.localidades ?? []) as GeorefLocalidad[]).map((l) => l.nombre)
        setTodasLocalidades(
          [...new Set(nombres)].sort((a, b) => a.localeCompare(b, "es"))
        )
      })
      .catch(() => {
        if (!cancelado) setTodasLocalidades([])
      })
      .finally(() => {
        if (!cancelado) setLocalidadesLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [isArgentina, provincia])

  // El Combobox delega la búsqueda (`onSearch`), así que el filtrado se hace acá:
  // primero las que empiezan con lo tipeado, después las que lo contienen.
  const localidades = React.useMemo<ComboboxOption[]>(() => {
    const q = normalizar(localidadQuery)
    const empiezan: string[] = []
    const contienen: string[] = []
    for (const nombre of todasLocalidades) {
      const n = normalizar(nombre)
      if (!q || n.startsWith(q)) empiezan.push(nombre)
      else if (n.includes(q)) contienen.push(nombre)
    }
    return [...empiezan, ...contienen]
      .slice(0, MAX_LOCALIDADES)
      .map((n) => ({ label: n, value: n }))
  }, [todasLocalidades, localidadQuery])

  // CP completado automáticamente (card #77). Si después cambia la ciudad y la
  // nueva no tiene CP conocido, se borra solo si nadie lo editó a mano.
  const [cpAutomatico, setCpAutomatico] = React.useState<string | null>(null)

  function limpiarCpAutomatico() {
    if (cpAutomatico !== null && codigoPostal === cpAutomatico) {
      onCodigoPostalChange?.("")
    }
    setCpAutomatico(null)
  }

  async function handleLocalidadChange(val: string) {
    onLocalidadChange(val)
    if (!onCodigoPostalChange) return
    const cp = val ? await buscarCodigoPostal(provincia, val) : null
    if (cp) {
      onCodigoPostalChange(cp)
      setCpAutomatico(cp)
    } else {
      limpiarCpAutomatico()
    }
  }

  function handlePaisChange(val: string) {
    onPaisChange(val)
    // Reset downstream fields when country changes
    onProvinciaChange("")
    onLocalidadChange("")
    setLocalidadQuery("")
    limpiarCpAutomatico()
  }

  function handleProvinciaChange(val: string) {
    onProvinciaChange(val)
    onLocalidadChange("")
    setLocalidadQuery("")
    limpiarCpAutomatico()
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
        {subdivisiones ? (
          <Combobox
            value={provincia}
            onSelect={handleProvinciaChange}
            options={subdivisiones}
            placeholder={isArgentina ? "Buscar provincia..." : "Seleccionar provincia / estado..."}
            searchPlaceholder="Escribir para buscar..."
            emptyText={isArgentina ? "No se encontró la provincia." : "No se encontró la provincia / estado."}
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
              onSelect={handleLocalidadChange}
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
            {cpAutomatico !== null && codigoPostal === cpAutomatico && (
              <p className="text-[11px] text-muted-foreground/70">
                CP sugerido · datos de{" "}
                <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="hover:underline">
                  GeoNames
                </a>
              </p>
            )}
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

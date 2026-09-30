"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { getSubdivisiones } from "@/lib/geo/subdivisiones"
import type { Ubicacion } from "@/lib/personas/ubicaciones"

type Ministerio = { id: string; nombre: string }
type Organizacion = { id: string; nombre: string; tipo: string }

/** Minúsculas y sin tildes, para comparar variantes de la misma provincia/localidad. */
function normalizar(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const GEOREF_BASE = "https://apis.datos.gob.ar/georef/api"
/** Tope de opciones renderizadas en el combobox de ciudad (el catálogo argentino son miles). */
const MAX_LOCALIDADES = 80

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Ordena alfabéticamente pero adelanta lo que empieza con el texto buscado. */
function ordenarPorRelevancia(valores: string[], query: string): string[] {
  const q = normalizar(query)
  return valores.sort((a, b) => {
    if (q) {
      const pa = normalizar(a).startsWith(q) ? 0 : 1
      const pb = normalizar(b).startsWith(q) ? 0 : 1
      if (pa !== pb) return pa - pb
    }
    return a.localeCompare(b, "es")
  })
}

const tipoLabel: Record<string, string> = {
  confraternidad: 'Confraternidad',
  fraternidad: 'Fraternidad',
}

type Props = {
  ministerios: Ministerio[]
  organizaciones: Organizacion[]
  ubicaciones: Ubicacion[]
  canManage: boolean
  defaults: {
    q: string
    estado: string
    estado_eclesial: string
    provincia: string
    localidad: string
    modo: string
    categoria: string
    convivente: string
    ministerio_id: string
    organizacion_id: string
  }
}

const selectClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
// Iguala la altura y el padding de los <select> vecinos (el Button del Combobox es h-9 px-4).
const comboboxClass = "h-[38px] border-border px-3 text-sm shadow-none"

export default function PersonasFilters({ ministerios, organizaciones, ubicaciones, canManage, defaults }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [provincia, setProvincia] = useState(defaults.provincia)
  const [localidad, setLocalidad] = useState(defaults.localidad)
  const [organizacionId, setOrganizacionId] = useState(defaults.organizacion_id)
  const [ministerioId, setMinisterioId] = useState(defaults.ministerio_id)

  const organizacionOptions = useMemo<ComboboxOption[]>(
    () => organizaciones.map((o) => ({ label: `${o.nombre} (${tipoLabel[o.tipo] ?? o.tipo})`, value: o.id })),
    [organizaciones]
  )
  const ministerioOptions = useMemo<ComboboxOption[]>(
    () => ministerios.map((m) => ({ label: m.nombre, value: m.id })),
    [ministerios]
  )

  // Países presentes entre las personas: definen qué catálogos de provincias se ofrecen.
  // Sin dato de país se asume Argentina, que es el caso por defecto de la comunidad.
  const paisesPresentes = useMemo(() => {
    const paises = new Set<string>(["Argentina"])
    for (const u of ubicaciones) {
      const pais = (u.pais ?? "").trim()
      if (pais) paises.add(pais)
    }
    return [...paises]
  }, [ubicaciones])

  // Se ofrece el catálogo completo de provincias, no solo las que tienen personas cargadas:
  // elegir una sin resultados es válido y el listado responde "No se encontraron personas".
  const provinciaOptions = useMemo<ComboboxOption[]>(() => {
    const vistas = new Map<string, string>()
    const agregar = (nombre: string) => {
      const key = normalizar(nombre)
      if (key && !vistas.has(key)) vistas.set(key, nombre)
    }
    for (const pais of paisesPresentes) {
      for (const nombre of getSubdivisiones(pais) ?? []) agregar(nombre)
    }
    // Valores realmente cargados que no figuran en el catálogo (variantes, países sin listado):
    // sin ellos esas personas quedarían fuera de alcance del filtro.
    for (const u of ubicaciones) agregar(u.provincia)
    // Conserva un valor que venga de la URL aunque ya no exista entre las personas visibles.
    if (defaults.provincia) agregar(defaults.provincia)
    return ordenarPorRelevancia([...vistas.values()], "").map((n) => ({ label: n, value: n }))
  }, [paisesPresentes, ubicaciones, defaults.provincia])

  // Ciudades: no hay catálogo estático, se consulta Georef igual que en los formularios de carga.
  const [localidadQuery, setLocalidadQuery] = useState("")
  const debouncedLocalidadQuery = useDebounce(localidadQuery, 300)
  const [georefLocalidades, setGeorefLocalidades] = useState<string[]>([])
  const [localidadesLoading, setLocalidadesLoading] = useState(false)

  /** Nombre oficial de Georef si la provincia elegida es argentina; si no, null. */
  const provinciaArgentina = useMemo(() => {
    if (!provincia) return null
    const key = normalizar(provincia)
    return (getSubdivisiones("Argentina") ?? []).find((p) => normalizar(p) === key) ?? null
  }, [provincia])

  useEffect(() => {
    const q = debouncedLocalidadQuery.trim()
    // Sin provincia argentina elegida la consulta abarca todo el país: hace falta algo escrito.
    if (!provinciaArgentina && q.length < 2) {
      setGeorefLocalidades([])
      setLocalidadesLoading(false)
      return
    }
    const params = new URLSearchParams({ max: "50", campos: "id,nombre" })
    if (provinciaArgentina) params.set("provincia", provinciaArgentina)
    if (q) params.set("nombre", q)

    let cancelado = false
    setLocalidadesLoading(true)
    fetch(`${GEOREF_BASE}/localidades?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return
        setGeorefLocalidades(
          ((data.localidades ?? []) as { nombre: string }[]).map((l) => l.nombre)
        )
      })
      .catch(() => {
        if (!cancelado) setGeorefLocalidades([])
      })
      .finally(() => {
        if (!cancelado) setLocalidadesLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [provinciaArgentina, debouncedLocalidadQuery])

  const localidadOptions = useMemo<ComboboxOption[]>(() => {
    // El Combobox delega la búsqueda (onSearch), así que el filtrado por texto se hace acá.
    const q = normalizar(localidadQuery)
    const provKey = normalizar(provincia)
    const vistas = new Map<string, string>()
    const agregar = (nombre: string) => {
      const key = normalizar(nombre)
      if (!key || vistas.has(key)) return
      if (q && !key.includes(q)) return
      vistas.set(key, nombre)
    }
    // Primero lo que está cargado entre las personas (acotado a la provincia elegida),
    // después el catálogo de Georef.
    for (const u of ubicaciones) {
      if (!u.localidad) continue
      if (provKey && normalizar(u.provincia) !== provKey) continue
      agregar(u.localidad)
    }
    for (const nombre of georefLocalidades) agregar(nombre)
    if (defaults.localidad) agregar(defaults.localidad)
    return ordenarPorRelevancia([...vistas.values()], localidadQuery)
      .slice(0, MAX_LOCALIDADES)
      .map((n) => ({ label: n, value: n }))
  }, [ubicaciones, provincia, georefLocalidades, localidadQuery, defaults.localidad])

  function handleProvinciaChange(val: string) {
    setProvincia(val)
    setLocalidadQuery("")
    if (!localidad || !val) return
    // Solo se descarta la ciudad si está cargada entre las personas y pertenece a otra
    // provincia; si vino del catálogo no hay con qué contrastarla y se conserva.
    const cargada = ubicaciones.filter(
      (u) => u.localidad && normalizar(u.localidad) === normalizar(localidad)
    )
    if (cargada.length === 0) return
    if (!cargada.some((u) => normalizar(u.provincia) === normalizar(val))) setLocalidad("")
  }

  function handleClear() {
    setProvincia("")
    setLocalidad("")
    setLocalidadQuery("")
    setOrganizacionId("")
    setMinisterioId("")
    router.push("/personas")
  }

  const hasActiveFilters =
    Object.values(defaults).some((v) => v !== "") ||
    provincia !== "" ||
    localidad !== "" ||
    organizacionId !== "" ||
    ministerioId !== ""

  return (
    <form ref={formRef} method="GET" className="space-y-3">
      {/* Búsqueda — fila completa */}
      <div className="relative">
        <input
          name="q"
          defaultValue={defaults.q}
          placeholder="Buscar por nombre, apellido, apodo o email..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Grid de filtros */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {canManage && (
          <select name="estado" defaultValue={defaults.estado} className={selectClass}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        )}

        <select name="categoria" defaultValue={defaults.categoria} className={selectClass}>
          <option value="">Categoría</option>
          <option value="cecista">Cecista</option>
          <option value="no_cecista">No cecista</option>
          <option value="otro">Otro</option>
        </select>

        <select name="convivente" defaultValue={defaults.convivente} className={selectClass}>
          <option value="">Convivente</option>
          <option value="si">Convivente: sí</option>
          <option value="no">Convivente: no</option>
        </select>

        <select name="modo" defaultValue={defaults.modo} className={selectClass}>
          <option value="">Modo de participación</option>
          <option value="colaborador">Colaborador</option>
          <option value="servidor">Servidor</option>
          <option value="asesor">Asesor</option>
          <option value="familiar">Familiar</option>
          <option value="orante">Orante</option>
          <option value="intercesor">Intercesor</option>
        </select>

        {canManage && (
          <select name="estado_eclesial" defaultValue={defaults.estado_eclesial} className={selectClass}>
            <option value="">Estado eclesiástico</option>
            <option value="laico">Laico</option>
            <option value="religioso">Religioso/a</option>
            <option value="diacono">Diácono</option>
            <option value="sacerdote">Sacerdote</option>
            <option value="obispo">Obispo</option>
            <option value="cardenal">Cardenal</option>
          </select>
        )}

        <div>
          <input type="hidden" name="provincia" value={provincia} />
          <Combobox
            value={provincia}
            onSelect={handleProvinciaChange}
            options={provinciaOptions}
            placeholder="Provincia"
            searchPlaceholder="Buscar provincia..."
            emptyText="Sin resultados."
            className={comboboxClass}
          />
        </div>

        <div>
          <input type="hidden" name="localidad" value={localidad} />
          <Combobox
            value={localidad}
            onSelect={setLocalidad}
            options={localidadOptions}
            placeholder="Ciudad / Localidad"
            searchPlaceholder="Buscar ciudad..."
            emptyText={
              !provinciaArgentina && localidadQuery.trim().length < 2
                ? "Escribí al menos 2 letras para buscar."
                : "Sin resultados."
            }
            onSearch={setLocalidadQuery}
            // Solo se tapa la lista con "Cargando..." si todavía no hay nada que mostrar.
            loading={localidadesLoading && localidadOptions.length === 0}
            className={comboboxClass}
          />
        </div>

        {organizaciones.length > 0 && (
          <div>
            <input type="hidden" name="organizacion_id" value={organizacionId} />
            <Combobox
              value={organizacionId}
              onSelect={setOrganizacionId}
              options={organizacionOptions}
              placeholder="Confraternidad / Fraternidad"
              searchPlaceholder="Buscar organización..."
              emptyText="Sin resultados."
              className={comboboxClass}
            />
          </div>
        )}

        {canManage && ministerios.length > 0 && (
          <div>
            <input type="hidden" name="ministerio_id" value={ministerioId} />
            <Combobox
              value={ministerioId}
              onSelect={setMinisterioId}
              options={ministerioOptions}
              placeholder="Rol asignado"
              searchPlaceholder="Buscar rol..."
              emptyText="Sin resultados."
              className={comboboxClass}
            />
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-end gap-2">
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
      </div>
    </form>
  )
}

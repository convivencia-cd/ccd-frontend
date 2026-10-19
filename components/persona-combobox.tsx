"use client"

import * as React from "react"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { createClient } from "@/lib/supabase/client"
import { apellidoNombreConApodo } from "@/lib/personas/nombre"

export interface PersonaOption {
  id: string
  nombre: string
  apellido: string
  apodo: string | null
  email: string | null
}

/** PostgREST corta en 1000 filas por request: se pagina hasta traer el padrón completo. */
const TAMANO_PAGINA = 1000
const MAX_PAGINAS = 20
/** Cuántas coincidencias se listan a la vez (con ~2000 personas, pintarlas todas traba el popover). */
const MAX_OPCIONES = 50

/** Minúsculas y sin tildes, para que "zuniga" encuentre "Zuñiga". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function etiquetaPersona(p: PersonaOption): string {
  return `${apellidoNombreConApodo(p)}${p.email ? ` — ${p.email}` : ""}`
}

/** Trae todas las personas activas, en páginas de 1000 (el corte de PostgREST). */
export async function fetchPersonas(): Promise<PersonaOption[]> {
  const supabase = createClient()
  const todas: PersonaOption[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * TAMANO_PAGINA
    const { data, error } = await supabase
      .from("personas")
      .select("id, nombre, apellido, apodo, email")
      .is("fecha_baja", null)
      .order("apellido")
      .order("nombre")
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) {
      console.error("Error cargando personas:", error)
      break
    }
    const filas = (data ?? []) as PersonaOption[]
    todas.push(...filas)
    if (filas.length < TAMANO_PAGINA) break
  }
  return todas
}

interface PersonaComboboxProps {
  value: string
  onChange: (personaId: string) => void
  /** Si la página ya cargó las personas, se pasan acá para no repetir la consulta. */
  personas?: PersonaOption[]
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Selector de persona con búsqueda. Reemplaza al `<select>` nativo, que además de
 * ser incómodo con miles de opciones mostraba solo las primeras 1000 filas
 * (el listado se cortaba en la letra L).
 */
export function PersonaCombobox({
  value,
  onChange,
  personas: personasProp,
  id,
  placeholder = "Selecciona una persona...",
  disabled,
  className,
}: PersonaComboboxProps) {
  const [personasPropias, setPersonasPropias] = React.useState<PersonaOption[]>([])
  const [cargando, setCargando] = React.useState(!personasProp)
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    if (personasProp) return
    let cancelado = false
    fetchPersonas().then((filas) => {
      if (cancelado) return
      setPersonasPropias(filas)
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [personasProp])

  const personas = personasProp ?? personasPropias

  // El Combobox delega la búsqueda (`onSearch`), así que el filtrado se hace acá:
  // por tokens, sin tildes y contra apellido, nombre y email a la vez.
  const opciones = React.useMemo<ComboboxOption[]>(() => {
    const tokens = normalizar(query).split(/\s+/).filter(Boolean)
    const coincidencias: { persona: PersonaOption; puntaje: number }[] = []
    for (const p of personas) {
      const campos = [p.apellido, p.nombre, p.apodo ?? "", p.email ?? ""].map(normalizar)
      if (tokens.length > 0 && !tokens.every((t) => campos.some((c) => c.includes(t)))) continue
      // Los que empiezan con lo tipeado van primero.
      const puntaje =
        tokens.length === 0 || tokens.every((t) => campos.some((c) => c.startsWith(t))) ? 0 : 1
      coincidencias.push({ persona: p, puntaje })
    }
    coincidencias.sort((a, b) => a.puntaje - b.puntaje)
    const elegidas = coincidencias.slice(0, MAX_OPCIONES).map((c) => c.persona)
    // La persona ya seleccionada tiene que seguir en la lista aunque no matchee la búsqueda,
    // si no el trigger perdería la etiqueta al reabrir el popover.
    if (value && !elegidas.some((p) => p.id === value)) {
      const seleccionada = personas.find((p) => p.id === value)
      if (seleccionada) elegidas.unshift(seleccionada)
    }
    return elegidas.map((p) => ({ label: etiquetaPersona(p), value: p.id }))
  }, [personas, query, value])

  return (
    <Combobox
      id={id}
      value={value}
      onSelect={onChange}
      options={opciones}
      onSearch={setQuery}
      loading={cargando}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      searchPlaceholder="Buscar por nombre, apellido, apodo o email..."
      emptyText="No se encontraron personas."
    />
  )
}

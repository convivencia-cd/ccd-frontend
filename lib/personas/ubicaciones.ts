import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Trío país + provincia + localidad presente entre las personas activas. */
export type Ubicacion = { pais: string | null; provincia: string; localidad: string | null }

export type UbicacionesCargadas = {
  /** Combinaciones deduplicadas, para alimentar los combobox del filtro. */
  ubicaciones: Ubicacion[]
  /** Normalizado → valores tal cual están guardados (variantes de tildes/mayúsculas/espacios). */
  variantesProvincia: Record<string, string[]>
  variantesLocalidad: Record<string, string[]>
  variantesPais: Record<string, string[]>
}

/** País que se asume cuando la persona no lo tiene cargado (igual que el filtro de provincias). */
export const PAIS_POR_DEFECTO = 'Argentina'

/**
 * Condición `or` de PostgREST para el filtro de país (card #91): las variantes
 * guardadas del país elegido y, si es Argentina, también quienes no tienen país
 * cargado. `null` si nadie lo tiene cargado y no es Argentina (cero resultados).
 */
export function filtroPais(pais: string, variantesPais: Record<string, string[]>): string | null {
  const variantes = variantesDe(pais, variantesPais).map(v => `"${v.replace(/"/g, '')}"`)
  const partes: string[] = []
  if (variantes.length) partes.push(`pais.in.(${variantes.join(',')})`)
  if (normalizarUbicacion(pais) === normalizarUbicacion(PAIS_POR_DEFECTO)) partes.push('pais.is.null', 'pais.eq.')
  return partes.length ? partes.join(',') : null
}

/** Normaliza a minúsculas sin tildes, para deduplicar variantes de la misma provincia/localidad. */
export function normalizarUbicacion(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/**
 * Ubicaciones cargadas entre las personas activas (RLS aplica acá también).
 *
 * Los combobox del filtro ofrecen el catálogo completo (provincias de `lib/geo/subdivisiones`,
 * localidades de Georef), así que esto cumple dos funciones: sumar los valores realmente
 * cargados que no figuran en el catálogo, y registrar cómo está escrito cada uno en la base
 * para poder filtrar aunque el usuario elija la variante canónica ("Córdoba" vs "Cordoba").
 */
export async function fetchUbicaciones(supabase: SupabaseServerClient): Promise<UbicacionesCargadas> {
  const CHUNK = 1000
  const MAX_CHUNKS = 20
  const vistos = new Set<string>()
  const ubicaciones: Ubicacion[] = []
  const variantesProvincia: Record<string, string[]> = {}
  const variantesLocalidad: Record<string, string[]> = {}
  const variantesPais: Record<string, string[]> = {}

  const registrarVariante = (destino: Record<string, string[]>, valor: string | null) => {
    if (valor === null || valor === '') return
    const key = normalizarUbicacion(valor)
    if (!key) return
    const lista = destino[key] ?? (destino[key] = [])
    if (!lista.includes(valor)) lista.push(valor)
  }

  for (let i = 0; i < MAX_CHUNKS; i++) {
    const { data, error } = await supabase
      .from('personas')
      .select('pais, provincia, localidad')
      .is('fecha_baja', null)
      .order('id')
      .range(i * CHUNK, i * CHUNK + CHUNK - 1)

    if (error || !data) break

    for (const row of data) {
      // Las variantes se guardan sin recortar: son el valor exacto contra el que se consulta.
      registrarVariante(variantesProvincia, row.provincia)
      registrarVariante(variantesLocalidad, row.localidad)
      registrarVariante(variantesPais, row.pais)

      const pais = (row.pais ?? '').trim()
      const prov = (row.provincia ?? '').trim()
      const loc = (row.localidad ?? '').trim()
      const key = `${normalizarUbicacion(pais)}|${normalizarUbicacion(prov)}|${normalizarUbicacion(loc)}`
      if (vistos.has(key)) continue
      vistos.add(key)
      ubicaciones.push({ pais: pais || null, provincia: prov, localidad: loc || null })
    }

    if (data.length < CHUNK) break
  }

  return { ubicaciones, variantesProvincia, variantesLocalidad, variantesPais }
}

/**
 * Valores guardados equivalentes al elegido en el filtro. Vacío si nadie tiene esa
 * provincia/localidad cargada (el listado debe devolver cero resultados, no todos).
 */
export function variantesDe(valor: string, variantes: Record<string, string[]>): string[] {
  return variantes[normalizarUbicacion(valor)] ?? []
}

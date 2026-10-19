/**
 * Búsqueda de personas por "nombre completo" (nombre + apellido + apodo + email).
 *
 * Antes cada campo se comparaba contra el texto entero, así que "Diego Pascualini"
 * no encontraba a nadie: ningún campo contiene las dos palabras juntas. Ahora el
 * texto se parte en palabras y cada una tiene que aparecer en ALGÚN campo, sin
 * importar el orden ("Pascualini Diego" o "Pascualini, Diego" también matchean).
 */

const CAMPOS_PERSONA = ["nombre", "apellido", "apodo", "email"] as const

/**
 * Palabras de la búsqueda. Se descartan los caracteres que rompen la sintaxis de
 * filtros de PostgREST (`,` `(` `)` y comillas) y los comodines de ilike (`%` `_` `*`).
 */
export function tokensBusqueda(q: string): string[] {
  return q
    .replace(/[(),"'\\%_*]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Filtro para `.or()` de supabase-js: todas las palabras tienen que estar, cada una
 * en cualquiera de los campos. Devuelve `null` si la búsqueda queda vacía.
 */
export function filtroBusquedaPersonas(
  q: string,
  campos: readonly string[] = CAMPOS_PERSONA,
): string | null {
  const tokens = tokensBusqueda(q)
  if (tokens.length === 0) return null
  const porToken = tokens.map((t) => campos.map((c) => `${c}.ilike.%${t}%`).join(","))
  if (porToken.length === 1) return porToken[0]
  return `and(${porToken.map((f) => `or(${f})`).join(",")})`
}

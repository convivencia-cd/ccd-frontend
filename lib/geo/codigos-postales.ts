// Código postal por localidad argentina (card #77), a partir de los datos que
// genera scripts/generar_codigos_postales.mjs en lib/geo/cp-ar/.
// No hay CP para todas las ciudades de Georef (~70%; CABA no figura), así que
// el resultado es una sugerencia: el campo CP sigue siendo editable.

import { CARGAR_CP_PROVINCIA } from "./cp-ar"

/** Sin tildes, minúsculas, sin espacios ni signos y sin lo que va entre paréntesis. */
export function claveGeo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*$/, "")
    .replace(/[^a-z0-9]/g, "")
}

/** Georef usa el nombre largo; GeoNames, "Tierra del Fuego". */
function claveProvincia(provincia: string): string {
  const clave = claveGeo(provincia)
  return clave.startsWith("tierradelfuego") ? "tierradelfuego" : clave
}

const cache = new Map<string, Promise<Record<string, string>>>()

/** CP de la localidad, o null si no se conoce (o tiene más de uno). */
export async function buscarCodigoPostal(provincia: string, localidad: string): Promise<string | null> {
  const clave = claveProvincia(provincia)
  const cargar = CARGAR_CP_PROVINCIA[clave]
  if (!cargar || !localidad) return null
  if (!cache.has(clave)) {
    cache.set(clave, cargar().then((m) => m.default).catch(() => {
      cache.delete(clave)
      return {}
    }))
  }
  const cps = await cache.get(clave)!
  return cps[claveGeo(localidad)] ?? null
}

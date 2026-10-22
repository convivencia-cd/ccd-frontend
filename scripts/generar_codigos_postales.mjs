// Genera lib/geo/cp-ar/ (card #77): código postal por localidad argentina, un
// JSON por provincia, para completar el CP al elegir la ciudad.
//
// Fuente: listado de códigos postales de GeoNames (https://www.geonames.org),
// licencia CC BY 4.0. Se descarga una sola vez; la app no le consulta nada.
//
// - Clave de cada localidad = nombre sin tildes, minúsculas, sin espacios ni
//   signos y sin lo que va entre paréntesis (misma regla que `claveGeo` en
//   lib/geo/codigos-postales.ts — si cambia una, cambiar la otra).
// - Las localidades con más de un CP dentro de la provincia se descartan, para
//   no completar uno equivocado.
// - CABA no figura en GeoNames: sus barrios quedan sin CP automático.
//
// Uso:
//   curl -LO https://download.geonames.org/export/zip/AR.zip && unzip AR.zip AR.txt
//   node scripts/generar_codigos_postales.mjs ruta/a/AR.txt

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const origen = process.argv[2]
if (!origen) {
  console.error('Uso: node scripts/generar_codigos_postales.mjs ruta/a/AR.txt')
  process.exit(1)
}

const claveGeo = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*$/, '')
    .replace(/[^a-z0-9]/g, '')

// provincia -> localidad -> CPs encontrados
const provincias = new Map()
for (const linea of readFileSync(origen, 'utf8').split('\n')) {
  const [, cp, localidad, provincia] = linea.split('\t')
  if (!cp || !localidad || !provincia) continue
  const prov = claveGeo(provincia)
  const loc = claveGeo(localidad)
  if (!loc) continue
  if (!provincias.has(prov)) provincias.set(prov, new Map())
  const locs = provincias.get(prov)
  if (!locs.has(loc)) locs.set(loc, new Set())
  locs.get(loc).add(cp.trim())
}

const destino = new URL('../lib/geo/cp-ar/', import.meta.url)
rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })

const claves = [...provincias.keys()].sort()
let total = 0
for (const prov of claves) {
  const unicos = Object.fromEntries(
    [...provincias.get(prov)]
      .filter(([, cps]) => cps.size === 1)
      .map(([loc, cps]) => [loc, [...cps][0]])
      .sort(([a], [b]) => a.localeCompare(b))
  )
  total += Object.keys(unicos).length
  writeFileSync(new URL(`${prov}.json`, destino), JSON.stringify(unicos))
}

// Un import fijo por provincia: el bundler separa cada JSON y solo se descarga
// el de la provincia elegida.
writeFileSync(
  new URL('index.ts', destino),
  `// Generado por scripts/generar_codigos_postales.mjs — no editar a mano.
// Datos: GeoNames (https://www.geonames.org), CC BY 4.0.

export const CARGAR_CP_PROVINCIA: Record<string, () => Promise<{ default: Record<string, string> }>> = {
${claves.map((p) => `  ${p}: () => import('./${p}.json'),`).join('\n')}
}
`
)

console.log(`${claves.length} provincias, ${total} localidades con CP único.`)

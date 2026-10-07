// Checklist de "Convivencias, Retiros y Talleres realizados" (tabla
// persona_eventos_realizados, migración 050). Lo comparten el perfil del
// cecista (/settings) y el formulario público de inscripción (/pago/[id]),
// para que los dos ofrezcan la misma lista en el mismo orden.

export type TipoEventoRealizable = { id: string; nombre: string }

// Tipos de evento elegibles para el checklist de "realizados" (excluye
// encuentro y otro, tal cual el relevamiento de Cecistas).
export const EVENTOS_REALIZADOS_CATEGORIAS = ['convivencia', 'retiro', 'taller']

// Retiros por ministerio/estado — no son hitos del itinerario, así que quedan
// fuera del checklist autodeclarado. Se filtran por nombre (no por código)
// porque `tipos_eventos.codigo` recién lo agrega scripts/046.
const EVENTOS_REALIZADOS_EXCLUIDOS = [
  'retiro de asesores',
  'retiro de casas comunitarias',
  'retiro de dedicados confraternidades',
]

// Los 7 primeros casilleros son el itinerario de convivencias, en este orden.
const CONVIVENCIAS_ORDEN = [
  'convivencia con cristo',
  'convivencia con pablo',
  'convivencia con pedro',
  'convivencia con maria',
  'convivencia con el espiritu',
  'convivencia trinidad',
  'convivencia dios amor',
]

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// El catálogo guarda las convivencias en MAYÚSCULA; acá se muestran en formato
// título para que la lista se lea bien.
const PALABRAS_MINUSCULA = new Set(['con', 'de', 'del', 'el', 'la', 'los', 'las', 'y', 'en', 'a'])
export function nombreLegible(nombre: string) {
  if (/[a-záéíóúüñ]/.test(nombre)) return nombre
  return nombre
    .toLocaleLowerCase('es')
    .split(' ')
    .map((w, i) => (i > 0 && PALABRAS_MINUSCULA.has(w) ? w : w.charAt(0).toLocaleUpperCase('es') + w.slice(1)))
    .join(' ')
}

// Convivencias primero (orden fijo del itinerario), luego retiros y talleres
// alfabéticamente.
export function ordenarTiposEventos<T extends TipoEventoRealizable>(rows: T[]): T[] {
  return rows
    .filter(t => !EVENTOS_REALIZADOS_EXCLUIDOS.includes(normalizar(t.nombre)))
    .sort((a, b) => {
      const ia = CONVIVENCIAS_ORDEN.indexOf(normalizar(a.nombre))
      const ib = CONVIVENCIAS_ORDEN.indexOf(normalizar(b.nombre))
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return nombreLegible(a.nombre).localeCompare(nombreLegible(b.nombre), 'es')
    })
}

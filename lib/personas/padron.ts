/**
 * Filtros de /personas (y su export) sobre los dos ejes que se acordaron con
 * Ángeles (migración 082):
 *
 *   - Categoría: cecista / no cecista / otro  (`personas.tipo_persona`)
 *   - Convivente: sí / no                     (`personas.es_convivente`)
 *
 * El listado siempre se limita a `en_padron = true`: los no cecistas sin el
 * tilde de convivente son interesados que nunca asistieron y viven en /interesados.
 */

export const CATEGORIAS_PERSONA = ['cecista', 'no_cecista', 'otro'] as const
export type CategoriaPersona = (typeof CATEGORIAS_PERSONA)[number]

export type FiltrosPadron = {
  categoria: CategoriaPersona | ''
  convivente: 'si' | 'no' | ''
  /** Modo institucional (persona_modos), ya sin los valores viejos que eran categorías. */
  modo: string
}

export function leerFiltrosPadron(params: {
  categoria?: string | null
  convivente?: string | null
  modo?: string | null
}): FiltrosPadron {
  let categoria: FiltrosPadron['categoria'] = (CATEGORIAS_PERSONA as readonly string[]).includes(params.categoria ?? '')
    ? (params.categoria as CategoriaPersona)
    : ''
  let modo = params.modo ?? ''

  // Antes "Convivente" y "Otro" venían mezclados en el filtro de modo (y
  // "Convivente" en realidad traía a los no cecistas). Se respetan los links viejos.
  if (modo === 'convivente') {
    categoria = categoria || 'no_cecista'
    modo = ''
  } else if (modo === 'otro') {
    categoria = categoria || 'otro'
    modo = ''
  }

  const convivente = params.convivente === 'si' || params.convivente === 'no' ? params.convivente : ''

  return { categoria, convivente, modo }
}

// Tipado mínimo del query builder de Supabase que usan /personas y el export.
type FiltrableQuery<Q> = {
  eq(column: string, value: unknown): Q
}

export function aplicarFiltrosPadron<Q extends FiltrableQuery<Q>>(query: Q, filtros: FiltrosPadron): Q {
  let q = query.eq('en_padron', true)
  if (filtros.categoria) q = q.eq('tipo_persona', filtros.categoria)
  if (filtros.convivente) q = q.eq('es_convivente', filtros.convivente === 'si')
  return q
}

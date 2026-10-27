import { randomBytes, timingSafeEqual } from 'crypto'

/**
 * Protección CSRF del OAuth de Mercado Pago. El `state` que viaja a MP es un
 * valor al azar; la cookie (httpOnly, 10 min) guarda ese valor + la
 * organización. Sin esto, un link armado con el `code` de otra cuenta de MP
 * conectaría esa cuenta a la organización de quien lo abra.
 */
export const MP_OAUTH_COOKIE = 'mp_oauth_state'
export const MP_OAUTH_COOKIE_PATH = '/api/mercadopago/oauth'
export const MP_OAUTH_MAX_AGE_S = 10 * 60

export function nuevoStateOauth(organizacionId: string) {
  const nonce = randomBytes(24).toString('hex')
  return { state: nonce, cookie: `${nonce}.${organizacionId}` }
}

/** Devuelve la organización si el `state` coincide con la cookie; si no, null. */
export function validarStateOauth(state: string | null, cookie: string | undefined): string | null {
  if (!state || !cookie) return null
  const punto = cookie.indexOf('.')
  if (punto <= 0) return null

  const nonce = cookie.slice(0, punto)
  const organizacionId = cookie.slice(punto + 1)
  const a = Buffer.from(nonce)
  const b = Buffer.from(state)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return organizacionId || null
}

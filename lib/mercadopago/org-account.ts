import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, OAuth } from 'mercadopago'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function oauthClient() {
  // El accessToken de este config no se usa: los métodos de OAuth se autentican
  // con client_id/client_secret en el body de cada request.
  const config = new MercadoPagoConfig({ accessToken: process.env.MP_CLIENT_SECRET! })
  return new OAuth(config)
}

type CuentaMp = {
  organizacion_id: string
  access_token: string
  refresh_token: string
  token_expira_en: string
}

/**
 * Devuelve un access_token vigente para la organización, refrescándolo si está
 * por vencer. Mercado Pago rota el refresh_token en cada uso, por eso se
 * persiste siempre el par nuevo antes de devolver el token.
 */
export async function obtenerAccessTokenVigente(organizacionId: string): Promise<string | null> {
  const supabase = supabaseAdmin()
  const { data: cuenta } = await supabase
    .from('organizacion_mercadopago')
    .select('organizacion_id, access_token, refresh_token, token_expira_en')
    .eq('organizacion_id', organizacionId)
    .maybeSingle<CuentaMp>()

  if (!cuenta) return null

  const vence = new Date(cuenta.token_expira_en).getTime()
  const margenMs = 10 * 60 * 1000
  if (vence - Date.now() > margenMs) {
    return cuenta.access_token
  }

  const result = await oauthClient().refresh({
    body: {
      client_id: process.env.MP_CLIENT_ID!,
      client_secret: process.env.MP_CLIENT_SECRET!,
      refresh_token: cuenta.refresh_token,
    },
  })

  if (!result.access_token || !result.refresh_token || !result.expires_in) {
    return cuenta.access_token // el refresh falló, se intenta con el token actual
  }

  const nuevoVencimiento = new Date(Date.now() + result.expires_in * 1000).toISOString()
  await supabase
    .from('organizacion_mercadopago')
    .update({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      token_expira_en: nuevoVencimiento,
      updated_at: new Date().toISOString(),
    })
    .eq('organizacion_id', organizacionId)

  return result.access_token
}

/**
 * Resuelve qué organización cobra la PENSIÓN de un evento: se prefiere la
 * cuenta de la Fraternidad; si no está conectada, se usa la de la
 * Confraternidad. Las inscripciones NO usan esto: se cobran siempre en la
 * cuenta central (ver `resolverCuentaCobroCentral`).
 */
export async function resolverCuentaEvento(
  organizacionId: string | null,
  fraternidadId: string | null
): Promise<{ organizacionId: string; accessToken: string } | null> {
  const supabase = supabaseAdmin()
  const ids = [fraternidadId, organizacionId].filter((v): v is string => !!v)
  if (ids.length === 0) return null

  const { data: cuentas } = await supabase
    .from('organizacion_mercadopago')
    .select('organizacion_id')
    .in('organizacion_id', ids)

  const conectadas = new Set((cuentas ?? []).map((c) => c.organizacion_id as string))

  const elegido = ids.find((id) => conectadas.has(id))
  if (!elegido) return null

  const accessToken = await obtenerAccessTokenVigente(elegido)
  if (!accessToken) return null

  return { organizacionId: elegido, accessToken }
}

// ────────────────────────────────────────────────────────────────────────────
// Cobro centralizado de inscripciones
//
// Todas las inscripciones se cobran en la cuenta de Mercado Pago de la
// organización de tipo `comunidad` con código EQT, sin importar qué
// confraternidad/fraternidad organice el evento. (La pensión sigue
// resolviéndose por organización — ver `resolverCuentaEvento`.)
// ────────────────────────────────────────────────────────────────────────────

const CODIGO_ORG_COBRO = 'EQT'

let orgCobroIdCache: string | null = null

/**
 * Id de la organización que centraliza el cobro de inscripciones. Se cachea en
 * memoria del proceso: el código es fijo y la fila no cambia de id.
 */
export async function obtenerOrgCobroId(): Promise<string | null> {
  if (orgCobroIdCache) return orgCobroIdCache

  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('organizaciones')
    .select('id')
    .eq('tipo', 'comunidad')
    .ilike('codigo', CODIGO_ORG_COBRO)
    .maybeSingle<{ id: string }>()

  if (!data) {
    console.error(
      `[mercadopago] No existe la organización de cobro (tipo=comunidad, codigo=${CODIGO_ORG_COBRO}).`
    )
    return null
  }

  orgCobroIdCache = data.id
  return data.id
}

/**
 * Chequeo liviano (sin refrescar tokens) de que la cuenta de cobro central
 * está conectada. Se usa en la landing pública, que se renderiza en cada visita.
 */
export async function hayCuentaCobroCentral(): Promise<boolean> {
  const orgId = await obtenerOrgCobroId()
  if (!orgId) return false

  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('organizacion_mercadopago')
    .select('organizacion_id')
    .eq('organizacion_id', orgId)
    .maybeSingle()

  return !!data
}

export type DatosTransferenciaCentral = {
  alias: string
  cbu: string | null
  titular: string | null
  banco: string | null
  instrucciones: string | null
}

/**
 * Datos bancarios (alias/CBU) de la organización que centraliza el cobro, para
 * las inscripciones por transferencia. Mismo criterio que Mercado Pago: sin
 * fallback a la fraternidad/confraternidad del evento. Devuelve null si la
 * organización de cobro no tiene alias cargado.
 */
export async function obtenerDatosTransferenciaCentral(): Promise<DatosTransferenciaCentral | null> {
  const orgId = await obtenerOrgCobroId()
  if (!orgId) return null

  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('organizaciones')
    .select('pago_alias, pago_cbu, pago_titular, pago_banco, pago_instrucciones')
    .eq('id', orgId)
    .maybeSingle()

  if (!data?.pago_alias) return null

  return {
    alias: data.pago_alias,
    cbu: data.pago_cbu ?? null,
    titular: data.pago_titular ?? null,
    banco: data.pago_banco ?? null,
    instrucciones: data.pago_instrucciones ?? null,
  }
}

/**
 * Cuenta que cobra todas las inscripciones, con un access_token vigente.
 */
export async function resolverCuentaCobroCentral(): Promise<
  { organizacionId: string; accessToken: string } | null
> {
  const orgId = await obtenerOrgCobroId()
  if (!orgId) return null

  const accessToken = await obtenerAccessTokenVigente(orgId)
  if (!accessToken) return null

  return { organizacionId: orgId, accessToken }
}

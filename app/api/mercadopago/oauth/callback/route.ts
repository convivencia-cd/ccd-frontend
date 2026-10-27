import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { MercadoPagoConfig, OAuth } from 'mercadopago'
import { getPublicOrigin } from '@/lib/http'
import { MP_OAUTH_COOKIE, MP_OAUTH_COOKIE_PATH, validarStateOauth } from '@/lib/mercadopago/oauth-state'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = getPublicOrigin(request)
  const code = url.searchParams.get('code')

  // La organización sale de la cookie que puso /conectar, no de la URL: así
  // solo se completa un flujo que arrancó este mismo navegador.
  const cookieStore = await cookies()
  const organizacionId = validarStateOauth(
    url.searchParams.get('state'),
    cookieStore.get(MP_OAUTH_COOKIE)?.value
  )

  const responder = (res: NextResponse) => {
    res.cookies.set(MP_OAUTH_COOKIE, '', { path: MP_OAUTH_COOKIE_PATH, maxAge: 0 })
    return res
  }

  if (!code || !organizacionId) {
    return responder(
      NextResponse.json(
        { error: 'La conexión con Mercado Pago venció o no es válida. Volvé a intentarlo desde la organización.' },
        { status: 400 }
      )
    )
  }

  const ctx = await getUserContext()
  if (!ctx || !canPerform(ctx, 'organization.update', organizacionId)) {
    return responder(
      NextResponse.json({ error: 'No tenés permiso para conectar Mercado Pago en esta organización' }, { status: 403 })
    )
  }

  const volver = (estado: 'conectado' | 'error') =>
    responder(NextResponse.redirect(`${origin}/organizaciones/${organizacionId}/editar?mp=${estado}`))

  const config = new MercadoPagoConfig({ accessToken: process.env.MP_CLIENT_SECRET! })
  const oauth = new OAuth(config)

  let result
  try {
    result = await oauth.create({
      body: {
        client_id: process.env.MP_CLIENT_ID!,
        client_secret: process.env.MP_CLIENT_SECRET!,
        code,
        redirect_uri: `${origin}/api/mercadopago/oauth/callback`,
      },
    })
  } catch (err) {
    console.error('[mercadopago/oauth/callback] oauth.create failed:', err)
    return volver('error')
  }

  if (!result.access_token || !result.refresh_token || !result.user_id || !result.expires_in) {
    console.error('[mercadopago/oauth/callback] incomplete OAuth response')
    return volver('error')
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const tokenExpiraEn = new Date(Date.now() + result.expires_in * 1000).toISOString()

  const { error } = await supabaseAdmin.from('organizacion_mercadopago').upsert({
    organizacion_id: organizacionId,
    mp_user_id: result.user_id,
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    public_key: result.public_key ?? null,
    token_expira_en: tokenExpiraEn,
    conectado_por: ctx.persona_id,
    conectado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[mercadopago/oauth/callback] no se pudo guardar la cuenta:', error)
    return volver('error')
  }

  return volver('conectado')
}

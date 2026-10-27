import { NextResponse } from 'next/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { MercadoPagoConfig, OAuth } from 'mercadopago'
import { getPublicOrigin } from '@/lib/http'
import {
  MP_OAUTH_COOKIE,
  MP_OAUTH_COOKIE_PATH,
  MP_OAUTH_MAX_AGE_S,
  nuevoStateOauth,
} from '@/lib/mercadopago/oauth-state'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()

  if (!ctx || !canPerform(ctx, 'organization.update', id)) {
    return NextResponse.json({ error: 'No tenés permiso para conectar Mercado Pago en esta organización' }, { status: 403 })
  }

  const origin = getPublicOrigin(request)
  const config = new MercadoPagoConfig({ accessToken: process.env.MP_CLIENT_SECRET! })
  const oauth = new OAuth(config)

  const { state, cookie } = nuevoStateOauth(id)

  const authorizationUrl = oauth.getAuthorizationURL({
    options: {
      client_id: process.env.MP_CLIENT_ID!,
      redirect_uri: `${origin}/api/mercadopago/oauth/callback`,
      state,
    },
  })

  const response = NextResponse.redirect(authorizationUrl)
  // sameSite lax: la vuelta desde Mercado Pago es una navegación GET de primer
  // nivel, así que la cookie viaja.
  response.cookies.set(MP_OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    path: MP_OAUTH_COOKIE_PATH,
    maxAge: MP_OAUTH_MAX_AGE_S,
  })
  return response
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all app routes (everything except /auth/* and its APIs, the public
  // event landing page, the payment stepper that interesados reach by email,
  // and the public APIs they call to register interest / pay)
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/e/') ||
    request.nextUrl.pathname.startsWith('/pago/') ||
    request.nextUrl.pathname.startsWith('/api/public/') ||
    request.nextUrl.pathname.startsWith('/api/auth/') ||
    request.nextUrl.pathname === '/'

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Cecistas con contraseña temporal (= su usuario) deben cambiarla antes de
  // usar el resto de la plataforma.
  if (user && !isPublicRoute) {
    const { data: persona } = await supabase
      .from('personas')
      .select('debe_cambiar_password')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (persona?.debe_cambiar_password) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/cambiar-password-inicial'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

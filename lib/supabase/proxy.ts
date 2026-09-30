import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Pantallas de la app a las que llega una cuenta de Participante. La primera es su inicio. */
const RUTAS_PARTICIPANTE = ['/eventos/publicados', '/settings']

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

  if (user && !isPublicRoute) {
    // Una sola llamada para las dos reglas de abajo (función de la 083).
    const { data: acceso, error: accesoError } = await supabase
      .rpc('mi_estado_acceso')
      .maybeSingle<{ es_interno: boolean; debe_cambiar_password: boolean }>()

    let debeCambiarPassword = acceso?.debe_cambiar_password ?? false

    // 083 todavía sin correr: la función no existe. Se vuelve a la consulta
    // de siempre y no se restringe a nadie como Participante.
    if (accesoError) {
      const { data: persona } = await supabase
        .from('personas')
        .select('debe_cambiar_password')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      debeCambiarPassword = persona?.debe_cambiar_password ?? false
    }

    // Cecistas con contraseña temporal (= su usuario) deben cambiarla antes de
    // usar el resto de la plataforma.
    if (debeCambiarPassword) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/cambiar-password-inicial'
      return NextResponse.redirect(url)
    }

    // Cuentas de Participante (conviventes no cecistas, migración 082): solo
    // ven eventos publicados y su configuración. Los datos ya los protege la RLS
    // (083); esto evita que caigan en pantallas internas vacías. Las APIs
    // validan permisos por su cuenta.
    const pathname = request.nextUrl.pathname
    const permitidaParaParticipante = RUTAS_PARTICIPANTE.some(
      ruta => pathname === ruta || pathname.startsWith(ruta + '/')
    )
    if (
      acceso?.es_interno === false &&
      !pathname.startsWith('/api/') &&
      !permitidaParaParticipante
    ) {
      const url = request.nextUrl.clone()
      url.pathname = RUTAS_PARTICIPANTE[0]
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

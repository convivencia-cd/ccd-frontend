import Link from 'next/link'
import { ArrowRight, Calendar, Globe, MapPin, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { canPerform, type UserContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { cargarMiPerfil } from '@/lib/personas/mi-perfil-server'
import { formatDateAR } from '@/lib/utils'

// Panel de inicio de la cuenta de Participante (convivente no cecista, card #92).
// Cada bloque depende de un permiso de catálogo que ya existe:
//   - Retiros publicados → view.eventos_publicados
//   - Mi perfil y Mis retiros → perfil.view_propio

const ESTADO_LABEL: Record<string, string> = {
  interesado: 'Interesado',
  inscripto: 'Inscripto',
  en_curso: 'Convivente',
  completado: 'Completado',
  lista_espera: 'Lista de espera',
}

const tipoLabel: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro corto',
  taller: 'Taller',
}

// Cuántos retiros publicados se muestran acá; el resto, en "Ver todos".
const MAX_PUBLICADOS = 3

type EventoPublicado = {
  id: string
  nombre: string
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  ciudad: string | null
  provincia_evento: string | null
}

export async function PanelParticipante({ ctx }: { ctx: UserContext }) {
  const supabase = await createClient()
  const verPublicados = canPerform(ctx, 'view.eventos_publicados')
  const verPerfil = canPerform(ctx, 'perfil.view_propio') && !!ctx.persona_id

  const [{ data: persona }, publicados, perfil] = await Promise.all([
    ctx.persona_id
      ? supabase.from('personas').select('nombre').eq('id', ctx.persona_id).maybeSingle()
      : Promise.resolve({ data: null }),
    verPublicados
      ? supabase
          .from('eventos')
          .select('id, nombre, tipo, fecha_inicio, fecha_fin, ciudad, provincia_evento')
          .eq('estado', 'publicado')
          .order('fecha_inicio', { ascending: true })
          .then(({ data }) => (data ?? []) as EventoPublicado[])
      : Promise.resolve([] as EventoPublicado[]),
    verPerfil ? cargarMiPerfil(ctx.persona_id!) : Promise.resolve(null),
  ])

  const nombre = (persona as { nombre: string | null } | null)?.nombre?.trim()
  const retiros = perfil?.retiros ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{nombre ? `¡Hola, ${nombre}!` : '¡Hola!'}</h1>
        <p className="mt-2 text-muted-foreground">Bienvenido/a a la Comunidad Convivencia con Dios.</p>
      </div>

      {verPerfil && perfil && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4">
              {perfil.persona.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.persona.foto_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {`${perfil.persona.nombre?.charAt(0) ?? ''}${perfil.persona.apellido?.charAt(0) ?? ''}`}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold leading-tight text-foreground">
                  {[perfil.persona.nombre, perfil.persona.apellido].filter(Boolean).join(' ')}
                </p>
                {perfil.persona.email && <p className="text-sm text-muted-foreground">{perfil.persona.email}</p>}
              </div>
            </div>
            <Link
              href="/mi-perfil"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4" />
              Ver mi perfil
            </Link>
          </CardContent>
        </Card>
      )}

      {verPublicados && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Globe className="h-5 w-5 text-green-600" />
                Retiros publicados
              </CardTitle>
              <CardDescription className="mt-1.5">Retiros abiertos para anotarse.</CardDescription>
            </div>
            {publicados.length > MAX_PUBLICADOS && (
              <Link href="/eventos/publicados" className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {publicados.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No hay retiros publicados por ahora.</p>
            ) : (
              <ul className="divide-y divide-border">
                {publicados.slice(0, MAX_PUBLICADOS).map(e => {
                  const ubicacion = [e.ciudad, e.provincia_evento].filter(Boolean).join(', ')
                  return (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{e.nombre}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{tipoLabel[e.tipo] ?? e.tipo}</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateAR(e.fecha_inicio)} — {formatDateAR(e.fecha_fin)}
                          </span>
                          {ubicacion && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {ubicacion}
                            </span>
                          )}
                        </p>
                      </div>
                      <Link
                        href={`/e/${e.id}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                      >
                        Ver detalles
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {verPerfil && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Mis retiros
            </CardTitle>
            <CardDescription>Retiros en los que te anotaste o participaste.</CardDescription>
          </CardHeader>
          <CardContent>
            {retiros.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Todavía no hay retiros.</p>
            ) : (
              <ul className="divide-y divide-border">
                {retiros.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.nombre}</p>
                      {r.fecha_inicio && <p className="text-xs text-muted-foreground">{formatDateAR(r.fecha_inicio)}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {!verPublicados && !verPerfil && (
        <p className="text-sm text-muted-foreground">Por ahora no hay nada para mostrar en tu cuenta.</p>
      )}
    </div>
  )
}

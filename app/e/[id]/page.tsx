import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ArrowLeft, CalendarDays, MapPin, Users, Phone, Mail, Building2, BookOpen, Wallet, CheckCircle2, Clock, XCircle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InteresModalWrapper } from '@/components/landing/InteresModalWrapper'

// El precio y el estado del evento pueden cambiar en cualquier momento — no
// cachear esta página.
export const dynamic = 'force-dynamic'

const TIPO_LABELS: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro',
  taller: 'Taller',
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  bimodal: 'Bimodal',
}

// Estados en los que el evento ya tuvo existencia pública (se publicó en algún
// momento) y por lo tanto su link /e/[id] debe seguir resolviendo — con las
// inscripciones cerradas — en vez de devolver 404.
const ESTADOS_VISIBLES_PUBLICO = ['publicado', 'en_curso', 'finalizado', 'cerrado', 'suspendido']

// external_reference llega por la URL: si no tiene forma de UUID, la consulta
// contra una columna uuid falla. Se valida antes de usarlo.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ESTADO_CERRADO_INFO: Record<string, { titulo: string; mensaje: string }> = {
  en_curso: {
    titulo: 'Convivencia en curso',
    mensaje: 'Este evento ya comenzó y las inscripciones están cerradas.',
  },
  finalizado: {
    titulo: 'Convivencia finalizada',
    mensaje: 'Este evento ya finalizó. ¡Gracias a quienes participaron!',
  },
  cerrado: {
    titulo: 'Convivencia finalizada',
    mensaje: 'Este evento ya finalizó. ¡Gracias a quienes participaron!',
  },
  suspendido: {
    titulo: 'Evento suspendido',
    mensaje: 'Este evento fue suspendido. Consultá con la organización para más información.',
  },
}

function formatDateRange(inicio: string, fin: string) {
  const start = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const locale = 'es-AR'
  if (inicio === fin) return start.toLocaleDateString(locale, opts)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} al ${end.toLocaleDateString(locale, opts)}`
  }
  return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString(locale, opts)}`
}

const PAGO_BANNER: Record<string, {
  icon: typeof CheckCircle2
  circleClassName: string
  iconClassName: string
  tituloClassName: string
  titulo: string
  mensaje: string
  estadoLabel: string
}> = {
  success: {
    icon: CheckCircle2,
    circleClassName: 'bg-green-100',
    iconClassName: 'text-green-600',
    tituloClassName: 'text-green-600',
    titulo: '¡Pago confirmado!',
    mensaje: 'Recibimos tu pago y tu lugar quedó reservado. ¡Te esperamos!',
    estadoLabel: 'Confirmado',
  },
  pending: {
    icon: Clock,
    circleClassName: 'bg-amber-100',
    iconClassName: 'text-amber-600',
    tituloClassName: 'text-amber-600',
    titulo: 'Pago en proceso',
    mensaje: 'Tu pago está siendo procesado. En cuanto se confirme, vas a quedar inscripto.',
    estadoLabel: 'Pendiente',
  },
  failure: {
    icon: XCircle,
    circleClassName: 'bg-red-100',
    iconClassName: 'text-red-600',
    tituloClassName: 'text-red-600',
    titulo: 'El pago no se completó',
    mensaje: 'Algo falló al procesar el pago. Podés volver a intentarlo cuando quieras desde "Quiero participar".',
    estadoLabel: 'No completado',
  },
}

export default async function PublicEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  // external_reference lo agrega Mercado Pago al volver: es el id de nuestro
  // pago, y es lo único que nos permite saber quién pagó en esta pantalla.
  searchParams: Promise<{ pago?: string; external_reference?: string; payment_id?: string }>
}) {
  const { id } = await params
  const { pago, external_reference: externalReference, payment_id: paymentId } = await searchParams
  const pagoBanner = pago ? PAGO_BANNER[pago] : undefined
  // Página pública: el control de acceso es el filtro estado='publicado' de
  // abajo, no RLS. Usamos el cliente de servicio porque organizaciones no
  // tiene policy de lectura anónima y el join a fraternidad/organizacion
  // (necesario para saber si hay cuenta de Mercado Pago conectada) devolvería
  // null con el cliente atado a la sesión del visitante.
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: evento }, { data: fechasEjecucion }] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        id, nombre, tipo, estado, fecha_inicio, fecha_fin,
        modalidad, descripcion, notas, cupo_maximo, audiencia,
        ciudad, codigo_postal, diocesis, provincia_evento, pais_evento,
        es_apv, precio,
        flyer_horizontal_url, flyer_cuadrado_url,
        asesor_voluntario,
        centralizador_1_persona_id, centralizador_1_nombre, centralizador_1_email, centralizador_1_telefono,
        centralizador_2_persona_id, centralizador_2_nombre, centralizador_2_email, centralizador_2_telefono,
        centralizador_3_persona_id, centralizador_3_nombre, centralizador_3_email, centralizador_3_telefono,
        organizacion:organizaciones!organizacion_id(id, nombre),
        fraternidad:organizaciones!fraternidad_id(id, nombre),
        casa_retiro:casas_retiro!casa_retiro_id(id, nombre, ciudad, provincia, link_maps),
        coordinador_asignado:personas!coordinador_asignado_id(id, nombre, apellido),
        asesor_asignado:personas!asesor_asignado_id(id, nombre, apellido)
      `)
      .eq('id', id)
      .in('estado', ESTADOS_VISIBLES_PUBLICO)
      .single(),
    supabase
      .from('evento_fechas')
      .select('id, fecha_inicio, fecha_fin')
      .eq('evento_id', id)
      .order('fecha_inicio'),
  ])

  if (!evento) notFound()

  const inscripcionesAbiertas = evento.estado === 'publicado'

  // Quién pagó, para poder saludarlo por su nombre y mostrarle con qué email
  // quedó registrado. Si el external_reference no viene o no resuelve, la
  // pantalla se muestra igual, solo que impersonal.
  let pagador: { nombre: string; apellido: string; email: string | null } | null = null
  if (pagoBanner) {
    const SELECT_PAGADOR =
      'participante:evento_participantes!evento_participante_id(persona:personas!persona_id(nombre, apellido, email))'
    type PagoRow = {
      participante: { persona: { nombre: string; apellido: string; email: string | null } | null } | null
    }

    // Mercado Pago devuelve varios parámetros al volver. Probamos primero por
    // nuestro id de pago y, si no vino, por el id de pago de MP.
    let pagoRow: PagoRow | null = null
    if (externalReference && UUID_RE.test(externalReference)) {
      const { data } = await supabase
        .from('pagos')
        .select(SELECT_PAGADOR)
        .eq('id', externalReference)
        .maybeSingle()
      pagoRow = data as unknown as PagoRow | null
    }
    if (!pagoRow && paymentId && /^\d+$/.test(paymentId)) {
      const { data } = await supabase
        .from('pagos')
        .select(SELECT_PAGADOR)
        .eq('mp_payment_id', Number(paymentId))
        .maybeSingle()
      pagoRow = data as unknown as PagoRow | null
    }

    const persona = pagoRow?.participante?.persona
    if (persona) pagador = persona
  }

  if (pagoBanner) {
    const Icon = pagoBanner.icon
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logoccd.jpeg" alt="Convivencia con Dios" width={32} height={32} className="rounded-md" priority />
              <span className="text-sm font-semibold text-foreground" translate="no">Convivencia con Dios</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center bg-background px-4 py-12 relative">
          <Link
            href={`/e/${id}`}
            aria-label="Cerrar y ver el evento"
            className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </Link>

          <div className="max-w-sm w-full text-center space-y-5">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${pagoBanner.circleClassName}`}>
              <Icon className={`h-10 w-10 ${pagoBanner.iconClassName}`} />
            </div>
            <div className="space-y-2">
              <h1 className={`text-2xl font-bold ${pagoBanner.tituloClassName}`}>{pagoBanner.titulo}</h1>
              {/* En un pago fallido no corresponde decir que lo registramos */}
              {pagador && pago !== 'failure' && (
                <p className="text-sm text-foreground">
                  Hola <strong>{pagador.nombre}</strong>, registramos tu pago para{' '}
                  <strong>{evento.nombre}</strong>.
                </p>
              )}
              <p className="text-sm text-muted-foreground">{pagoBanner.mensaje}</p>
            </div>
            <div className="rounded-xl border border-border p-4 text-left space-y-3 text-sm">
              <p className="font-semibold text-foreground">{evento.nombre}</p>
              {pagador && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-2">
                  <span className="text-muted-foreground shrink-0">A nombre de</span>
                  <span className="font-medium text-foreground text-right">
                    {pagador.nombre} {pagador.apellido}
                  </span>
                </div>
              )}
              {pagador?.email && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Email</span>
                  <span className="font-medium text-foreground text-right break-all">
                    {pagador.email}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Estado</span>
                <span className={`font-medium ${pagoBanner.tituloClassName}`}>{pagoBanner.estadoLabel}</span>
              </div>
              {evento.precio != null && Number(evento.precio) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-medium text-foreground">${Number(evento.precio).toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="px-4 py-8 text-center text-sm text-white/80" style={{ backgroundColor: '#1B3A4C' }}>
          <p className="font-medium text-white mb-1" translate="no">Convivencia con Dios</p>
          <p>© {new Date().getFullYear()} Todos los derechos reservados.</p>
        </footer>
      </div>
    )
  }

  type Org = {
    id: string
    nombre: string
  }

  const ev = evento as Record<string, unknown>
  const org = evento.organizacion as unknown as Org | null
  const fraternidad = evento.fraternidad as unknown as Org | null
  const casaRetiro = evento.casa_retiro as unknown as { id: string; nombre: string; ciudad?: string | null; provincia?: string | null; link_maps?: string | null } | null
  const flyerH = ev.flyer_horizontal_url as string | null
  const flyerC = ev.flyer_cuadrado_url as string | null
  const montoInscripcion = ev.precio != null ? Number(ev.precio) : null

  const centralizadores = [
    { nombre: ev.centralizador_1_nombre as string | null, email: ev.centralizador_1_email as string | null, telefono: ev.centralizador_1_telefono as string | null },
    { nombre: ev.centralizador_2_nombre as string | null, email: ev.centralizador_2_email as string | null, telefono: ev.centralizador_2_telefono as string | null },
    { nombre: ev.centralizador_3_nombre as string | null, email: ev.centralizador_3_email as string | null, telefono: ev.centralizador_3_telefono as string | null },
  ].filter((c) => c.nombre)

  const locationParts = [
    evento.ciudad,
    evento.provincia_evento,
    evento.pais_evento !== 'Argentina' ? evento.pais_evento : null,
  ].filter(Boolean)

  const locationDetails = [
    evento.codigo_postal ? `CP ${evento.codigo_postal}` : null,
    evento.diocesis ? `Diócesis de ${evento.diocesis}` : null,
  ].filter(Boolean)

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-foreground focus:underline">
        Ir al contenido principal
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logoccd.jpeg" alt="Convivencia con Dios" width={32} height={32} className="rounded-md" priority />
            <span className="text-sm font-semibold text-foreground" translate="no">Convivencia con Dios</span>
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8">

          {/* Back */}
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Volver a eventos
            </Link>
          </div>

          {/* Flyer */}
          {(flyerH || flyerC) && (
            <div className="rounded-xl overflow-hidden shadow-lg mb-8">
              {flyerH && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flyerH} alt={`Flyer de ${evento.nombre}`} className={`w-full object-cover${flyerC ? ' hidden sm:block' : ''}`} />
              )}
              {flyerC && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flyerC} alt={`Flyer de ${evento.nombre}`} className={`w-full object-cover${flyerH ? ' sm:hidden' : ''}`} />
              )}
            </div>
          )}

          {/* Título + badges */}
          <div className="space-y-3 mb-8">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary" className="capitalize">{TIPO_LABELS[evento.tipo] ?? evento.tipo}</Badge>
              {evento.modalidad && evento.modalidad !== 'presencial' && (
                <Badge variant="outline">{MODALIDAD_LABELS[evento.modalidad] ?? evento.modalidad}</Badge>
              )}
              {ev.es_apv && <Badge variant="outline" className="text-xs">DAV</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground leading-snug">{evento.nombre}</h1>
            {(org?.nombre || fraternidad?.nombre) && (
              <p className="text-muted-foreground text-sm">
                {[fraternidad?.nombre, org?.nombre].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Info grid */}
          <div className="grid gap-5 sm:grid-cols-2 mb-8 p-5 rounded-xl bg-muted/40 border border-border">

            {/* Fechas propuestas */}
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Fechas</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDateRange(evento.fecha_inicio, evento.fecha_fin)}
                </p>
              </div>
            </div>

            {/* Lugar */}
            {(locationParts.length > 0 || casaRetiro) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Lugar</p>
                  {casaRetiro && (
                    <p className="text-sm font-medium text-foreground">{casaRetiro.nombre}</p>
                  )}
                  {locationParts.length > 0 && (
                    <p className="text-sm text-muted-foreground">{locationParts.join(', ')}</p>
                  )}
                  {locationDetails.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{locationDetails.join(' · ')}</p>
                  )}
                  {casaRetiro?.link_maps && (
                    <a href={casaRetiro.link_maps} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#F08020] hover:underline mt-1">
                      <MapPin className="h-3 w-3" />
                      Ver en Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Cupo */}
            {evento.cupo_maximo && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Cupo</p>
                  <p className="text-sm font-medium text-foreground">{evento.cupo_maximo} personas</p>
                </div>
              </div>
            )}

            {/* Modalidad presencial */}
            {evento.modalidad === 'presencial' && (
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Modalidad</p>
                  <p className="text-sm font-medium text-foreground">Presencial</p>
                </div>
              </div>
            )}

            {/* Audiencia */}
            {evento.audiencia && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Dirigido a</p>
                  <p className="text-sm font-medium text-foreground">{evento.audiencia}</p>
                </div>
              </div>
            )}

            {/* Precio de inscripción */}
            {montoInscripcion != null && montoInscripcion > 0 && (
              <div className="flex items-start gap-3">
                <Wallet className="h-5 w-5 shrink-0 mt-0.5 text-[#F08020]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Precio</p>
                  <p className="text-sm font-medium text-foreground">${montoInscripcion.toLocaleString('es-AR')}</p>
                  {inscripcionesAbiertas && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Registrar tu interés no tiene costo: te enviamos el link de pago cuando confirmemos tu lugar
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fechas de ejecución (si hay múltiples períodos) */}
          {fechasEjecucion && fechasEjecucion.length > 0 && (
            <div className="mb-8 border-t border-border pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#F08020]" />
                Fechas de ejecución
              </h2>
              <div className="space-y-2">
                {(fechasEjecucion as Array<{ id: string; fecha_inicio: string; fecha_fin: string }>).map((f, i) => (
                  <div key={f.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Período {i + 1}</span>
                    <span className="text-foreground">{formatDateRange(f.fecha_inicio, f.fecha_fin)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descripción / notas */}
          {(evento.descripcion || evento.notas) && (
            <div className="mb-8 border-t border-border pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#F08020]" />
                Información
              </h2>
              {evento.descripcion && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{evento.descripcion}</p>
              )}
              {evento.notas && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{evento.notas}</p>
              )}
            </div>
          )}

          {/* Centralizadores */}
          {centralizadores.length > 0 && (
            <div className="mb-8 border-t border-border pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#F08020]" />
                Contacto / Centralizadores
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {centralizadores.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                    <p className="font-medium text-sm text-foreground">{c.nombre}</p>
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#F08020] transition-colors">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {c.email}
                      </a>
                    )}
                    {c.telefono && (
                      <a href={`tel:${c.telefono}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#F08020] transition-colors">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {c.telefono}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-border pt-6">
            {inscripcionesAbiertas ? (
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <InteresModalWrapper
                  eventoId={evento.id}
                  eventoNombre={evento.nombre}
                  volverAlListadoHref="/#panel-eventos"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm">
                <p className="font-semibold text-foreground">
                  {ESTADO_CERRADO_INFO[evento.estado]?.titulo ?? 'Inscripciones cerradas'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {ESTADO_CERRADO_INFO[evento.estado]?.mensaje ?? 'Las inscripciones para este evento no están disponibles.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-sm text-white/80 mt-16" style={{ backgroundColor: '#1B3A4C' }}>
        <p className="font-medium text-white mb-1" translate="no">Convivencia con Dios</p>
        <p>© {new Date().getFullYear()} Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}

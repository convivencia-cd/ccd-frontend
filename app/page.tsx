import Image from "next/image"
import Link from "next/link"
import { CalendarDays, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { EventosPublicosGrid } from "@/components/landing/EventosPublicosGrid"
import {
  PanelPublicacionEventos,
  type PanelEvento,
  type PanelFilters,
  type OrgOption,
} from "@/components/landing/PanelPublicacionEventos"

const TIPO_LABELS: Record<string, string> = {
  convivencia: "Convivencia",
  retiro: "Retiro corto",
  taller: "Taller",
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: "Presencial",
  virtual: "Virtual",
  bimodal: "Bimodal",
}

function formatDateRange(inicio: string, fin: string) {
  const start = new Date(inicio + "T00:00:00")
  const end = new Date(fin + "T00:00:00")
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
  const locale = "es-AR"
  if (inicio === fin) return start.toLocaleDateString(locale, opts)
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${start.getDate()} al ${end.toLocaleDateString(locale, opts)}`
  }
  return `${start.toLocaleDateString(locale, { day: "numeric", month: "long" })} al ${end.toLocaleDateString(locale, opts)}`
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]

  const sp = await searchParams
  const filters: PanelFilters = {
    fecha_desde: sp.fecha_desde || undefined,
    fecha_hasta: sp.fecha_hasta || undefined,
    confraternidad: sp.confraternidad || undefined,
    fraternidad: sp.fraternidad || undefined,
    casa_retiro: sp.casa_retiro || undefined,
    provincia: sp.provincia || undefined,
    ciudad: sp.ciudad || undefined,
    estado: sp.estado === "publicado" || sp.estado === "suspendido" ? sp.estado : undefined,
  }

  const eventosSelect = `id, nombre, tipo, fecha_inicio, fecha_fin, ciudad, provincia_evento, modalidad, cupo_maximo, flyer_horizontal_url, flyer_cuadrado_url,
       organizacion:organizaciones!organizacion_id(nombre)`

  const panelSelect = `id, nombre, tipo, estado, fecha_inicio, fecha_fin, ciudad, provincia_evento, modalidad, cupo_maximo, flyer_horizontal_url, flyer_cuadrado_url,
       organizacion:organizaciones!organizacion_id(nombre),
       fraternidad:organizaciones!fraternidad_id(nombre),
       casa_retiro:casas_retiro!casa_retiro_id(nombre)`

  // Panel filtrable: eventos publicados + suspendidos
  const estadosPanel = filters.estado ? [filters.estado] : ["publicado", "suspendido"]
  let panelQuery = supabase
    .from("eventos")
    .select(panelSelect)
    .in("estado", estadosPanel)
    .order("fecha_inicio", { ascending: true })

  if (filters.confraternidad) panelQuery = panelQuery.eq("organizacion_id", filters.confraternidad)
  if (filters.fraternidad) panelQuery = panelQuery.eq("fraternidad_id", filters.fraternidad)
  if (filters.casa_retiro) panelQuery = panelQuery.eq("casa_retiro_id", filters.casa_retiro)
  if (filters.provincia) panelQuery = panelQuery.eq("provincia_evento", filters.provincia)
  if (filters.ciudad) panelQuery = panelQuery.eq("ciudad", filters.ciudad)
  if (filters.fecha_desde) panelQuery = panelQuery.gte("fecha_inicio", filters.fecha_desde)
  if (filters.fecha_hasta) panelQuery = panelQuery.lte("fecha_fin", filters.fecha_hasta)

  const [
    { data: { user } },
    { data: eventos },
    { data: eventosAnteriores },
    { data: panelEventosData },
    { data: confraternidadesData },
    { data: fraternidadesData },
    { data: casasData },
    { data: ubicacionesData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("eventos")
      .select(eventosSelect)
      .eq("estado", "publicado")
      .gte("fecha_fin", today)
      .order("fecha_inicio", { ascending: true }),
    supabase
      .from("eventos")
      .select(eventosSelect)
      .or(`estado.eq.finalizado,and(estado.eq.publicado,fecha_fin.lt.${today})`)
      .order("fecha_inicio", { ascending: false })
      .limit(12),
    panelQuery,
    supabase
      .from("organizaciones")
      .select("id, nombre")
      .eq("tipo", "confraternidad")
      .is("fecha_baja", null)
      .order("nombre", { ascending: true }),
    supabase
      .from("organizaciones")
      .select("id, nombre")
      .eq("tipo", "fraternidad")
      .is("fecha_baja", null)
      .order("nombre", { ascending: true }),
    supabase
      .from("casas_retiro")
      .select("id, nombre")
      .is("fecha_baja", null)
      .order("nombre", { ascending: true }),
    supabase
      .from("eventos")
      .select("provincia_evento, ciudad")
      .in("estado", ["publicado", "suspendido"]),
  ])

  const panelEventos = (panelEventosData ?? []) as unknown as PanelEvento[]
  const confraternidades = (confraternidadesData ?? []) as OrgOption[]
  const fraternidades = (fraternidadesData ?? []) as OrgOption[]
  const casas = (casasData ?? []) as OrgOption[]

  const provincias = Array.from(
    new Set(((ubicacionesData ?? []) as { provincia_evento: string | null }[]).map((u) => u.provincia_evento).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b, "es"))
  const ciudades = Array.from(
    new Set(((ubicacionesData ?? []) as { ciudad: string | null }[]).map((u) => u.ciudad).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b, "es"))

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-foreground focus:underline"
      >
        Ir al contenido principal
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logoccd.jpeg"
              alt="Convivencia con Dios"
              width={32}
              height={32}
              className="rounded-md"
              priority
            />
            <span className="text-sm font-semibold text-foreground" translate="no">
              Convivencia con Dios
            </span>
          </Link>
          <Button asChild size="sm">
            <Link href={user ? "/dashboard" : "/auth/login"}>
              {user ? "Volver al panel" : "Acceder a la plataforma"}
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section
        id="main"
        className="flex flex-col items-center justify-center gap-6 px-4 py-20 text-center md:py-28"
        style={{ backgroundColor: "#F08020" }}
      >
        <Image
          src="/logoccd.jpeg"
          alt="Convivencia con Dios"
          width={96}
          height={96}
          className="rounded-2xl shadow-lg"
          priority
        />
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-white text-balance md:text-5xl" translate="no">
            Convivencia con Dios
          </h1>
          <p className="mx-auto max-w-md text-white/90 text-lg">
            Una meta posible y deseable
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-white text-[#F08020] hover:bg-orange-50 font-semibold shadow"
        >
          <Link href={user ? "/dashboard" : "/auth/login"}>
            {user ? "Volver al panel" : "Acceder a la plataforma"}
          </Link>
        </Button>
      </section>

      {/* About */}
      <section className="bg-white px-4 py-14 text-center">
        <p className="mx-auto max-w-xl text-muted-foreground leading-relaxed">
          Somos una <strong className="text-foreground">comunidad de oración, apostolado y vida</strong> que
          ayuda a las personas a encontrarse con un Dios vivo, alentándolos hacia la santidad,
          brindando una experiencia comunitaria de su presencia.
        </p>
      </section>

      {/* Panel de publicación de eventos (filtrable) */}
      <section id="panel-eventos" className="scroll-mt-20 bg-background px-4 pb-16 pt-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-2xl font-bold text-foreground text-center">
            Panel de retiros
          </h2>
          <p className="mb-8 text-center text-muted-foreground">
            Buscá y filtrá los retiros publicados y suspendidos de CcD
          </p>
          <PanelPublicacionEventos
            eventos={panelEventos}
            filters={filters}
            confraternidades={confraternidades}
            fraternidades={fraternidades}
            casas={casas}
            provincias={provincias}
            ciudades={ciudades}
          />
        </div>
      </section>

      {/* Events */}
      <section className="flex-1 bg-white px-4 pb-20 pt-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground text-center">
            Próximos retiros
          </h2>

          {!eventos || eventos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-8 py-16 text-center text-muted-foreground">
              No hay retiros publicados próximamente.
            </div>
          ) : (
            <EventosPublicosGrid eventos={eventos} />
          )}
        </div>
      </section>

      {/* Past Events */}
      {eventosAnteriores && eventosAnteriores.length > 0 && (
        <section className="bg-white px-4 pb-20 pt-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-2xl font-bold text-foreground text-center">
              Retiros anteriores
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {eventosAnteriores.map((evento) => {
                const org = evento.organizacion as unknown as { nombre: string } | null
                const flyerH = (evento as Record<string, unknown>).flyer_horizontal_url as string | null
                const flyerC = (evento as Record<string, unknown>).flyer_cuadrado_url as string | null
                return (
                  <Card key={evento.id} className="flex flex-col overflow-hidden opacity-75">
                    {(flyerH || flyerC) && (
                      <div className="relative grayscale">
                        {flyerC && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flyerC} alt="" className={`w-full aspect-square object-cover${flyerH ? " sm:hidden" : ""}`} />
                        )}
                        {flyerH && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flyerH} alt="" className={`w-full aspect-video object-cover${flyerC ? " hidden sm:block" : ""}`} />
                        )}
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="shrink-0 capitalize">
                          {TIPO_LABELS[evento.tipo] ?? evento.tipo}
                        </Badge>
                        {evento.modalidad && evento.modalidad !== "presencial" && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {MODALIDAD_LABELS[evento.modalidad] ?? evento.modalidad}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="mt-2 text-base leading-snug line-clamp-2 text-muted-foreground">
                        {evento.nombre}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{formatDateRange(evento.fecha_inicio, evento.fecha_fin)}</span>
                      </div>
                      {(evento.ciudad || evento.provincia_evento) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>
                            {[evento.ciudad, evento.provincia_evento].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {org?.nombre && (
                        <p className="mt-1 text-xs text-muted-foreground/70">{org.nombre}</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        className="px-4 py-8 text-center text-sm text-white/80"
        style={{ backgroundColor: "#1B3A4C" }}
      >
        <p className="font-medium text-white mb-1" translate="no">
          Convivencia con Dios
        </p>
        <p>© {new Date().getFullYear()} Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}

export const dynamic = "force-dynamic"

import Link from "next/link"
import {
  Calendar,
  MapPin,
  Phone,
  Mail,
  Users,
  Eye,
  Search,
  Building2,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserContext } from "@/lib/auth/context"
import { formatDateAR } from "@/lib/utils"
import { CentralizadorComboboxFilters } from "./_components/centralizador-combobox-filters"

const estadoEventoClases: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  solicitud: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  discernimiento_confra: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  discernimiento_eqt: "bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  pendiente_datos_noticias: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  pendiente_aprobacion_final: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  aprobado: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  publicado: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  en_curso: "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  finalizado: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  suspendido: "bg-orange-200 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  cancelado: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const estadoEventoLabel: Record<string, string> = {
  borrador: "Borrador",
  solicitud: "Pend. Disc. Confra",
  discernimiento_confra: "Pend. Disc. EqT",
  discernimiento_eqt: "Disc. EqT",
  pendiente_datos_noticias: "Pend. Datos Noticias",
  pendiente_aprobacion_final: "Pend. Aprobación Final",
  aprobado: "Aprobado",
  publicado: "Publicado",
  en_curso: "En Curso",
  finalizado: "Finalizado",
  rechazado: "Rechazado",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
}

const ESTADO_EVENTO_FILTROS = [
  { value: "", label: "Todos los estados" },
  { value: "publicado", label: "Publicado" },
  { value: "en_curso", label: "En Curso" },
  { value: "finalizado", label: "Finalizado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "pendiente_datos_noticias", label: "Pend. Datos Noticias" },
  { value: "pendiente_aprobacion_final", label: "Pend. Aprobación Final" },
  { value: "suspendido", label: "Suspendido" },
]

// Estado de participación → etiqueta pedida por el negocio
const participacionClases: Record<string, string> = {
  interesado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  inscripto: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  en_curso: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
}

const participacionLabel: Record<string, string> = {
  interesado: "Interesada",
  inscripto: "Inscripta",
  en_curso: "Convivente",
}

const PARTICIPACION_FILTROS = [
  { value: "", label: "Todos los estados" },
  { value: "interesado", label: "Interesadas" },
  { value: "inscripto", label: "Inscriptas" },
  { value: "en_curso", label: "Conviventes" },
]

type OrgRef = { id: string; nombre: string } | null

type MiEvento = {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  ciudad: string | null
  provincia_evento: string | null
  organizacion_id: string | null
  fraternidad_id: string | null
  organizacion: OrgRef
  fraternidad: OrgRef
}

export default async function CentralizadorPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizacion_id?: string
    fraternidad_id?: string
    provincia?: string
    ciudad?: string
    estado?: string
    estado_contacto?: string
    fecha_desde?: string
    fecha_hasta?: string
  }>
}) {
  const {
    organizacion_id,
    fraternidad_id,
    provincia,
    ciudad,
    estado,
    estado_contacto,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  } = await searchParams

  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx?.persona_id) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Soy Centralizador
        </h1>
        <Card className="mt-6 border-border">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">
              Solo disponible para personas registradas
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu cuenta no está vinculada a una persona del sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pid = ctx.persona_id

  // Todos los eventos donde figuro como centralizador (1, 2 o 3), sin filtros de
  // UI todavía: los usamos para derivar las opciones de los dropdowns.
  const { data: allMisEventos } = await supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, estado, fecha_inicio, fecha_fin, ciudad, provincia_evento, organizacion_id, fraternidad_id, organizacion:organizaciones!organizacion_id(id, nombre), fraternidad:organizaciones!fraternidad_id(id, nombre)",
    )
    .or(
      `centralizador_1_persona_id.eq.${pid},centralizador_2_persona_id.eq.${pid},centralizador_3_persona_id.eq.${pid}`,
    )
    .order("fecha_inicio", { ascending: false })

  const misEventos = (allMisEventos ?? []) as unknown as MiEvento[]

  // Opciones de filtros derivadas del conjunto completo
  const confraOptions = new Map<string, string>()
  const fratOptions = new Map<string, string>()
  const provinciaSet = new Set<string>()
  const ciudadSet = new Set<string>()
  for (const ev of misEventos) {
    if (ev.organizacion?.id) confraOptions.set(ev.organizacion.id, ev.organizacion.nombre)
    if (ev.fraternidad?.id) fratOptions.set(ev.fraternidad.id, ev.fraternidad.nombre)
    if (ev.provincia_evento) provinciaSet.add(ev.provincia_evento)
    if (ev.ciudad) ciudadSet.add(ev.ciudad)
  }
  const confraList = Array.from(confraOptions, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const fratList = Array.from(fratOptions, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const provinciaList = Array.from(provinciaSet).sort((a, b) => a.localeCompare(b))
  const ciudadList = Array.from(ciudadSet).sort((a, b) => a.localeCompare(b))

  // Aplicar filtros de UI (en JS: el conjunto es acotado por centralizador)
  const eventosFiltrados = misEventos.filter((ev) => {
    if (organizacion_id && ev.organizacion_id !== organizacion_id) return false
    if (fraternidad_id && ev.fraternidad_id !== fraternidad_id) return false
    if (provincia && ev.provincia_evento !== provincia) return false
    if (ciudad && ev.ciudad !== ciudad) return false
    if (estado && ev.estado !== estado) return false
    if (fechaDesde && (!ev.fecha_inicio || ev.fecha_inicio < fechaDesde)) return false
    if (fechaHasta && (!ev.fecha_fin || ev.fecha_fin > fechaHasta)) return false
    return true
  })

  // Sección B — Personas de los eventos filtrados
  const eventoIds = eventosFiltrados.map((e) => e.id)
  let participantes: any[] = []
  if (eventoIds.length > 0) {
    let query = supabase
      .from("evento_participantes")
      .select(
        "id, estado_participacion, fecha_inscripcion, persona:personas!persona_id(id, nombre, apellido, telefono, email, localidad, provincia), evento:eventos!evento_id(id, nombre)",
      )
      .in("evento_id", eventoIds)
      .in("estado_participacion", ["interesado", "inscripto", "en_curso"])
      .order("fecha_inscripcion", { ascending: false })

    if (estado_contacto) query = query.eq("estado_participacion", estado_contacto)

    const { data } = await query
    participantes = data ?? []
  }

  const hasEventoFilters = !!(
    organizacion_id ||
    fraternidad_id ||
    provincia ||
    ciudad ||
    estado ||
    fechaDesde ||
    fechaHasta
  )
  const hasAnyFilters = hasEventoFilters || !!estado_contacto

  const selectClass =
    "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          Soy Centralizador
        </h1>
        <p className="mt-1 text-muted-foreground">
          Eventos donde figurás como centralizador y las personas interesadas,
          inscriptas y conviventes de esos eventos.
        </p>
      </div>

      {misEventos.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">
              No sos centralizador de ningún evento
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando te asignen como centralizador de un evento, aparecerá acá.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filtros comunes */}
          <form
            method="GET"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
          >
            <CentralizadorComboboxFilters
              confraList={confraList}
              fratList={fratList}
              provinciaList={provinciaList}
              ciudadList={ciudadList}
              defaultOrganizacionId={organizacion_id ?? ""}
              defaultFraternidadId={fraternidad_id ?? ""}
              defaultProvincia={provincia ?? ""}
              defaultCiudad={ciudad ?? ""}
              className={selectClass}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Estado del evento</label>
              <select name="estado" defaultValue={estado ?? ""} className={selectClass}>
                {ESTADO_EVENTO_FILTROS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Desde</label>
              <input name="fecha_desde" type="date" defaultValue={fechaDesde ?? ""} className={selectClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <input name="fecha_hasta" type="date" defaultValue={fechaHasta ?? ""} className={selectClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Estado de la persona</label>
              <select name="estado_contacto" defaultValue={estado_contacto ?? ""} className={selectClass}>
                {PARTICIPACION_FILTROS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">Filtrar</Button>
            {hasAnyFilters && (
              <Link href="/eventos/centralizador" className="text-sm text-muted-foreground hover:text-foreground">
                Limpiar
              </Link>
            )}
          </form>

          {/* Sección A — Mis eventos */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calendar className="h-5 w-5 text-primary" />
                Eventos donde soy Centralizador
              </CardTitle>
              <CardDescription>
                {eventosFiltrados.length} de {misEventos.length} eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventosFiltrados.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ningún evento coincide con los filtros.
                </p>
              ) : (
                eventosFiltrados.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">{ev.nombre}</h3>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoEventoClases[ev.estado] ?? estadoEventoClases.borrador}`}>
                          {estadoEventoLabel[ev.estado] ?? ev.estado}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {(ev.fecha_inicio || ev.fecha_fin) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateAR(ev.fecha_inicio)}
                            {ev.fecha_fin ? ` — ${formatDateAR(ev.fecha_fin)}` : ""}
                          </span>
                        )}
                        {ev.organizacion?.nombre && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {ev.organizacion.nombre}
                            {ev.fraternidad?.nombre ? ` · ${ev.fraternidad.nombre}` : ""}
                          </span>
                        )}
                        {(ev.ciudad || ev.provincia_evento) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {[ev.ciudad, ev.provincia_evento].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/eventos/${ev.id}`} className="ml-4 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Sección B — Personas */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5 text-primary" />
                Personas de mis eventos
              </CardTitle>
              <CardDescription>
                Interesadas, inscriptas y conviventes · {participantes.length} personas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participantes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {hasAnyFilters
                    ? "No hay personas que coincidan con los filtros."
                    : "Todavía no hay personas registradas en tus eventos."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Apellido, Nombre</th>
                        <th className="px-3 py-2 font-medium">Contacto</th>
                        <th className="px-3 py-2 font-medium">Ciudad</th>
                        <th className="px-3 py-2 font-medium">Provincia</th>
                        <th className="px-3 py-2 font-medium">Evento de Interés</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantes.map((p) => {
                        const persona = p.persona
                        return (
                          <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                            <td className="px-3 py-2 font-medium text-foreground">
                              {persona ? `${persona.apellido ?? ""}, ${persona.nombre ?? ""}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {persona?.telefono || persona?.email ? (
                                <div className="space-y-0.5">
                                  {persona.telefono && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3.5 w-3.5" />
                                      {persona.telefono}
                                    </span>
                                  )}
                                  {persona.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3.5 w-3.5" />
                                      {persona.email}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{persona?.localidad ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{persona?.provincia ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.evento?.nombre ?? "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${participacionClases[p.estado_participacion] ?? ""}`}>
                                {participacionLabel[p.estado_participacion] ?? p.estado_participacion}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

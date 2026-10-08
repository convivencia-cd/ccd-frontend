export const dynamic = "force-dynamic"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Calendar, Plus, Eye, Edit2, Clock, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { formatDateAR } from "@/lib/utils"

const estadoClases: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  solicitud:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  discernimiento_confra:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  discernimiento_eqt:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  pendiente_datos_noticias:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  pendiente_aprobacion_final:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  aprobado: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  publicado:
    "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  en_curso: "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  suspendido:
    "bg-orange-200 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  finalizado:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  cancelado: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const estadoLabel: Record<string, string> = {
  borrador: "Borrador",
  solicitud: "Pend. Disc. Confra",
  discernimiento_confra: "Pend. Disc. EqT",
  discernimiento_eqt: "Disc. EqT",
  pendiente_datos_noticias: "Pend. Datos Noticias",
  pendiente_aprobacion_final: "Pend. Aprobación Final",
  aprobado: "Aprobado",
  publicado: "Publicado",
  en_curso: "En Curso",
  rechazado: "Rechazado",
  suspendido: "Suspendido",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
}

const tipoLabel: Record<string, string> = {
  convivencia: "Convivencia",
  retiro: "Retiro corto",
  taller: "Taller",
  encuentro: "Encuentro",
}

const FILTROS = [
  { value: "", label: "Todos" },
  { value: "solicitud", label: "Solicitudes" },
  { value: "discernimiento_confra", label: "Disc. Confra" },
  { value: "discernimiento_eqt", label: "Disc. EqT" },
  { value: "pendiente_datos_noticias", label: "Pend. Datos Noticias" },
  { value: "pendiente_aprobacion_final", label: "Pend. Aprobación Final" },
  { value: "aprobado", label: "Aprobados" },
  { value: "publicado", label: "Publicados" },
  { value: "suspendido", label: "Suspendidos" },
]

// Estados que un cecista sin permisos extra puede ver en el listado: solo lo
// que ya es público (y sus consecuencias). "aprobado" NO es público todavía
// — se suma con event.view_aprobados — y el resto (borrador, discernimiento,
// rechazado, suspendido, cancelado) requiere event.view_all_estados.
const ESTADOS_VISIBLES_SIN_PERMISO = ["publicado", "en_curso", "finalizado"]
const ESTADOS_APROBADOS = ["aprobado"]

type EventoRow = {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string
  fecha_fin: string
  organizacion_id?: string | null
  fraternidad_id?: string | null
  organizacion: { nombre: string } | null
}

function EventoItem({
  evento,
  isPendiente,
  canEdit = false,
}: {
  evento: EventoRow
  isPendiente?: boolean
  canEdit?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-medium text-foreground truncate">
            {evento.nombre}
          </h3>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoClases[evento.estado] ?? estadoClases.borrador}`}
          >
            {estadoLabel[evento.estado] ?? evento.estado}
          </span>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
          <span>{tipoLabel[evento.tipo] ?? evento.tipo}</span>
          <span>
            {formatDateAR(evento.fecha_inicio)} —{" "}
            {formatDateAR(evento.fecha_fin)}
          </span>
          {evento.organizacion && <span>{evento.organizacion.nombre}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {isPendiente ? (
          <Link href={`/eventos/${evento.id}`}>
            <Button size="sm">
              {evento.estado === "pendiente_aprobacion_final"
                ? "Revisar"
                : "Discernir"}
            </Button>
          </Link>
        ) : (
          <>
            <Link href={`/eventos/${evento.id}`}>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {canEdit && (
              <Link href={`/eventos/${evento.id}/editar`}>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    estado?: string
    tipo?: string
    fecha_desde?: string
    fecha_hasta?: string
  }>
}) {
  const {
    q,
    estado: estadoFiltro,
    tipo: tipoFiltro,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  } = await searchParams
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])
  const canCreate = ctx && (ctx.is_admin || ctx.nivel_max >= 50)
  const canSuspend = ctx && canPerform(ctx, "event.suspend")
  const canViewAllEstados = ctx ? canPerform(ctx, "event.view_all_estados") : false
  // Ver "aprobado" viene incluido en view_all_estados; si no, hace falta el permiso propio.
  const canViewAprobados =
    canViewAllEstados || (ctx ? canPerform(ctx, "event.view_aprobados") : false)
  const estadosVisibles = canViewAprobados
    ? [...ESTADOS_VISIBLES_SIN_PERMISO, ...ESTADOS_APROBADOS]
    : ESTADOS_VISIBLES_SIN_PERMISO

  // Build main query
  let query = supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, estado, fecha_inicio, fecha_fin, organizacion_id, fraternidad_id, organizacion:organizaciones!organizacion_id(nombre)",
    )
    .order("fecha_inicio", { ascending: false })

  if (!canViewAllEstados) query = query.in("estado", estadosVisibles)
  if (q) query = query.ilike("nombre", `%${q}%`)
  if (estadoFiltro) query = query.eq("estado", estadoFiltro)
  if (tipoFiltro) query = query.eq("tipo", tipoFiltro)
  if (fechaDesde) query = query.gte("fecha_inicio", fechaDesde)
  if (fechaHasta) query = query.lte("fecha_fin", fechaHasta)

  const { data: eventos } = await query

  // El lápiz de edición se muestra solo con event.update sobre la organización
  // del evento (o su fraternidad) — mismo criterio que el detalle y que la
  // guarda de /eventos/[id]/editar.
  const puedeEditar = (ev: EventoRow) =>
    ctx
      ? canPerform(ctx, "event.update", ev.organizacion_id ?? null) ||
        (ev.fraternidad_id
          ? canPerform(ctx, "event.update", ev.fraternidad_id)
          : false)
      : false

  // Pendientes section: events pending the user's approval
  let pendientes: EventoRow[] = []
  if (ctx) {
    const canApproveConfra = canPerform(ctx, "event.approve_confra")
    const canApproveTimon = canPerform(ctx, "event.approve_eqt")

    if (canApproveConfra || canApproveTimon) {
      const pendingStates: string[] = []
      if (canApproveConfra) {
        pendingStates.push("solicitud")
      }
      if (canApproveTimon) {
        pendingStates.push(
          "discernimiento_confra",
          "discernimiento_eqt",
          "pendiente_aprobacion_final",
        )
        if (!pendingStates.includes("solicitud"))
          pendingStates.push("solicitud")
      }

      const { data: pendingData } = await supabase
        .from("eventos")
        .select(
          "id, nombre, tipo, estado, fecha_inicio, fecha_fin, requiere_discernimiento_confra, requiere_discernimiento_eqt, organizacion:organizaciones!organizacion_id(nombre, id)",
        )
        .in("estado", pendingStates)
        .order("fecha_solicitud", { ascending: true })

      // Filter: only show events this user can actually act on
      pendientes = (pendingData ?? [])
        .filter((ev: any) => {
          const confraId = ev.organizacion?.id as string | null
          const requiereConfra = ev.requiere_discernimiento_confra ?? false
          const requiereEqt = ev.requiere_discernimiento_eqt ?? false

          // discernimiento_confra = confra done, EqT needs to act
          if (ev.estado === "discernimiento_confra" && canApproveTimon)
            return true
          // discernimiento_eqt = legacy state, also EqT's turn
          if (ev.estado === "discernimiento_eqt" && canApproveTimon) return true
          // pendiente_aprobacion_final = awaiting EqT final approval
          if (ev.estado === "pendiente_aprobacion_final" && canApproveTimon)
            return true

          if (ev.estado === "solicitud") {
            // EqT acts directly when no confra step required
            if (!requiereConfra && requiereEqt && canApproveTimon) return true
            // Confra acts on solicitud
            if (requiereConfra && canApproveConfra) {
              if (ctx.is_admin) return true
              return confraId ? ctx.org_ids.includes(confraId) : false
            }
          }

          return false
        })
        .map((ev: any) => ({
          ...ev,
          organizacion: ev.organizacion
            ? { nombre: ev.organizacion.nombre }
            : null,
        }))
    }
  }

  // Solicitudes de suspensión pendientes — solo Timonel
  let solicitudesSuspension: {
    id: string
    nombre: string
    solicitud_suspension_notas: string | null
    solicitud_suspension_fecha: string | null
    organizacion: { nombre: string } | null
  }[] = []
  if (canSuspend) {
    const { data: suspData } = await supabase
      .from("eventos")
      .select(
        "id, nombre, solicitud_suspension_notas, solicitud_suspension_fecha, organizacion:organizaciones!organizacion_id(nombre)",
      )
      .not("solicitud_suspension_fecha", "is", null)
      .not("estado", "in", "(suspendido,cancelado,finalizado,rechazado)")
      .order("solicitud_suspension_fecha", { ascending: true })
    solicitudesSuspension = (suspData ?? []) as typeof solicitudesSuspension
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          Plataforma de Gestión de Eventos Convivencia con Dios
        </h1>
        <p className="mt-2 text-muted-foreground">Crea y administra eventos.</p>
      </div>

      {/* Pendientes de aprobación */}
      {pendientes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pendientes de tu aprobación
            </CardTitle>
            <CardDescription>
              Estos eventos están esperando tu discernimiento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendientes.map((ev) => (
              <EventoItem key={ev.id} evento={ev} isPendiente />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Solicitudes de Suspensión — solo Timonel */}
      {canSuspend && solicitudesSuspension.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700 bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Solicitudes de Suspensión
            </CardTitle>
            <CardDescription>
              Eventos con solicitud de suspensión pendiente de revisión
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {solicitudesSuspension.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {ev.nombre}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {ev.organizacion && <span>{ev.organizacion.nombre}</span>}
                    {ev.solicitud_suspension_fecha && (
                      <span>
                        Solicitado el{" "}
                        {formatDateAR(ev.solicitud_suspension_fecha)}
                      </span>
                    )}
                  </div>
                  {ev.solicitud_suspension_notas && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Motivo: {ev.solicitud_suspension_notas}
                    </p>
                  )}
                </div>
                <div className="ml-4 shrink-0">
                  <Link href={`/eventos/${ev.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 bg-transparent"
                    >
                      Revisar
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main list */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">
              Eventos Registrados
            </CardTitle>
            <CardDescription>
              Lista completa de eventos en el sistema
            </CardDescription>
          </div>
          {canCreate && (
            <Link href="/eventos/nuevo">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Evento
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and filter */}
          <form method="GET" className="flex gap-3 flex-wrap items-end">
            <div className="relative flex-1 min-w-48">
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
            </div>
            <select
              name="estado"
              defaultValue={estadoFiltro ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {(canViewAllEstados
                ? FILTROS
                : FILTROS.filter((f) => f.value === "" || estadosVisibles.includes(f.value))
              ).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              name="tipo"
              defaultValue={tipoFiltro ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Todos los tipos</option>
              <option value="convivencia">Convivencia</option>
              <option value="retiro">Retiro corto</option>
              <option value="taller">Taller</option>
              <option value="encuentro">Encuentro</option>
            </select>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">
                Desde
              </label>
              <input
                name="fecha_desde"
                type="date"
                defaultValue={fechaDesde ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">
                Hasta
              </label>
              <input
                name="fecha_hasta"
                type="date"
                defaultValue={fechaHasta ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Filtrar
            </button>
            {(q || estadoFiltro || tipoFiltro || fechaDesde || fechaHasta) && (
              <Link
                href="/eventos"
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Limpiar
              </Link>
            )}
          </form>

          {eventos && eventos.length > 0 ? (
            <div className="space-y-3">
              {(eventos as EventoRow[]).map((evento) => (
                <EventoItem
                  key={evento.id}
                  evento={evento}
                  canEdit={puedeEditar(evento)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {q || estadoFiltro || tipoFiltro || fechaDesde || fechaHasta
                  ? "No se encontraron eventos"
                  : "No hay eventos registrados"}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {q || estadoFiltro || tipoFiltro || fechaDesde || fechaHasta
                  ? "Probá con otros filtros"
                  : "Comienza agregando el primer evento al sistema"}
              </p>
              {!q &&
                !estadoFiltro &&
                !tipoFiltro &&
                !fechaDesde &&
                !fechaHasta &&
                canCreate && (
                  <Link href="/eventos/nuevo" className="mt-4 inline-block">
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nuevo Evento
                    </Button>
                  </Link>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

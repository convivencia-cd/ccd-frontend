export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { ClipboardList, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserContext } from "@/lib/auth/context"
import { resolverAccesoPorEvento } from "@/lib/eventos/acceso-por-evento"
import { marcarPreinscriptos } from "@/lib/eventos/inscripcion-datos-server"
import { filtroBusquedaPersonas } from "@/lib/personas/busqueda"
import { formatDateAR } from "@/lib/utils"
import { EventoFilter } from "../interesados/_components/evento-filter"
import { ContactoPersona } from "../eventos/[id]/_components/participantes-evento-card"

const ESTADO_FILTROS = [
  { value: "", label: "Todos los estados" },
  { value: "preinscripto", label: "Preinscripto" },
  { value: "inscripto", label: "Inscripto" },
  { value: "en_curso", label: "Convivente" },
  { value: "completado", label: "Completado" },
  { value: "lista_espera", label: "Lista de espera" },
]

const estadoClases: Record<string, string> = {
  preinscripto: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  inscripto: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  en_curso: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  completado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  lista_espera: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
}

const estadoLabel: Record<string, string> = Object.fromEntries(
  ESTADO_FILTROS.filter((f) => f.value).map((f) => [f.value, f.label]),
)

type InscriptoRow = {
  id: string
  estado_participacion: string
  fecha_inscripcion: string | null
  persona: { id: string; nombre: string; apellido: string; email: string | null; telefono: string | null } | null
  evento: { id: string; nombre: string; fecha_inicio: string | null } | null
}

export default async function InscriptosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; evento_id?: string; estado?: string }>
}) {
  const { q, evento_id, estado } = await searchParams
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx) redirect("/dashboard")

  // Permiso de catálogo view.inscriptos (scopeado a su organización) o
  // Coordinador/Centralizador de algún evento puntual.
  const { hasAccess, allowedEventoIds } = await resolverAccesoPorEvento(supabase, ctx, "view.inscriptos")
  if (!hasAccess) redirect("/dashboard")

  let personaIds: string[] | null = null
  const filtroPersona = q ? filtroBusquedaPersonas(q) : null
  if (filtroPersona) {
    const { data } = await supabase.from("personas").select("id").or(filtroPersona)
    personaIds = data?.map((r) => r.id) ?? []
  }
  const noResults = personaIds !== null && personaIds.length === 0

  // Opciones del filtro de retiro: eventos con conviventes (dentro de lo permitido).
  let eventoRowsQuery = supabase
    .from("evento_participantes")
    .select("evento:eventos!evento_id(id, nombre)")
    .eq("rol_en_evento", "convivente")
    .neq("estado_participacion", "cancelado")
  if (allowedEventoIds !== null) eventoRowsQuery = eventoRowsQuery.in("evento_id", allowedEventoIds)
  const { data: eventoRows } = await eventoRowsQuery
  const eventosMap = new Map<string, string>()
  for (const row of (eventoRows as any[]) ?? []) {
    if (row.evento?.id) eventosMap.set(row.evento.id, row.evento.nombre)
  }
  const eventoOptions = Array.from(eventosMap, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  )

  // Mismo criterio que la Gestión del retiro: conviventes no cancelados;
  // los interesados solo si ya completaron la planilla (preinscriptos).
  let inscriptos: (InscriptoRow & { preinscripto: boolean })[] = []
  if (!noResults) {
    let query = supabase
      .from("evento_participantes")
      .select(`
        id, estado_participacion, fecha_inscripcion,
        persona:personas!persona_id(id, nombre, apellido, email, telefono),
        evento:eventos!evento_id(id, nombre, fecha_inicio)
      `)
      .eq("rol_en_evento", "convivente")
      .neq("estado_participacion", "cancelado")
      .order("fecha_inscripcion", { ascending: false })

    if (allowedEventoIds !== null) query = query.in("evento_id", allowedEventoIds)
    if (personaIds !== null) query = query.in("persona_id", personaIds)
    if (evento_id) query = query.eq("evento_id", evento_id)
    if (estado) query = query.eq("estado_participacion", estado === "preinscripto" ? "interesado" : estado)

    const { data } = await query
    const filas = await marcarPreinscriptos((data ?? []) as unknown as InscriptoRow[])
    inscriptos = filas.filter((p) => p.estado_participacion !== "interesado" || p.preinscripto)
  }

  const hasFilters = !!(q || evento_id || estado)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Inscriptos</h1>
        <p className="mt-1 text-muted-foreground">
          Preinscriptos, inscriptos y conviventes de los retiros.
        </p>
      </div>

      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, apodo o email..."
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground"
          />
        </div>
        <EventoFilter eventos={eventoOptions} defaultValue={evento_id ?? ""} />
        <select
          name="estado"
          defaultValue={estado ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {ESTADO_FILTROS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {hasFilters && (
          <Link href="/inscriptos" className="text-sm text-muted-foreground hover:text-foreground">
            Limpiar
          </Link>
        )}
      </form>

      {inscriptos.length > 0 ? (
        <Card className="border-border">
          <CardContent className="p-0">
            <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {inscriptos.length} {inscriptos.length === 1 ? "persona" : "personas"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Apellido, Nombre</th>
                    <th className="px-4 py-2 font-medium">Retiro</th>
                    <th className="px-4 py-2 font-medium">Contacto</th>
                    <th className="px-4 py-2 font-medium">Fecha inscripción</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {inscriptos.map((p) => {
                    const clave = p.preinscripto ? "preinscripto" : p.estado_participacion
                    return (
                      <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-4 py-2 font-medium text-foreground">
                          {p.persona ? (
                            <Link href={`/personas/${p.persona.id}`} className="hover:underline">
                              {p.persona.apellido}, {p.persona.nombre}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {p.evento ? (
                            <Link href={`/eventos/${p.evento.id}`} className="hover:text-foreground hover:underline">
                              {p.evento.nombre}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {p.evento?.fecha_inicio && (
                            <span className="block text-xs">{formatDateAR(p.evento.fecha_inicio)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          <ContactoPersona persona={p.persona} />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {p.fecha_inscripcion ? formatDateAR(p.fecha_inscripcion) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoClases[clave] ?? ""}`}
                          >
                            {estadoLabel[clave] ?? clave}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">Sin inscriptos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "No hay inscriptos que coincidan con los filtros."
                : "Todavía no hay inscriptos en los retiros."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

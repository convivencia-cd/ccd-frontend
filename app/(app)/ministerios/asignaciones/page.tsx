export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { UserCheck, Plus, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { nombreCompletoConApodo } from "@/lib/personas/nombre"
import { filtroBusquedaPersonas } from "@/lib/personas/busqueda"
import DataPagination from "@/components/data-pagination"

const PAGE_SIZE = 25

export default async function AsignacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ministerio?: string; page?: string }>
}) {
  const [params, ctx] = await Promise.all([searchParams, getUserContext()])
  const { q, ministerio: ministerioFiltro } = params
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  if (!ctx) redirect("/auth/login")
  if (!canPerform(ctx, "roles.assign")) redirect("/dashboard")

  const supabase = await createClient()

  // Cargar ministerios para el filtro
  const { data: ministerios } = await supabase
    .from("ministerios")
    .select("id, nombre, tipo")
    .eq("activo", true)
    .order("nombre")

  // La búsqueda por nombre/email se resuelve contra `personas` y se aplica como
  // filtro relacional (mismo patrón que /personas): antes se filtraba en JS
  // sobre las filas ya traídas, y como PostgREST corta en 1000 filas la persona
  // buscada podía quedar fuera del corte y "no existir".
  let personaIds: string[] | null = null
  const filtroPersona = q ? filtroBusquedaPersonas(q) : null
  if (filtroPersona) {
    const { data } = await supabase
      .from("personas")
      .select("id")
      .or(filtroPersona)
    personaIds = data?.map((p) => p.id) ?? []
  }

  const noResults = personaIds !== null && personaIds.length === 0

  // Cargar asignaciones activas desde asignaciones_ministerio, con la persona
  // embebida en la misma consulta (evita un segundo .in() con miles de ids).
  let asignaciones: any[] = []
  let totalCount = 0

  if (!noResults) {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from("asignaciones_ministerio")
      .select(
        `
      id,
      fecha_inicio,
      persona_id,
      persona:personas!persona_id(nombre, apellido, apodo, email),
      organizacion:organizaciones!organizacion_id(nombre),
      ministerio:ministerios!ministerio_id(nombre, tipo, nivel_acceso)
    `,
        { count: "exact" },
      )
      .eq("estado", "activo")
      .order("fecha_inicio", { ascending: false })
      .range(from, to)

    if (ministerioFiltro) {
      query = query.eq("ministerio_id", ministerioFiltro)
    }
    if (personaIds !== null) {
      query = query.in("persona_id", personaIds)
    }

    const { data, count } = await query
    asignaciones = data ?? []
    totalCount = count ?? 0
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const tipoLabel: Record<string, string> = {
    conduccion: "Conducción",
    pastoral: "Pastoral",
    servicio: "Servicio",
    sistema: "Sistema",
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <UserCheck className="h-8 w-8 text-primary" />
          Asignaciones de Roles
        </h1>
        <p className="mt-2 text-muted-foreground">
          Personas con roles activos asignados
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">
              Asignaciones Activas
            </CardTitle>
            <CardDescription>
              Gestiona los roles asignados a cada persona
            </CardDescription>
          </div>
          <Link href="/ministerios/asignaciones/nueva">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Asignación
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <form method="GET" className="flex gap-2">
            <div className="relative flex-1">
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre o email..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
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
              </button>
            </div>
            <select
              name="ministerio"
              defaultValue={ministerioFiltro ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Todos los roles </option>
              {(ministerios ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({tipoLabel[m.tipo] ?? m.tipo})
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Filtrar
            </Button>
          </form>

          {/* Tabla */}
          {asignaciones.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Persona
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Rol
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Organización
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Desde
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((a: any) => {
                    const persona = a.persona
                    const nombreCompleto = persona
                      ? nombreCompletoConApodo(persona)
                      : "Persona no encontrada"
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">
                            {nombreCompleto}
                          </div>
                          {persona?.email && (
                            <div className="text-xs text-muted-foreground">
                              {persona.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                            {a.ministerio?.nombre ?? "—"}
                          </span>
                          {a.ministerio?.tipo && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (
                              {tipoLabel[a.ministerio.tipo] ??
                                a.ministerio.tipo}
                              )
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {a.organizacion?.nombre ?? (
                            <span className="italic">Global</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {a.fecha_inicio ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/ministerios/asignaciones/${a.id}/editar`}>
                              <Button size="sm" variant="ghost" className="gap-1">
                                <Pencil className="h-3 w-3" />
                                Editar
                              </Button>
                            </Link>
                            <Link href={`/ministerios/asignaciones/${a.id}/revocar`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                Revocar
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
              <DataPagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                itemLabel="asignación"
                itemLabelPlural="asignaciones"
              />
            </>
          ) : (
            <div className="py-12 text-center">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {q || ministerioFiltro
                  ? "No se encontraron asignaciones"
                  : "No hay asignaciones activas"}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {q || ministerioFiltro
                  ? "Ajusta los filtros de búsqueda"
                  : "Asigna un rol a una persona para comenzar"}
              </p>
              {!q && !ministerioFiltro && (
                <Link
                  href="/ministerios/asignaciones/nueva"
                  className="mt-4 inline-block"
                >
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Asignación
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

export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { Calendar, MapPin, Mail, Phone, UserCheck, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserContext } from "@/lib/auth/context"
import { resolverAccesoInteresados } from "@/lib/interesados/access"
import { formatDateLong, formatDateAR } from "@/lib/utils"
import { apellidoNombreConApodo } from "@/lib/personas/nombre"
import { SeguimientoActions } from "./seguimiento-actions"
import { EventoFilter } from "./_components/evento-filter"

const contactoClases: Record<string, string> = {
  no_contactado: "bg-gray-100 text-gray-700",
  confirmado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
}

const contactoLabels: Record<string, string> = {
  no_contactado: "No contactado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
}

const CONTACTO_FILTROS = [
  { value: "", label: "Todos los estados" },
  { value: "no_contactado", label: "No contactado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
]

export default async function InteresadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; evento_id?: string; estado_contacto?: string }>
}) {
  const { q, evento_id, estado_contacto } = await searchParams
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx) redirect('/dashboard')

  // Enlace/Responsable (permiso de catálogo, scopeado a su organización) o
  // Coordinador/Centralizador de algún evento puntual. Mismo criterio que usa
  // el route handler que guarda el seguimiento.
  const { hasAccess, allowedEventoIds } = await resolverAccesoInteresados(supabase, ctx)
  if (!hasAccess) redirect('/dashboard')

  // Relational search by persona name/email → resolve matching persona ids
  let personaIds: string[] | null = null
  if (q) {
    const { data } = await supabase
      .from("personas")
      .select("id")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,apodo.ilike.%${q}%,email.ilike.%${q}%`)
    personaIds = data?.map((r) => r.id) ?? []
  }
  const noResults = personaIds !== null && personaIds.length === 0

  // Event dropdown options: events that have interesados (dentro de lo permitido)
  let eventoRowsQuery = supabase
    .from("evento_participantes")
    .select("evento:eventos!evento_id(id, nombre)")
    .eq("estado_participacion", "interesado")
  if (allowedEventoIds !== null) eventoRowsQuery = eventoRowsQuery.in("evento_id", allowedEventoIds)
  const { data: eventoRows } = await eventoRowsQuery
  const eventosMap = new Map<string, string>()
  for (const row of (eventoRows as any[]) ?? []) {
    if (row.evento?.id) eventosMap.set(row.evento.id, row.evento.nombre)
  }
  const eventoOptions = Array.from(eventosMap, ([id, nombre]) => ({ id, nombre })).sort(
    (a, b) => a.nombre.localeCompare(b.nombre),
  )

  let interesados: any[] = []
  if (!noResults) {
    let query = supabase
      .from("evento_participantes")
      .select(`
        id, fecha_inscripcion, notas,
        estado_contacto, medio_contacto, fecha_contacto, notas_seguimiento, pago_link_enviado_en,
        persona:personas!persona_id(id, nombre, apellido, apodo, email, telefono, localidad, provincia, pais),
        evento:eventos!evento_id(id, nombre, fecha_inicio, organizacion:organizaciones!organizacion_id(nombre))
      `)
      .eq("estado_participacion", "interesado")
      .order("fecha_inscripcion", { ascending: false })

    if (allowedEventoIds !== null) query = query.in("evento_id", allowedEventoIds)
    if (personaIds !== null) query = query.in("persona_id", personaIds)
    if (evento_id) query = query.eq("evento_id", evento_id)
    if (estado_contacto) query = query.eq("estado_contacto", estado_contacto)

    const { data } = await query
    interesados = data ?? []
  }

  const hasFilters = !!(q || evento_id || estado_contacto)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Interesados</h1>
        <p className="mt-1 text-muted-foreground">
          Personas que manifestaron interés en un evento. Registrá el seguimiento de contacto.
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
          name="estado_contacto"
          defaultValue={estado_contacto ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {CONTACTO_FILTROS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {hasFilters && (
          <Link href="/interesados" className="text-sm text-muted-foreground hover:text-foreground">
            Limpiar
          </Link>
        )}
      </form>

      {interesados.length > 0 ? (
        <div className="space-y-4">
          {interesados.map((it) => (
            <Card key={it.id} className="border-border">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {it.persona ? apellidoNombreConApodo(it.persona) : "—"}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${contactoClases[it.estado_contacto] ?? ""}`}
                      >
                        {contactoLabels[it.estado_contacto] ?? it.estado_contacto}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {it.evento?.nombre}
                        {it.evento?.fecha_inicio ? ` (${formatDateAR(it.evento.fecha_inicio)})` : ""}
                        {it.evento?.organizacion?.nombre ? ` · ${it.evento.organizacion.nombre}` : ""}
                      </p>
                      {it.persona?.email && (
                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {it.persona.email}
                        </p>
                      )}
                      {it.persona?.telefono && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {it.persona.telefono}
                        </p>
                      )}
                      {(it.persona?.localidad || it.persona?.provincia) && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {[it.persona.localidad, it.persona.provincia, it.persona.pais]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>

                    {it.notas && (
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground">Notas del interesado:</p>
                        <p className="text-sm text-foreground">{it.notas}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Interesado desde: {formatDateLong(it.fecha_inscripcion)}
                      {it.fecha_contacto
                        ? ` · Último contacto: ${formatDateLong(it.fecha_contacto)}`
                        : ""}
                      {it.pago_link_enviado_en
                        ? ` · Link de pago enviado: ${formatDateLong(it.pago_link_enviado_en)}`
                        : ""}
                    </p>
                  </div>

                  <SeguimientoActions
                    participanteId={it.id}
                    estadoContacto={it.estado_contacto}
                    medioContacto={it.medio_contacto}
                    notasSeguimiento={it.notas_seguimiento}
                    email={it.persona?.email ?? null}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">Sin interesados</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "No hay interesados que coincidan con los filtros."
                : "Aún no hay personas que hayan manifestado interés."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

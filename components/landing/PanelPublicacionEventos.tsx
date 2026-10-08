"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarDays, MapPin, Users, Building2, Home } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"

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

const ESTADO_LABELS: Record<string, string> = {
  publicado: "Publicado",
  suspendido: "Suspendido",
}

const ESTADO_BADGE: Record<string, string> = {
  publicado: "bg-green-100 text-green-700 border-green-200",
  suspendido: "bg-orange-100 text-orange-800 border-orange-200",
}

function formatDateRange(inicio: string, fin: string) {
  const start = new Date(inicio + "T00:00:00")
  const end = new Date(fin + "T00:00:00")
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
  const locale = "es-AR"
  if (inicio === fin) return start.toLocaleDateString(locale, opts)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} al ${end.toLocaleDateString(locale, opts)}`
  }
  return `${start.toLocaleDateString(locale, { day: "numeric", month: "long" })} al ${end.toLocaleDateString(locale, opts)}`
}

export interface PanelEvento {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string
  fecha_fin: string
  ciudad?: string | null
  provincia_evento?: string | null
  modalidad?: string | null
  cupo_maximo?: number | null
  flyer_horizontal_url?: string | null
  flyer_cuadrado_url?: string | null
  organizacion?: { nombre: string } | null
  fraternidad?: { nombre: string } | null
  casa_retiro?: { nombre: string } | null
}

export interface OrgOption {
  id: string
  nombre: string
}

export interface PanelFilters {
  fecha_desde?: string
  fecha_hasta?: string
  confraternidad?: string
  fraternidad?: string
  casa_retiro?: string
  provincia?: string
  ciudad?: string
  estado?: string
}

interface Props {
  eventos: PanelEvento[]
  filters: PanelFilters
  confraternidades: OrgOption[]
  fraternidades: OrgOption[]
  casas: OrgOption[]
  provincias: string[]
  ciudades: string[]
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"

export function PanelPublicacionEventos({
  eventos,
  filters,
  confraternidades,
  fraternidades,
  casas,
  provincias,
  ciudades,
}: Props) {
  const hasFilters = Object.values(filters).some(Boolean)

  const [confraternidad, setConfraternidad] = useState(filters.confraternidad ?? "")
  const [fraternidad, setFraternidad] = useState(filters.fraternidad ?? "")
  const [casaRetiro, setCasaRetiro] = useState(filters.casa_retiro ?? "")
  const [provincia, setProvincia] = useState(filters.provincia ?? "")
  const [ciudad, setCiudad] = useState(filters.ciudad ?? "")

  const confraternidadOptions: ComboboxOption[] = confraternidades.map((c) => ({ label: c.nombre, value: c.id }))
  const fraternidadOptions: ComboboxOption[] = fraternidades.map((f) => ({ label: f.nombre, value: f.id }))
  const casaOptions: ComboboxOption[] = casas.map((c) => ({ label: c.nombre, value: c.id }))
  const provinciaOptions: ComboboxOption[] = provincias.map((p) => ({ label: p, value: p }))
  const ciudadOptions: ComboboxOption[] = ciudades.map((c) => ({ label: c, value: c }))

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <form
        method="GET"
        action="#panel-eventos"
        className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Confraternidad</label>
          <input type="hidden" name="confraternidad" value={confraternidad} />
          <Combobox
            value={confraternidad}
            onSelect={setConfraternidad}
            options={confraternidadOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar confraternidad..."
            emptyText="No se encontraron confraternidades."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Fraternidad</label>
          <input type="hidden" name="fraternidad" value={fraternidad} />
          <Combobox
            value={fraternidad}
            onSelect={setFraternidad}
            options={fraternidadOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar fraternidad..."
            emptyText="No se encontraron fraternidades."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Casa de retiros</label>
          <input type="hidden" name="casa_retiro" value={casaRetiro} />
          <Combobox
            value={casaRetiro}
            onSelect={setCasaRetiro}
            options={casaOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar casa de retiros..."
            emptyText="No se encontraron casas de retiro."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Estado</label>
          <select name="estado" defaultValue={filters.estado ?? ""} className={inputClass}>
            <option value="">Publicados y suspendidos</option>
            <option value="publicado">Publicado</option>
            <option value="suspendido">Suspendido</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Provincia</label>
          <input type="hidden" name="provincia" value={provincia} />
          <Combobox
            value={provincia}
            onSelect={setProvincia}
            options={provinciaOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar provincia..."
            emptyText="No se encontraron provincias."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
          <input type="hidden" name="ciudad" value={ciudad} />
          <Combobox
            value={ciudad}
            onSelect={setCiudad}
            options={ciudadOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar ciudad..."
            emptyText="No se encontraron ciudades."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <input type="date" name="fecha_desde" defaultValue={filters.fecha_desde ?? ""} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input type="date" name="fecha_hasta" defaultValue={filters.fecha_hasta ?? ""} className={inputClass} />
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
          {hasFilters && (
            <Link
              href="/#panel-eventos"
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Limpiar
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-muted-foreground">
            {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
      </form>

      {/* Resultados */}
      {eventos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-8 py-16 text-center text-muted-foreground">
          No se encontraron eventos con esos filtros.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((evento) => {
            const flyerH = evento.flyer_horizontal_url ?? null
            const flyerC = evento.flyer_cuadrado_url ?? null
            const ubicacion = [evento.ciudad, evento.provincia_evento].filter(Boolean).join(", ")
            const isPublicado = evento.estado === "publicado"
            return (
              <Card
                key={evento.id}
                className={`flex flex-col overflow-hidden ${evento.estado === "suspendido" ? "opacity-80" : ""}`}
              >
                {(flyerH || flyerC) && (
                  <div className={`relative ${evento.estado === "suspendido" ? "grayscale" : ""}`}>
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
                  <div className="flex flex-wrap items-start gap-2">
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {TIPO_LABELS[evento.tipo] ?? evento.tipo}
                    </Badge>
                    <Badge variant="outline" className={`shrink-0 ${ESTADO_BADGE[evento.estado] ?? ""}`}>
                      {ESTADO_LABELS[evento.estado] ?? evento.estado}
                    </Badge>
                    {evento.modalidad && evento.modalidad !== "presencial" && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {MODALIDAD_LABELS[evento.modalidad] ?? evento.modalidad}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base leading-snug line-clamp-2">{evento.nombre}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{formatDateRange(evento.fecha_inicio, evento.fecha_fin)}</span>
                  </div>
                  {ubicacion && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{ubicacion}</span>
                    </div>
                  )}
                  {evento.casa_retiro?.nombre && (
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{evento.casa_retiro.nombre}</span>
                    </div>
                  )}
                  {evento.cupo_maximo && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Cupo: {evento.cupo_maximo} personas</span>
                    </div>
                  )}
                  {(evento.organizacion?.nombre || evento.fraternidad?.nombre) && (
                    <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground/70">
                      <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {[evento.organizacion?.nombre, evento.fraternidad?.nombre].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="mt-auto pt-3">
                  {isPublicado ? (
                    <Button size="sm" className="w-full" asChild>
                      <Link href={`/e/${evento.id}`}>Más información</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      Evento suspendido
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

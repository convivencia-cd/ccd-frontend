"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/**
 * Card #47 — en la asignación del ministerio Coordinador se tildan los tipos de
 * evento que esa persona puede coordinar (tabla asignacion_ministerio_tipos_evento,
 * migración 103). Solo esos aparecen en los desplegables de coordinador.
 */

export type TipoEventoOpcion = {
  id: string
  nombre: string
  categoria: string
  activo: boolean
}

const CATEGORIA_LABEL: Record<string, string> = {
  convivencia: "Convivencias",
  retiro: "Retiros",
  taller: "Talleres",
  encuentro: "Encuentros",
  otro: "Otros",
}
const ORDEN_CATEGORIAS = ["convivencia", "retiro", "taller", "encuentro", "otro"]

export async function cargarTiposEvento(supabase: SupabaseClient): Promise<TipoEventoOpcion[]> {
  const { data } = await supabase
    .from("tipos_eventos")
    .select("id, nombre, categoria, activo")
    .order("nombre")
  return (data ?? []) as TipoEventoOpcion[]
}

export async function cargarTiposDeAsignacion(supabase: SupabaseClient, asignacionId: string): Promise<string[]> {
  const { data } = await supabase
    .from("asignacion_ministerio_tipos_evento")
    .select("tipo_evento_id")
    .eq("asignacion_id", asignacionId)
  return (data ?? []).map((r: { tipo_evento_id: string }) => r.tipo_evento_id)
}

/** Deja tildados exactamente `seleccionados` para la asignación. */
export async function guardarTiposDeAsignacion(
  supabase: SupabaseClient,
  asignacionId: string,
  seleccionados: string[],
): Promise<string | null> {
  const actuales = await cargarTiposDeAsignacion(supabase, asignacionId)
  const quitar = actuales.filter(id => !seleccionados.includes(id))
  const agregar = seleccionados.filter(id => !actuales.includes(id))

  if (quitar.length > 0) {
    const { error } = await supabase
      .from("asignacion_ministerio_tipos_evento")
      .delete()
      .eq("asignacion_id", asignacionId)
      .in("tipo_evento_id", quitar)
    if (error) return error.message
  }
  if (agregar.length > 0) {
    const { error } = await supabase
      .from("asignacion_ministerio_tipos_evento")
      .insert(agregar.map(tipo_evento_id => ({ asignacion_id: asignacionId, tipo_evento_id })))
    if (error) return error.message
  }
  return null
}

export function TiposEventoCoordinador({
  tipos,
  value,
  onChange,
}: {
  tipos: TipoEventoOpcion[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  // Los tipos inactivos solo se muestran si ya estaban tildados.
  const visibles = tipos.filter(t => t.activo || value.includes(t.id))
  const categorias = [
    ...ORDEN_CATEGORIAS.filter(c => visibles.some(t => t.categoria === c)),
    ...[...new Set(visibles.map(t => t.categoria))].filter(c => !ORDEN_CATEGORIAS.includes(c)),
  ]

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter(x => x !== id))

  const toggleCategoria = (categoria: string, checked: boolean) => {
    const ids = visibles.filter(t => t.categoria === categoria).map(t => t.id)
    onChange(checked ? [...new Set([...value, ...ids])] : value.filter(x => !ids.includes(x)))
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Tipos de evento que puede coordinar *</p>
        <p className="text-xs text-muted-foreground">
          Al solicitar o aprobar un evento, solo aparece como coordinador en los tipos tildados acá.
        </p>
      </div>
      {categorias.map(categoria => {
        const items = visibles.filter(t => t.categoria === categoria)
        const todos = items.every(t => value.includes(t.id))
        return (
          <div key={categoria} className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`cat-${categoria}`}
                checked={todos}
                onCheckedChange={c => toggleCategoria(categoria, c === true)}
              />
              <Label htmlFor={`cat-${categoria}`} className="text-xs uppercase tracking-wide text-muted-foreground">
                {CATEGORIA_LABEL[categoria] ?? categoria}
              </Label>
            </div>
            <div className="grid gap-2 pl-6 sm:grid-cols-2">
              {items.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`tipo-${t.id}`}
                    checked={value.includes(t.id)}
                    onCheckedChange={c => toggle(t.id, c === true)}
                  />
                  <Label htmlFor={`tipo-${t.id}`} className="text-sm font-normal">
                    {t.nombre}
                    {!t.activo && <span className="text-muted-foreground"> (inactivo)</span>}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, OctagonX } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { formatDateAR } from "@/lib/utils"
import SuspenderEventoButton from "../[id]/_components/suspender-evento-button"

const ESTADOS_TERMINALES = ["suspendido", "cancelado", "finalizado", "rechazado"]

const tipoLabel: Record<string, string> = {
  convivencia: "Convivencia",
  retiro: "Retiro corto",
  taller: "Taller",
  encuentro: "Encuentro",
}

type EventoRow = {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string
  fecha_fin: string
  organizacion: { nombre: string } | null
}

export default async function SuspenderEventosPage() {
  const ctx = await getUserContext()
  if (!ctx || !canPerform(ctx, "event.suspend")) redirect("/eventos")

  const supabase = await createClient()

  let query = supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, estado, fecha_inicio, fecha_fin, organizacion:organizaciones!organizacion_id(nombre)",
    )
    .not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`)
    .order("fecha_inicio", { ascending: false })

  // Acotar por organizaciones del usuario salvo que sea admin/global.
  if (!ctx.is_admin && ctx.org_ids.length > 0) {
    query = query.in("organizacion_id", ctx.org_ids)
  }

  const { data } = await query
  const eventos = (data ?? []) as unknown as EventoRow[]

  return (
    <div className="space-y-6">
      <Link
        href="/eventos"
        className="inline-flex items-center gap-2 text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Eventos
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <OctagonX className="h-6 w-6 text-orange-600" />
          Suspender Evento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suspendé un evento indicando el motivo. La suspensión es definitiva y no puede revertirse.
        </p>
      </div>

      {eventos.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No hay eventos disponibles para suspender.
        </p>
      ) : (
        <div className="space-y-4">
          {eventos.map((evento) => (
            <div
              key={evento.id}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/eventos/${evento.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {evento.nombre}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{tipoLabel[evento.tipo] ?? evento.tipo}</span>
                    <span>
                      {formatDateAR(evento.fecha_inicio)} — {formatDateAR(evento.fecha_fin)}
                    </span>
                    {evento.organizacion && <span>{evento.organizacion.nombre}</span>}
                  </div>
                </div>
              </div>
              <SuspenderEventoButton eventoId={evento.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

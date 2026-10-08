import { Calendar, MapPin, Mail, Phone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateLong, formatDateAR } from "@/lib/utils"
import { apellidoNombreConApodo } from "@/lib/personas/nombre"
import { SeguimientoActions } from "../seguimiento-actions"

export const contactoClases: Record<string, string> = {
  no_contactado: "bg-gray-100 text-gray-700",
  confirmado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
}

export const contactoLabels: Record<string, string> = {
  no_contactado: "No contactado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
}

/** Columnas de evento_participantes que necesita la tarjeta. */
export const INTERESADO_SELECT = `
  id, fecha_inscripcion, notas,
  estado_contacto, medio_contacto, fecha_contacto, notas_seguimiento, pago_link_enviado_en,
  persona:personas!persona_id(id, nombre, apellido, apodo, email, telefono, localidad, provincia, pais),
  evento:eventos!evento_id(id, nombre, fecha_inicio, organizacion:organizaciones!organizacion_id(nombre))
`

/**
 * Tarjeta de un interesado con su seguimiento de contacto. La usan /interesados
 * y la sección Interesados del detalle del evento.
 */
export function InteresadoCard({
  it,
  mostrarEvento = true,
}: {
  it: any
  /** En el detalle del evento la línea del evento sobra. */
  mostrarEvento?: boolean
}) {
  return (
    <Card className="border-border">
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
              {mostrarEvento && (
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {it.evento?.nombre}
                  {it.evento?.fecha_inicio ? ` (${formatDateAR(it.evento.fecha_inicio)})` : ""}
                  {it.evento?.organizacion?.nombre ? ` · ${it.evento.organizacion.nombre}` : ""}
                </p>
              )}
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
  )
}

export const dynamic = 'force-dynamic'

import { Calendar, User } from "lucide-react"
import { formatDateLong } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { RegistrationActions } from "./registration-actions"

const estadoClases: Record<string, string> = {
  interesado: "bg-yellow-100 text-yellow-800",
  inscripto: "bg-green-100 text-green-800",
  en_curso: "bg-blue-100 text-blue-800",
  completado: "bg-gray-100 text-gray-700",
  cancelado: "bg-red-100 text-red-800",
  lista_espera: "bg-purple-100 text-purple-800",
}

const estadoLabels: Record<string, string> = {
  interesado: "Interesado",
  inscripto: "Inscripto",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
  lista_espera: "Lista de Espera",
}

const tipoClases: Record<string, string> = {
  cecista: "bg-indigo-100 text-indigo-800",
  no_cecista: "bg-orange-100 text-orange-800",
}

const tipoLabels: Record<string, string> = {
  cecista: "Cecista",
  no_cecista: "No cecista",
}

async function getInscripciones() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("evento_participantes")
    .select(`
      id, estado_participacion, tipo_participante, rol_en_evento, fecha_inscripcion, notas,
      persona:personas!persona_id(id, nombre, apellido, email, telefono),
      evento:eventos!evento_id(nombre, fecha_inicio)
    `)
    .order("fecha_inscripcion", { ascending: false })

  return data || []
}

export default async function AdminRegistrationsPage() {
  const inscripciones = await getInscripciones()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Inscripciones</h1>
        <p className="mt-1 text-muted-foreground">Gestiona todas las inscripciones a retiros</p>
      </div>

      {inscripciones.length > 0 ? (
        <div className="space-y-4">
          {inscripciones.map((insc: any) => (
            <Card key={insc.id} className="border-border">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {insc.persona
                          ? `${insc.persona.apellido}, ${insc.persona.nombre}`
                          : "—"}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoClases[insc.estado_participacion] ?? ""}`}>
                        {estadoLabels[insc.estado_participacion] ?? insc.estado_participacion}
                      </span>
                      {insc.tipo_participante && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tipoClases[insc.tipo_participante] ?? ""}`}>
                          {tipoLabels[insc.tipo_participante] ?? insc.tipo_participante}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {insc.evento?.nombre}{insc.evento?.fecha_inicio ? ` (${insc.evento.fecha_inicio})` : ""}
                      </p>
                      {insc.persona?.email && (
                        <p>{insc.persona.email}</p>
                      )}
                      {insc.persona?.telefono && (
                        <p>{insc.persona.telefono}</p>
                      )}
                      <p>Rol: {insc.rol_en_evento}</p>
                    </div>

                    {insc.notas && (
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground">Notas:</p>
                        <p className="text-sm text-foreground">{insc.notas}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Inscripto: {formatDateLong(insc.fecha_inscripcion)}
                    </p>
                  </div>

                  <RegistrationActions
                    participanteId={insc.id}
                    personaId={insc.persona?.id ?? ""}
                    currentStatus={insc.estado_participacion}
                    tipoParticipante={insc.tipo_participante}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">Sin inscripciones</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Aún no hay inscripciones registradas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

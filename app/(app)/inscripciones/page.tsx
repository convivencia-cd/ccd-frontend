export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, MapPin, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { formatDateAR } from '@/lib/utils'
import { InscripcionQr } from './inscripcion-qr'

const estadoClases: Record<string, string> = {
  interesado: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  inscripto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  en_curso: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  completado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  lista_espera: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const estadoLabel: Record<string, string> = {
  interesado: 'Interesado',
  inscripto: 'Inscripto',
  en_curso: 'Presente',
  completado: 'Completado',
  cancelado: 'Cancelado',
  lista_espera: 'Lista de espera',
}

export default async function InscripcionesPage() {
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])
  if (!ctx) redirect('/auth/login')

  type InscripcionRow = {
    id: string
    estado_participacion: string
    rol_en_evento: string
    fecha_inscripcion: string | null
    evento: {
      id: string
      nombre: string
      fecha_inicio: string | null
      ciudad: string | null
      provincia_evento: string | null
    } | null
  }

  let inscripciones: InscripcionRow[] = []
  if (ctx.persona_id) {
    const { data } = await supabase
      .from('evento_participantes')
      .select(`
        id, estado_participacion, rol_en_evento, fecha_inscripcion,
        evento:eventos!evento_id(id, nombre, fecha_inicio, ciudad, provincia_evento)
      `)
      .eq('persona_id', ctx.persona_id)
      .order('fecha_inscripcion', { ascending: false })

    inscripciones = ((data as unknown as InscripcionRow[]) ?? []).map((r) => ({
      ...r,
      evento: Array.isArray(r.evento) ? (r.evento[0] ?? null) : r.evento,
    }))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Mis Inscripciones
        </h1>
        <p className="mt-2 text-muted-foreground">
          Tus inscripciones a retiros. Mostrá el QR al ingresar.
        </p>
      </div>

      {inscripciones.length > 0 ? (
        <div className="space-y-4">
          {inscripciones.map((it) => (
            <Card key={it.id} className="border-border">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {it.evento?.nombre ?? 'Retiro'}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoClases[it.estado_participacion] ?? ''}`}
                    >
                      {estadoLabel[it.estado_participacion] ?? it.estado_participacion}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {it.evento?.fecha_inicio && (
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDateAR(it.evento.fecha_inicio)}
                      </p>
                    )}
                    {(it.evento?.ciudad || it.evento?.provincia_evento) && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {[it.evento?.ciudad, it.evento?.provincia_evento].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {it.estado_participacion === 'inscripto' && (
                    <InscripcionQr
                      participanteId={it.id}
                      eventoNombre={it.evento?.nombre ?? 'Retiro'}
                    />
                  )}
                  {it.evento?.id && (
                    <Link
                      href={`/eventos/${it.evento.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Ver retiro
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-6">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Sin inscripciones</EmptyTitle>
                <EmptyDescription>
                  Todavía no tenés inscripciones a retiros.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

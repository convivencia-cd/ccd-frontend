export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { Calendar, MapPin, Users, Globe } from 'lucide-react'
import { formatDateAR } from '@/lib/utils'

const tipoLabel: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro',
  taller: 'Taller',
}

const tipoBadgeClases: Record<string, string> = {
  convivencia: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  retiro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  taller: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

type EventoPublicado = {
  id: string
  nombre: string
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  modalidad: string | null
  cupo_maximo: number | null
  ciudad: string | null
  provincia_evento: string | null
  organizacion: { nombre: string } | null
  fraternidad: { nombre: string } | null
}

export default async function EventosPublicadosPage() {
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx || !canPerform(ctx, 'view.eventos_publicados')) {
    redirect('/dashboard')
  }

  const { data } = await supabase
    .from('eventos')
    .select(`
      id, nombre, tipo, fecha_inicio, fecha_fin, modalidad, cupo_maximo,
      ciudad, provincia_evento,
      organizacion:organizaciones!organizacion_id(nombre),
      fraternidad:organizaciones!fraternidad_id(nombre)
    `)
    .eq('estado', 'publicado')
    .order('fecha_inicio', { ascending: true })

  const eventos = (data ?? []) as unknown as EventoPublicado[]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Globe className="h-8 w-8 text-green-600" />
          Eventos Publicados
        </h1>
        <p className="mt-2 text-muted-foreground">
          Eventos aprobados y disponibles para la comunidad
        </p>
      </div>

      {/* Cards grid */}
      {eventos.length > 0 ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {eventos.map((evento) => {
            const org = evento.organizacion as { nombre: string } | null
            const fraternidad = evento.fraternidad as { nombre: string } | null
            const ubicacion = [evento.ciudad, evento.provincia_evento].filter(Boolean).join(', ')

            return (
              <div
                key={evento.id}
                className="flex flex-col rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-700 transition-all"
              >
                {/* Card header */}
                <div className="p-5 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadgeClases[evento.tipo] ?? 'bg-gray-100 text-gray-700'}`}>
                      {tipoLabel[evento.tipo] ?? evento.tipo}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground leading-snug">
                    {evento.nombre}
                  </h2>
                </div>

                {/* Card body */}
                <div className="px-5 pb-4 flex-1 space-y-2.5 text-sm text-muted-foreground">
                  {/* Fechas */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-green-600" />
                    <span>{formatDateAR(evento.fecha_inicio)} — {formatDateAR(evento.fecha_fin)}</span>
                  </div>

                  {/* Organización */}
                  {(org || fraternidad) && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {fraternidad?.nombre ?? org?.nombre}
                        {fraternidad && org && (
                          <span className="text-xs ml-1 opacity-70">· {org.nombre}</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Ubicación */}
                  {ubicacion && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{ubicacion}</span>
                    </div>
                  )}

                  {/* Modalidad + Cupo */}
                  {(evento.modalidad || evento.cupo_maximo) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {evento.modalidad && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize">
                          {evento.modalidad}
                        </span>
                      )}
                      {evento.cupo_maximo && (
                        <span className="text-xs">
                          Cupo: {evento.cupo_maximo}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="px-5 pb-5 pt-3 border-t border-border">
                  <Link
                    // Un Participante (convivente no cecista) no entra a la ficha
                    // interna: va a la página pública, donde puede anotarse.
                    href={ctx.es_interno ? `/eventos/${evento.id}` : `/e/${evento.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                  >
                    Ver detalles
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <Globe className="mx-auto h-14 w-14 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No hay eventos publicados actualmente
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando un evento sea aprobado y publicado, aparecerá aquí.
          </p>
        </div>
      )}
    </div>
  )
}

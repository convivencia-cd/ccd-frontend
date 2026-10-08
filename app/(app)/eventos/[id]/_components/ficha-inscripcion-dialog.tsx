'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  labelComoSeEntero,
  labelEstadoCivil,
  labelEstadoEclesial,
  labelNivelEstudios,
  labelRangoEclesial,
  labelRestriccion,
  labelSexo,
  type InscripcionDatos,
} from '@/lib/eventos/inscripcion-datos'
import { formatDateAR } from '@/lib/utils'

type PersonaFicha = Record<string, string | null>

type Ficha = {
  persona: PersonaFicha | null
  inscripcion: InscripcionDatos | null
  realizados: { nombre: string; anio: number | null }[]
  verSensibles: boolean
}

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-foreground">{valor?.trim() ? valor : '—'}</dd>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * Ficha de inscripción de un participante (datos del Excel de la card #42).
 * La dieta y las observaciones de salud solo llegan del servidor si quien mira
 * puede verlas; si no, se avisa que están ocultas.
 */
export default function FichaInscripcionDialog({
  eventoId,
  participanteId,
  nombre,
  onClose,
}: {
  eventoId: string
  /** `null` = cerrado. */
  participanteId: string | null
  nombre: string
  onClose: () => void
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!participanteId) return
    let cancelado = false
    setFicha(null)
    setError('')
    fetch(`/api/eventos/${eventoId}/participantes/${participanteId}/inscripcion`)
      .then(async res => {
        const data = await res.json()
        if (cancelado) return
        if (!res.ok) setError(data.error ?? 'No se pudo cargar la ficha')
        else setFicha(data as Ficha)
      })
      .catch(() => {
        if (!cancelado) setError('Error de conexión')
      })
    return () => {
      cancelado = true
    }
  }, [eventoId, participanteId])

  const p = ficha?.persona
  const i = ficha?.inscripcion

  return (
    <Dialog open={participanteId !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ficha de inscripción</DialogTitle>
          <DialogDescription>{nombre}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !ficha && <p className="text-sm text-muted-foreground">Cargando...</p>}

        {ficha && (
          <div className="space-y-6">
            <Bloque titulo="Datos personales">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Dato label="Sobrenombre" valor={p?.apodo} />
                <Dato label="Sexo" valor={labelSexo(p?.sexo)} />
                <Dato
                  label="Documento"
                  valor={[p?.tipo_documento?.toUpperCase(), p?.documento].filter(Boolean).join(' ')}
                />
                <Dato label="Fecha de nacimiento" valor={p?.fecha_nacimiento ? formatDateAR(p.fecha_nacimiento) : null} />
                <Dato label="Estado civil" valor={labelEstadoCivil(p?.estado_vida)} />
                <Dato label="Nacionalidad" valor={p?.nacionalidad} />
                <Dato label="Nivel de estudios" valor={labelNivelEstudios(p?.nivel_estudios)} />
                <Dato label="Ocupación o profesión" valor={p?.ocupacion} />
              </dl>
            </Bloque>

            <Bloque titulo="Contacto y domicilio">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Dato label="Teléfono" valor={p?.telefono} />
                <Dato label="Email" valor={p?.email} />
                <Dato label="Domicilio" valor={[p?.direccion, p?.direccion_nro].filter(Boolean).join(' ')} />
                <Dato
                  label="Localidad"
                  valor={[p?.localidad, p?.provincia, p?.pais].filter(Boolean).join(', ')}
                />
                <Dato label="Código postal" valor={p?.codigo_postal} />
              </dl>
            </Bloque>

            <Bloque titulo="Vida de fe">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Dato
                  label="Estado eclesial"
                  valor={[
                    labelEstadoEclesial(p?.estado_eclesial),
                    labelRangoEclesial(p?.estado_eclesial_rango),
                    p?.institucion_religiosa,
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                />
                <Dato label="Diócesis" valor={p?.diocesis} />
              </dl>
              <dl className="grid gap-3">
                <Dato label="Formación religiosa" valor={p?.formacion_religiosa} />
                <Dato label="Participación en grupos de la Iglesia" valor={p?.participacion_grupos_iglesia} />
                <Dato label="Acción social" valor={p?.accion_social} />
                <Dato
                  label="Convivencias realizadas"
                  valor={(ficha.realizados ?? [])
                    .map(c => (c.anio ? `${c.nombre} (${c.anio})` : c.nombre))
                    .join('\n')}
                />
              </dl>
            </Bloque>

            <Bloque titulo="Sobre esta convivencia">
              {!i ? (
                <p className="text-sm text-muted-foreground">
                  Esta persona todavía no completó las preguntas de la inscripción.
                </p>
              ) : (
                <dl className="grid gap-3">
                  <Dato
                    label="¿Cómo se enteró?"
                    valor={[labelComoSeEntero(i.como_se_entero), i.como_se_entero_otro].filter(Boolean).join(' — ')}
                  />
                  <Dato
                    label="¿Alguien de su familia hizo convivencias?"
                    valor={
                      i.familia_hizo_convivencias == null
                        ? null
                        : i.familia_hizo_convivencias
                          ? ['Sí', i.familia_quien].filter(Boolean).join(' — ')
                          : 'No'
                    }
                  />
                  <Dato label="Asiste con" valor={i.acompanante} />
                  <Dato label="Dificultad con el horario de llegada o salida" valor={i.dificultad_horario} />
                  <Dato
                    label="Restricciones alimentarias"
                    valor={i.restricciones_alimentarias.map(labelRestriccion).join(', ')}
                  />
                  {ficha.verSensibles ? (
                    <>
                      <Dato label="Detalle de la dieta" valor={i.dieta_detalle} />
                      <Dato label="Salud / algo importante a saber" valor={i.salud_observaciones} />
                    </>
                  ) : (
                    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      El detalle de la dieta y las observaciones de salud solo los ven el coordinador y los
                      centralizadores del evento, y quien tenga ese permiso asignado.
                    </p>
                  )}
                </dl>
              )}
            </Bloque>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PersonaCombobox, type PersonaOption } from '@/components/persona-combobox'
import { ClipboardList, Plus, UserMinus, Users } from 'lucide-react'
import { ESTADOS_PARTICIPACION_OPCIONES, ROLES_SERVIDOR_OPCIONES } from '@/lib/eventos/equipo'
import { formatDateAR } from '@/lib/utils'

export type ParticipanteEquipo = {
  id: string
  persona_id: string
  rol_en_evento: string
  estado_participacion: string
  fecha_inscripcion: string | null
  notas: string | null
  persona: { id: string; nombre: string; apellido: string; email: string | null; telefono: string | null } | null
}

const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'
const selectClass = 'rounded border border-border bg-background px-2 py-1 text-sm text-foreground'

function nombreDe(p: ParticipanteEquipo): string {
  return p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—'
}

/**
 * Padrón del evento (`evento_participantes`). En modo `equipo` lista a los
 * servidores y deja cambiarles el rol; en modo `inscriptos`, a los conviventes.
 * La baja es lógica: el participante pasa a "Cancelado" y la fila queda.
 */
export default function ParticipantesEventoCard({
  eventoId,
  modo,
  filas,
  personas,
  cargandoPersonas,
  onChanged,
}: {
  eventoId: string
  modo: 'equipo' | 'inscriptos'
  filas: ParticipanteEquipo[]
  personas: PersonaOption[]
  cargandoPersonas: boolean
  onChanged: () => void
}) {
  const esEquipo = modo === 'equipo'

  const [nuevaPersona, setNuevaPersona] = useState('')
  const [nuevoRol, setNuevoRol] = useState('equipo_auxiliar')
  const [nuevoEstado, setNuevoEstado] = useState('inscripto')
  const [nuevasNotas, setNuevasNotas] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aBaja, setABaja] = useState<ParticipanteEquipo | null>(null)

  const activos = filas.filter(p => p.estado_participacion !== 'cancelado')
  const dadosDeBaja = filas.filter(p => p.estado_participacion === 'cancelado')

  const conteo = {
    interesado: activos.filter(p => p.estado_participacion === 'interesado').length,
    inscripto: activos.filter(p => p.estado_participacion === 'inscripto').length,
    en_curso: activos.filter(p => p.estado_participacion === 'en_curso').length,
  }

  async function agregar() {
    if (!nuevaPersona) {
      setError('Seleccioná una persona')
      return
    }
    setAgregando(true)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: nuevaPersona,
          rol_en_evento: esEquipo ? nuevoRol : 'convivente',
          estado_participacion: nuevoEstado,
          notas: nuevasNotas || null,
        }),
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Error al agregar')
      }
      setNuevaPersona('')
      setNuevasNotas('')
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setAgregando(false)
    }
  }

  async function actualizar(participanteId: string, cambios: Record<string, unknown>) {
    setOcupado(participanteId)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/participantes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participante_id: participanteId, ...cambios }),
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Error al actualizar')
      }
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setOcupado(null)
    }
  }

  async function darDeBaja(participanteId: string) {
    setOcupado(participanteId)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/participantes?participante_id=${participanteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Error al dar de baja')
      }
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          {esEquipo ? <ClipboardList className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
          {esEquipo ? 'Equipo del Evento' : 'Inscriptos'}
        </CardTitle>
        <CardDescription>
          {esEquipo
            ? `${activos.length} servidores. Las funciones sin rol propio (cocina, enfermería, librería…) se cargan como Equipo Auxiliar y se detallan en la nota.`
            : `${conteo.interesado} interesados · ${conteo.inscripto} inscriptos · ${conteo.en_curso} convivientes`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {esEquipo ? 'Todavía no hay equipo cargado.' : 'Todavía no hay inscriptos.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Apellido, Nombre</th>
                  {esEquipo ? (
                    <th className="px-3 py-2 font-medium">Rol</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 font-medium">Contacto</th>
                      <th className="px-3 py-2 font-medium">Fecha inscripción</th>
                    </>
                  )}
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  <th className="px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activos.map(p => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium text-foreground">{nombreDe(p)}</td>
                    {esEquipo ? (
                      <td className="px-3 py-2">
                        <select
                          className={selectClass}
                          value={p.rol_en_evento}
                          disabled={ocupado === p.id}
                          onChange={e => actualizar(p.id, { rol_en_evento: e.target.value })}
                        >
                          {ROLES_SERVIDOR_OPCIONES.map(r => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.persona?.telefono ?? p.persona?.email ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.fecha_inscripcion ? formatDateAR(p.fecha_inscripcion) : '—'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      <select
                        className={selectClass}
                        value={p.estado_participacion}
                        disabled={ocupado === p.id}
                        onChange={e => actualizar(p.id, { estado_participacion: e.target.value })}
                      >
                        {ESTADOS_PARTICIPACION_OPCIONES.map(e => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.notas ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        disabled={ocupado === p.id}
                        onClick={() => setABaja(p)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Dar de baja
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dadosDeBaja.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {dadosDeBaja.length} dados de baja: {dadosDeBaja.map(nombreDe).join(' · ')}. Se reactivan volviéndolos a
            agregar acá abajo.
          </p>
        )}

        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">
            {esEquipo ? 'Sumar al equipo' : 'Agregar inscripto'}
          </p>
          <PersonaCombobox
            value={nuevaPersona}
            personas={personas}
            onChange={setNuevaPersona}
            placeholder={cargandoPersonas ? "Cargando personas..." : "Buscar persona..."}
            disabled={cargandoPersonas}
          />
          <div className="flex flex-wrap items-center gap-2">
            {esEquipo && (
              <select className={selectClass} value={nuevoRol} onChange={e => setNuevoRol(e.target.value)}>
                {ROLES_SERVIDOR_OPCIONES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
            <select className={selectClass} value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
              {ESTADOS_PARTICIPACION_OPCIONES.filter(e => e.value !== 'cancelado').map(e => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} min-w-40 flex-1`}
              value={nuevasNotas}
              placeholder={esEquipo ? 'Función o nota (ej.: cocina)' : 'Nota (opcional)'}
              onChange={e => setNuevasNotas(e.target.value)}
            />
            <Button size="sm" className="gap-1" onClick={agregar} disabled={agregando}>
              <Plus className="h-3.5 w-3.5" />
              {agregando ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ¿La persona no está en el sistema?{' '}
            <Link href="/personas/nueva" className="text-primary hover:underline">
              Registrala primero
            </Link>
            .
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <ConfirmDialog
        open={aBaja !== null}
        onOpenChange={open => !open && setABaja(null)}
        titulo="Dar de baja del evento"
        descripcion={
          aBaja
            ? `${nombreDe(aBaja)} pasa a estado "Cancelado" en este evento. No se borra el registro ni sus pagos.`
            : undefined
        }
        confirmar="Dar de baja"
        tono="advertencia"
        onConfirm={() => {
          if (aBaja) darDeBaja(aBaja.id)
          setABaja(null)
        }}
      />
    </Card>
  )
}

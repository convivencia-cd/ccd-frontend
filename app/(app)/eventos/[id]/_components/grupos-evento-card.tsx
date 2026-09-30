'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Trash2, UsersRound } from 'lucide-react'
import type { ParticipanteEquipo } from './participantes-evento-card'

export type GrupoEvento = {
  id: string
  nombre: string
  servidor_participante_id: string | null
}

const selectClass = 'rounded border border-border bg-background px-2 py-1 text-sm text-foreground'

function nombreDe(p: ParticipanteEquipo): string {
  return p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—'
}

/**
 * Grupos de la convivencia (minuta #138): 1 servidor a cargo y varios
 * conviventes. El nombre sale del listado que define el tipo de evento; a los
 * conviventes se los asigna desde la columna "Grupo" de la tarjeta Inscriptos.
 */
export default function GruposEventoCard({
  eventoId,
  grupos,
  servidores,
  conviventes,
  nombresDisponibles,
  onChanged,
}: {
  eventoId: string
  grupos: GrupoEvento[]
  /** Participantes del evento con rol 'servidor', candidatos a estar a cargo. */
  servidores: ParticipanteEquipo[]
  /** Conviventes activos, para contar cuántos cayó en cada grupo. */
  conviventes: ParticipanteEquipo[]
  /** Nombres de grupo configurados en el tipo de evento. */
  nombresDisponibles: string[]
  onChanged: () => void
}) {
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aBorrar, setABorrar] = useState<GrupoEvento | null>(null)

  const usados = new Set(grupos.map(g => g.nombre))
  const libres = nombresDisponibles.filter(n => !usados.has(n))

  async function llamar(init: RequestInit & { query?: string }) {
    const res = await fetch(`/api/eventos/${eventoId}/grupos${init.query ?? ''}`, init)
    if (!res.ok) {
      throw new Error(((await res.json()) as { error?: string }).error ?? 'Error en la operación')
    }
  }

  async function crear() {
    if (!nuevoNombre) {
      setError('Elegí un nombre de la lista')
      return
    }
    setCreando(true)
    setError('')
    try {
      await llamar({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre }),
      })
      setNuevoNombre('')
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setCreando(false)
    }
  }

  async function cambiarServidor(grupoId: string, servidorParticipanteId: string) {
    setOcupado(grupoId)
    setError('')
    try {
      await llamar({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: grupoId,
          servidor_participante_id: servidorParticipanteId || null,
        }),
      })
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setOcupado(null)
    }
  }

  async function borrar(grupoId: string) {
    setOcupado(grupoId)
    setError('')
    try {
      await llamar({ method: 'DELETE', query: `?grupo_id=${grupoId}` })
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
          <UsersRound className="h-5 w-5 text-primary" />
          Grupos de la Convivencia
        </CardTitle>
        <CardDescription>
          {grupos.length} grupos. Cada uno lleva un servidor a cargo; a los conviventes se los asigna desde la columna
          &ldquo;Grupo&rdquo; de Inscriptos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grupos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Todavía no hay grupos armados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Grupo</th>
                  <th className="px-3 py-2 font-medium">Servidor a cargo</th>
                  <th className="px-3 py-2 font-medium">Conviventes</th>
                  <th className="px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(g => (
                  <tr key={g.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium text-foreground">{g.nombre}</td>
                    <td className="px-3 py-2">
                      <select
                        className={selectClass}
                        value={g.servidor_participante_id ?? ''}
                        disabled={ocupado === g.id}
                        onChange={e => cambiarServidor(g.id, e.target.value)}
                      >
                        <option value="">— Sin asignar —</option>
                        {servidores.map(s => (
                          <option key={s.id} value={s.id}>
                            {nombreDe(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {conviventes.filter(c => c.grupo_id === g.id).length}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        disabled={ocupado === g.id}
                        onClick={() => setABorrar(g)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {servidores.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Todavía no hay nadie con rol <strong>Servidor</strong> en el equipo, así que no hay a quién poner a cargo.
            Sumalos desde &ldquo;Equipo del Evento&rdquo;.
          </p>
        )}

        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">Armar un grupo</p>
          {nombresDisponibles.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              El tipo de evento no tiene nombres de grupo cargados. Se definen en{' '}
              <span className="text-foreground">Tipos de Eventos → editar → Nombres de Grupo</span>.
            </p>
          ) : libres.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ya se usaron todos los nombres disponibles del tipo de evento.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select className={selectClass} value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}>
                <option value="">Elegí un nombre...</option>
                {libres.map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <Button size="sm" className="gap-1" onClick={crear} disabled={creando}>
                <Plus className="h-3.5 w-3.5" />
                {creando ? 'Creando...' : 'Crear grupo'}
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <ConfirmDialog
        open={aBorrar !== null}
        onOpenChange={open => !open && setABorrar(null)}
        titulo="Borrar el grupo"
        descripcion={
          aBorrar
            ? `Se borra el grupo "${aBorrar.nombre}". Sus conviventes quedan sin grupo, no se los da de baja del evento.`
            : undefined
        }
        confirmar="Borrar grupo"
        tono="destructivo"
        onConfirm={() => {
          if (aBorrar) borrar(aBorrar.id)
          setABorrar(null)
        }}
      />
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PersonaCombobox, type PersonaOption } from '@/components/persona-combobox'
import { UserCog } from 'lucide-react'

export type AsignacionesEvento = {
  coordinador_asignado_id: string | null
  asesor_asignado_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_1_nombre: string | null
  centralizador_1_email: string | null
  centralizador_1_telefono: string | null
  centralizador_2_persona_id: string | null
  centralizador_2_nombre: string | null
  centralizador_2_email: string | null
  centralizador_2_telefono: string | null
  centralizador_3_persona_id: string | null
  centralizador_3_nombre: string | null
  centralizador_3_email: string | null
  centralizador_3_telefono: string | null
}

type Centralizador = { personaId: string; nombre: string; email: string; telefono: string }

const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'

/**
 * Personas que el evento guarda en columnas propias: coordinador y asesor
 * designados por el Equipo Timón, y los hasta 3 centralizadores. Es la misma
 * información que se carga en "Datos para Noticias", pero editable también
 * cuando el evento ya está publicado o en curso.
 */
export default function AsignacionesEventoCard({
  eventoId,
  inicial,
  personas,
  cargandoPersonas,
  onSaved,
}: {
  eventoId: string
  inicial: AsignacionesEvento
  personas: PersonaOption[]
  cargandoPersonas: boolean
  onSaved: () => void
}) {
  const [coordinador, setCoordinador] = useState(inicial.coordinador_asignado_id ?? '')
  const [asesor, setAsesor] = useState(inicial.asesor_asignado_id ?? '')
  const [centralizadores, setCentralizadores] = useState<Centralizador[]>([
    {
      personaId: inicial.centralizador_1_persona_id ?? '',
      nombre: inicial.centralizador_1_nombre ?? '',
      email: inicial.centralizador_1_email ?? '',
      telefono: inicial.centralizador_1_telefono ?? '',
    },
    {
      personaId: inicial.centralizador_2_persona_id ?? '',
      nombre: inicial.centralizador_2_nombre ?? '',
      email: inicial.centralizador_2_email ?? '',
      telefono: inicial.centralizador_2_telefono ?? '',
    },
    {
      personaId: inicial.centralizador_3_persona_id ?? '',
      nombre: inicial.centralizador_3_nombre ?? '',
      email: inicial.centralizador_3_email ?? '',
      telefono: inicial.centralizador_3_telefono ?? '',
    },
  ])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  function seleccionarCentralizador(i: number, personaId: string) {
    const p = personas.find(x => x.id === personaId)
    setOk(false)
    setCentralizadores(prev => {
      const next = [...prev]
      next[i] = p
        ? {
            personaId: p.id,
            nombre: `${p.nombre} ${p.apellido}`,
            // Si la persona no tiene el dato cargado se conserva lo ya escrito a mano.
            email: p.email ?? next[i].email,
            telefono: next[i].telefono,
          }
        : { personaId: '', nombre: '', email: '', telefono: '' }
      return next
    })
  }

  function actualizarContacto(i: number, campo: 'email' | 'telefono', valor: string) {
    setOk(false)
    setCentralizadores(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [campo]: valor }
      return next
    })
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    setOk(false)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/equipo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinador_asignado_id: coordinador || null,
          asesor_asignado_id: asesor || null,
          centralizador_1_persona_id: centralizadores[0].personaId || null,
          centralizador_1_nombre: centralizadores[0].nombre || null,
          centralizador_1_email: centralizadores[0].email || null,
          centralizador_1_telefono: centralizadores[0].telefono || null,
          centralizador_2_persona_id: centralizadores[1].personaId || null,
          centralizador_2_nombre: centralizadores[1].nombre || null,
          centralizador_2_email: centralizadores[1].email || null,
          centralizador_2_telefono: centralizadores[1].telefono || null,
          centralizador_3_persona_id: centralizadores[2].personaId || null,
          centralizador_3_nombre: centralizadores[2].nombre || null,
          centralizador_3_email: centralizadores[2].email || null,
          centralizador_3_telefono: centralizadores[2].telefono || null,
        }),
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Error al guardar')
      }
      setOk(true)
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <UserCog className="h-5 w-5 text-primary" />
          Asignaciones del Evento
        </CardTitle>
        <CardDescription>
          Coordinador, asesor y centralizadores. Los centralizadores cargados acá son los que ven el evento en
          &ldquo;Soy Centralizador&rdquo; y pueden gestionarlo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Coordinador asignado</p>
            <PersonaCombobox
              value={coordinador}
              personas={personas}
              onChange={v => {
                setCoordinador(v)
                setOk(false)
              }}
              placeholder={cargandoPersonas ? "Cargando personas..." : "— Sin asignar —"}
              disabled={cargandoPersonas}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Asesor asignado</p>
            <PersonaCombobox
              value={asesor}
              personas={personas}
              onChange={v => {
                setAsesor(v)
                setOk(false)
              }}
              placeholder={cargandoPersonas ? "Cargando personas..." : "— Sin asignar —"}
              disabled={cargandoPersonas}
            />
          </div>
        </div>

        {([1, 2, 3] as const).map(n => {
          const i = n - 1
          const c = centralizadores[i]
          return (
            <div key={n} className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground">Centralizador {n}</p>
              <PersonaCombobox
                value={c.personaId}
                personas={personas}
                onChange={id => seleccionarCentralizador(i, id)}
                placeholder={cargandoPersonas ? "Cargando personas..." : "— Sin asignar —"}
                disabled={cargandoPersonas}
              />
              {c.nombre && !c.personaId && <p className="text-xs text-muted-foreground">{c.nombre}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Email para el evento</p>
                  <input
                    type="email"
                    className={inputClass}
                    value={c.email}
                    placeholder="correo@ejemplo.com"
                    onChange={e => actualizarContacto(i, 'email', e.target.value)}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Celular para el evento</p>
                  <input
                    type="tel"
                    className={inputClass}
                    value={c.telefono}
                    placeholder="+54 11 0000-0000"
                    onChange={e => actualizarContacto(i, 'telefono', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {ok && <p className="text-sm text-green-600 dark:text-green-400">Asignaciones guardadas.</p>}

        <Button size="sm" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar asignaciones'}
        </Button>
      </CardContent>
    </Card>
  )
}

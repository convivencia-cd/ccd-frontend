'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type Centralizador = {
  personaId: string
  nombre: string
  email: string
  telefono: string
}

type Persona = {
  id: string
  nombre: string
  apellido: string
  email?: string | null
  telefono?: string | null
}

type Accion = 'publicar' | 'suspender' | 'devolver'

const CONFIRMACIONES: Record<
  Accion,
  { titulo: string; descripcion: string; confirmar: string; tono: 'normal' | 'destructivo' | 'advertencia' }
> = {
  publicar: {
    titulo: '¿Publicar el retiro?',
    descripcion: 'Pasará a estado "Publicado" con los datos de este panel y quedará visible en la home pública.',
    confirmar: 'Publicar retiro',
    tono: 'normal',
  },
  suspender: {
    titulo: '¿Suspender este retiro?',
    descripcion: 'El retiro pasa a estado Suspendido. Es una salida definitiva: si lo que hay es un dato mal cargado, conviene devolverlo para corregir.',
    confirmar: 'Suspender retiro',
    tono: 'destructivo',
  },
  devolver: {
    titulo: '¿Devolver el retiro para corregir?',
    descripcion: 'Vuelve a "Pendiente de Datos para Noticias" para que corrijan lo que falte. El motivo queda en el historial del retiro.',
    confirmar: 'Devolver retiro',
    tono: 'advertencia',
  },
}

type Props = {
  eventoId: string
  inicial: {
    casa_retiro_id: string | null
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
    notas_aprobacion_final: string | null
  }
  casasRetiro: { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }[]
  personas: Persona[]
}

function toStr(v: string | null | undefined): string {
  return v ?? ''
}

export default function AprobacionFinalPanel({ eventoId, inicial, casasRetiro, personas }: Props) {
  const router = useRouter()

  const [casaRetiroId, setCasaRetiroId] = useState(toStr(inicial.casa_retiro_id))
  const [coordinadorId, setCoordinadorId] = useState(toStr(inicial.coordinador_asignado_id))
  const [asesorId, setAsesorId] = useState(toStr(inicial.asesor_asignado_id))
  const [centralizadores, setCentralizadores] = useState<Centralizador[]>([
    { personaId: toStr(inicial.centralizador_1_persona_id), nombre: toStr(inicial.centralizador_1_nombre), email: toStr(inicial.centralizador_1_email), telefono: toStr(inicial.centralizador_1_telefono) },
    { personaId: toStr(inicial.centralizador_2_persona_id), nombre: toStr(inicial.centralizador_2_nombre), email: toStr(inicial.centralizador_2_email), telefono: toStr(inicial.centralizador_2_telefono) },
    { personaId: toStr(inicial.centralizador_3_persona_id), nombre: toStr(inicial.centralizador_3_nombre), email: toStr(inicial.centralizador_3_email), telefono: toStr(inicial.centralizador_3_telefono) },
  ])
  const [notas, setNotas] = useState(toStr(inicial.notas_aprobacion_final))
  const [loading, setLoading] = useState<Accion | null>(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState<Accion | null>(null)

  const personaOptions = personas.map(p => ({ value: p.id, label: `${p.apellido}, ${p.nombre}` }))

  function selectCentralizador(i: number, personaId: string) {
    const p = personas.find(x => x.id === personaId)
    if (!p) {
      setCentralizadores(prev => {
        const next = [...prev]
        next[i] = { personaId: '', nombre: '', email: '', telefono: '' }
        return next
      })
      return
    }
    setCentralizadores(prev => {
      const next = [...prev]
      next[i] = {
        personaId: p.id,
        nombre: `${p.nombre} ${p.apellido}`,
        // Preserve existing value if persona has no contact info stored
        email: p.email ? toStr(p.email) : next[i].email,
        telefono: p.telefono ? toStr(p.telefono) : next[i].telefono,
      }
      return next
    })
  }

  function updateCentralizadorField(i: number, field: 'email' | 'telefono', value: string) {
    setCentralizadores(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function buildPayload(accion: Accion) {
    return {
      accion,
      notas_aprobacion_final: notas || null,
      casa_retiro_id: casaRetiroId || null,
      coordinador_asignado_id: coordinadorId || null,
      asesor_asignado_id: asesorId || null,
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
    }
  }

  function pedirAccion(accion: Accion) {
    setError('')
    // El motivo viaja en las notas y es lo único que ve quien tiene que
    // corregir, así que no tiene sentido devolver sin explicar qué está mal.
    if (accion === 'devolver' && !notas.trim()) {
      setError('Escribí en las notas qué hay que corregir antes de devolver el retiro.')
      return
    }
    setConfirmando(accion)
  }

  async function handleAccion(accion: Accion) {
    setConfirmando(null)
    setLoading(accion)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/aprobacion-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(accion)),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error inesperado')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'

  return (
    <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-card p-6 space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground border-b border-border pb-3">
        Aprobación Final — Equipo Timón
      </h3>
      <p className="text-xs text-muted-foreground">
        Revisá y confirmá los datos definitivos antes de publicar. Podés modificar la casa de retiros, coordinador, asesor y centralizadores.
      </p>

      {/* Casa de Retiro */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Casa de Retiros</p>
        <Combobox
          value={casaRetiroId}
          onSelect={setCasaRetiroId}
          options={casasRetiro.map(cr => ({ label: cr.ciudad ? `${cr.nombre} — ${cr.ciudad}` : cr.nombre, value: cr.id }))}
          placeholder="— Sin asignar —"
          searchPlaceholder="Buscar casa de retiro..."
          emptyText="No se encontraron casas de retiro."
        />
      </div>

      {/* Coordinador */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Coordinador</p>
        <Combobox
          value={coordinadorId}
          onSelect={setCoordinadorId}
          options={personaOptions}
          placeholder="Buscar coordinador..."
          searchPlaceholder="Buscar por apellido o nombre..."
          emptyText="No se encontraron personas."
        />
      </div>

      {/* Asesor */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Asesor</p>
        <Combobox
          value={asesorId}
          onSelect={setAsesorId}
          options={personaOptions}
          placeholder="Buscar asesor..."
          searchPlaceholder="Buscar por apellido o nombre..."
          emptyText="No se encontraron personas."
        />
      </div>

      {/* Centralizadores */}
      {([1, 2, 3] as const).map(n => {
        const i = n - 1
        const c = centralizadores[i]
        const isRequired = n === 1
        return (
          <div key={n} className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
            <p className="text-xs font-medium text-foreground uppercase tracking-wide">
              Centralizador {n}{isRequired && <span className="text-destructive ml-1">*</span>}
            </p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Persona cecista</p>
              <Combobox
                value={c.personaId}
                onSelect={(id) => selectCentralizador(i, id)}
                options={personaOptions}
                placeholder="Buscar cecista..."
                searchPlaceholder="Buscar por apellido o nombre..."
                emptyText="No se encontraron personas."
              />
              {c.nombre && !c.personaId && (
                <p className="mt-1 text-xs text-muted-foreground">{c.nombre}</p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email para el retiro</p>
                <input
                  type="email"
                  className={inputClass}
                  value={c.email}
                  placeholder="correo@ejemplo.com"
                  onChange={e => updateCentralizadorField(i, 'email', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Celular para el retiro</p>
                <input
                  type="tel"
                  className={inputClass}
                  value={c.telefono}
                  placeholder="+54 11 0000-0000"
                  onChange={e => updateCentralizadorField(i, 'telefono', e.target.value)}
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* Notas — también son el motivo cuando se devuelve el evento */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Notas / motivo de devolución
        </p>
        <textarea
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground min-h-20"
          value={notas}
          placeholder="Observaciones de la aprobación final, o qué hay que corregir si devolvés el retiro..."
          onChange={e => {
            setNotas(e.target.value)
            if (error) setError('')
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={loading !== null}
          onClick={() => pedirAccion('suspender')}
          className="flex-1"
        >
          {loading === 'suspender' ? 'Suspendiendo...' : 'Suspender Retiro'}
        </Button>
        <Button
          size="sm"
          disabled={loading !== null}
          onClick={() => pedirAccion('publicar')}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          {loading === 'publicar' ? 'Publicando...' : 'Publicar Retiro'}
        </Button>
      </div>

      {/* Salida intermedia: ni publicar con un dato mal, ni suspender el evento */}
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => pedirAccion('devolver')}
        className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        {loading === 'devolver' ? 'Devolviendo...' : 'Devolver para corregir datos'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Vuelve a &quot;Pendiente de Datos para Noticias&quot; para que corrijan lo que falte. El motivo queda en el historial del retiro.
      </p>

      {confirmando && (
        <ConfirmDialog
          open
          onOpenChange={open => {
            if (!open) setConfirmando(null)
          }}
          titulo={CONFIRMACIONES[confirmando].titulo}
          descripcion={CONFIRMACIONES[confirmando].descripcion}
          confirmar={CONFIRMACIONES[confirmando].confirmar}
          tono={CONFIRMACIONES[confirmando].tono}
          onConfirm={() => handleAccion(confirmando)}
        >
          {/* Que relea el motivo antes de mandarlo: es lo único que recibe
              del otro lado quien tiene que corregir. */}
          {confirmando === 'devolver' && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
                Motivo
              </p>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{notas.trim()}</p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}

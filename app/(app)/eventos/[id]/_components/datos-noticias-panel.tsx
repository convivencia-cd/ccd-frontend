'use client'

import { useState } from 'react'
import Link from 'next/link'
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

type Props = {
  eventoId: string
  inicial: {
    casa_retiro_id: string | null
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
    precio: number | null
    pension: number | null
    manuales_stock: number | null
    manuales_necesarios: number | null
    notas_noticias: string | null
  }
  casasRetiro: { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }[]
  personas: Persona[]
  /** Motivo cargado por EqT si el evento volvió desde aprobación final */
  motivoDevolucion?: string | null
  /** Mostrar el atajo para crear una casa nueva (permiso casas_retiro.create). */
  canCrearCasaRetiro?: boolean
}

function toStr(v: string | null | undefined): string {
  return v ?? ''
}

function toNumStr(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

export default function DatosNoticiasPannel({ eventoId, inicial, casasRetiro, personas, motivoDevolucion, canCrearCasaRetiro = false }: Props) {
  const router = useRouter()

  const [casaRetiroId, setCasaRetiroId] = useState(toStr(inicial.casa_retiro_id))
  const [centralizadores, setCentralizadores] = useState<Centralizador[]>([
    { personaId: toStr(inicial.centralizador_1_persona_id), nombre: toStr(inicial.centralizador_1_nombre), email: toStr(inicial.centralizador_1_email), telefono: toStr(inicial.centralizador_1_telefono) },
    { personaId: toStr(inicial.centralizador_2_persona_id), nombre: toStr(inicial.centralizador_2_nombre), email: toStr(inicial.centralizador_2_email), telefono: toStr(inicial.centralizador_2_telefono) },
    { personaId: toStr(inicial.centralizador_3_persona_id), nombre: toStr(inicial.centralizador_3_nombre), email: toStr(inicial.centralizador_3_email), telefono: toStr(inicial.centralizador_3_telefono) },
  ])
  const [precio, setPrecio] = useState(toNumStr(inicial.precio))
  const [pension, setPension] = useState(toNumStr(inicial.pension))
  const [manualesStock, setManualesStock] = useState(toNumStr(inicial.manuales_stock))
  const [manualesNecesarios, setManualesNecesarios] = useState(toNumStr(inicial.manuales_necesarios))
  const [notas, setNotas] = useState(toStr(inicial.notas_noticias))
  const [loading, setLoading] = useState<'guardar' | 'publicar' | null>(null)
  const [error, setError] = useState('')
  const [savedOk, setSavedOk] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const personaOptions = personas.map(p => ({ value: p.id, label: `${p.apellido}, ${p.nombre}` }))

  const manualesSolicitados = Math.max(
    (Number(manualesNecesarios) || 0) - (Number(manualesStock) || 0),
    0
  )

  function selectPersona(i: number, personaId: string) {
    const p = personas.find(x => x.id === personaId)
    setSavedOk(false)
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

  function updateField(i: number, field: 'email' | 'telefono', value: string) {
    setCentralizadores(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
    setSavedOk(false)
  }

  function buildPayload() {
    return {
      casa_retiro_id: casaRetiroId || null,
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
      precio: precio === '' ? null : Number(precio),
      pension: pension === '' ? null : Number(pension),
      manuales_stock: manualesStock === '' ? null : Number(manualesStock),
      manuales_necesarios: manualesNecesarios === '' ? null : Number(manualesNecesarios),
      notas_noticias: notas || null,
    }
  }

  async function handleGuardar() {
    setLoading('guardar')
    setError('')
    setSavedOk(false)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/datos-noticias`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error al guardar')
      }
      setSavedOk(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  function pedirPublicar() {
    if (!centralizadores[0].nombre.trim()) {
      setError('Seleccioná al menos el Centralizador 1')
      return
    }
    setError('')
    setConfirmando(true)
  }

  async function handlePublicar() {
    setConfirmando(false)
    setLoading('publicar')
    setError('')
    setSavedOk(false)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/datos-noticias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        throw new Error(e ?? 'Error al publicar')
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
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-card p-6 space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground border-b border-border pb-3">
        Datos para Noticias
      </h3>
      <p className="text-xs text-muted-foreground">
        Completá los datos necesarios para la publicación del evento. Podés guardar un borrador y volver más tarde.
      </p>

      {/* El evento puede haber vuelto desde aprobación final: acá va el motivo */}
      {motivoDevolucion?.trim() && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
            Devuelto por el Equipo Timón
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{motivoDevolucion}</p>
        </div>
      )}

      {/* Casa de Retiro */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Casa de Retiros</p>
        <Combobox
          value={casaRetiroId}
          onSelect={val => { setCasaRetiroId(val); setSavedOk(false) }}
          options={casasRetiro.map(cr => ({ label: cr.ciudad ? `${cr.nombre} — ${cr.ciudad}` : cr.nombre, value: cr.id }))}
          placeholder="— Sin asignar —"
          searchPlaceholder="Buscar casa de retiro..."
          emptyText="No se encontraron casas de retiro."
        />
        {canCrearCasaRetiro && (
          <Link
            href={`/casas-retiro/nueva?returnTo=/eventos/${eventoId}`}
            className="text-xs text-primary hover:underline"
          >
            + Crear nueva casa de retiro
          </Link>
        )}
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
                onSelect={(id) => selectPersona(i, id)}
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
                <p className="text-xs text-muted-foreground mb-1">Email para el evento</p>
                <input
                  type="email"
                  className={inputClass}
                  value={c.email}
                  placeholder="correo@ejemplo.com"
                  onChange={e => updateField(i, 'email', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Celular para el evento</p>
                <input
                  type="tel"
                  className={inputClass}
                  value={c.telefono}
                  placeholder="+54 11 0000-0000"
                  onChange={e => updateField(i, 'telefono', e.target.value)}
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* Valores — se definen acá, no al solicitar el evento */}
      <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Valores</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor de Inscripción</p>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              className={inputClass}
              value={precio}
              onChange={e => { setPrecio(e.target.value); setSavedOk(false) }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor de Pensión</p>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              className={inputClass}
              value={pension}
              onChange={e => { setPension(e.target.value); setSavedOk(false) }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          La landing pública solo cobra el valor de inscripción. La pensión se registra y valida desde Pagos.
        </p>
      </div>

      {/* Manuales */}
      <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Manuales</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cantidad en stock</p>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={manualesStock}
              onChange={e => { setManualesStock(e.target.value); setSavedOk(false) }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cantidad necesarios</p>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={manualesNecesarios}
              onChange={e => { setManualesNecesarios(e.target.value); setSavedOk(false) }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Cantidad a solicitar</p>
          <p className="text-sm font-medium text-foreground">{manualesSolicitados}</p>
        </div>
      </div>

      {/* Notas */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notas</p>
        <textarea
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground min-h-20"
          value={notas}
          placeholder="Información adicional para la publicación del evento..."
          onChange={e => { setNotas(e.target.value); setSavedOk(false) }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedOk && <p className="text-sm text-green-600 dark:text-green-400">Borrador guardado correctamente.</p>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={handleGuardar}
          className="flex-1 bg-transparent"
        >
          {loading === 'guardar' ? 'Guardando...' : 'Guardar borrador'}
        </Button>
        <Button
          size="sm"
          disabled={loading !== null}
          onClick={pedirPublicar}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading === 'publicar' ? 'Enviando...' : 'Solicitar Publicación Final'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="¿Solicitar la publicación final?"
        descripcion='El evento pasará a "Pendiente de Aprobación Final" y ya no vas a poder editar estos datos, salvo que el Equipo Timón lo devuelva para corregir.'
        confirmar="Solicitar publicación"
        onConfirm={handlePublicar}
      />
    </div>
  )
}

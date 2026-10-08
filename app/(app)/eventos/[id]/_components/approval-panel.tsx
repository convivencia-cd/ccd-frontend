'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PersonaRolSelector } from './persona-rol-selector'
import { formatDateAR } from '@/lib/utils'

type ResultadoDiscernimiento =
  | 'aprobado_sin_modificaciones'
  | 'aprobado_con_modificaciones'
  | 'rechazado'
  | ''

type EventoCamposEditables = {
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  ciudad: string | null
  provincia_evento: string | null
  pais_evento: string | null
  codigo_postal: string | null
  diocesis: string | null
  coordinadores_propuestos: string | null
  asesor_propuesto: string | null
  asesor_voluntario: boolean | null
  modalidad: string | null
  notas: string | null
  casa_retiro_id: string | null
  coordinador_asignado_id: string | null
  asesor_asignado_id: string | null
}

type FechaEjecucion = { id?: string | null; fecha_inicio: string; fecha_fin: string }
type CasaRetiro = { id: string; nombre: string; ciudad?: string | null; provincia?: string | null }
type Persona = { id: string; nombre: string; apellido: string }

type DiscernimientoNivel = {
  nivel: 'confra' | 'eqt'
  title: string
  yaRegistrado?: {
    estado: string
    fecha: string | null
    notas: string | null
  }
}

type Props = {
  eventoId: string
  niveles: DiscernimientoNivel[]
  evento: EventoCamposEditables
  fechasEjecucion: FechaEjecucion[]
  casasRetiro: CasaRetiro[]
  personas: Persona[]
  coordinadoresRol: Persona[]
  asesoresRol: Persona[]
  serviciosBusqueda: Persona[]
}

const estadoDiscLabel: Record<string, string> = {
  aprobado_sin_modificaciones: 'Aprobado sin modificaciones',
  aprobado_con_modificaciones: 'Aprobado con modificaciones',
  rechazado: 'Rechazado',
}

function splitPersonas(val: string | null): string[] {
  if (!val) return ['']
  const parts = val.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : ['']
}

function NivelDiscernimiento({
  eventoId,
  nivel,
  title,
  yaRegistrado,
  evento,
  fechasEjecucion,
  casasRetiro,
  personas,
  coordinadoresRol,
  asesoresRol,
  serviciosBusqueda,
}: DiscernimientoNivel & {
  eventoId: string
  evento: EventoCamposEditables
  fechasEjecucion: FechaEjecucion[]
  casasRetiro: CasaRetiro[]
  personas: Persona[]
  coordinadoresRol: Persona[]
  asesoresRol: Persona[]
  serviciosBusqueda: Persona[]
}) {
  const router = useRouter()
  const [resultado, setResultado] = useState<ResultadoDiscernimiento>('')
  const [notas, setNotas] = useState('')
  const [cambios, setCambios] = useState<Partial<Record<keyof EventoCamposEditables, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  // Multi-input state for coordinadores and asesores propuestos
  const [coordinadoresArr, setCoordinadoresArr] = useState<string[]>(() =>
    splitPersonas(evento.coordinadores_propuestos)
  )
  const [asesoresArr, setAsesoresArr] = useState<string[]>(() =>
    splitPersonas(evento.asesor_propuesto)
  )

  // EqT-only: editable fechas de ejecución
  const [fechasArr, setFechasArr] = useState<FechaEjecucion[]>(() =>
    fechasEjecucion.length > 0 ? [...fechasEjecucion] : []
  )
  const [fechasChanged, setFechasChanged] = useState(false)

  function currentVal(campo: keyof EventoCamposEditables): string {
    if (campo in cambios) return cambios[campo] ?? ''
    const v = evento[campo]
    return v == null ? '' : String(v)
  }

  function setCampo(campo: keyof EventoCamposEditables, val: string) {
    setCambios(prev => ({ ...prev, [campo]: val }))
  }

  function updateCoordinadores(arr: string[]) {
    setCoordinadoresArr(arr)
    const joined = arr.filter(s => s.trim()).join(', ')
    setCambios(prev => ({ ...prev, coordinadores_propuestos: joined }))
  }

  function updateAsesores(arr: string[]) {
    setAsesoresArr(arr)
    const joined = arr.filter(s => s.trim()).join(', ')
    setCambios(prev => ({ ...prev, asesor_propuesto: joined }))
  }

  function updateFecha(index: number, field: 'fecha_inicio' | 'fecha_fin', value: string) {
    setFechasArr(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setFechasChanged(true)
  }

  function addFecha() {
    setFechasArr(prev => [...prev, { fecha_inicio: '', fecha_fin: '' }])
    setFechasChanged(true)
  }

  function removeFecha(index: number) {
    setFechasArr(prev => prev.filter((_, i) => i !== index))
    setFechasChanged(true)
  }

  // Find selected persona for link display
  const selectedCoordinador = personas.find(p => p.id === currentVal('coordinador_asignado_id'))
  const selectedAsesor = personas.find(p => p.id === currentVal('asesor_asignado_id'))

  const casaRetiroOptions = useMemo<ComboboxOption[]>(
    () => casasRetiro.map(cr => ({ label: cr.ciudad ? `${cr.nombre} — ${cr.ciudad}` : cr.nombre, value: cr.id })),
    [casasRetiro]
  )

  const pedirComunicar = () => {
    if (!resultado) {
      setError('Seleccioná un estado de discernimiento')
      return
    }
    if (resultado === 'rechazado' && !notas.trim()) {
      setError('Las notas son obligatorias al rechazar')
      return
    }
    setError('')
    setConfirmando(true)
  }

  const handleComunicar = async () => {
    setConfirmando(false)
    setLoading(true)
    setError('')

    try {
      const camposConCambio: Record<string, unknown> = {}
      for (const [campo, nuevoStr] of Object.entries(cambios)) {
        const originalStr = String(evento[campo as keyof EventoCamposEditables] ?? '')
        if (nuevoStr === originalStr) continue
        if (campo === 'asesor_voluntario') {
          camposConCambio[campo] = nuevoStr === 'true'
        } else {
          camposConCambio[campo] = nuevoStr === '' ? null : nuevoStr
        }
      }

      const resultadoFinal =
        Object.keys(camposConCambio).length > 0 && resultado === 'aprobado_sin_modificaciones'
          ? 'aprobado_con_modificaciones'
          : resultado

      const payload: Record<string, unknown> = {
        resultado_discernimiento: resultadoFinal,
        notas_discernimiento: notas || undefined,
      }
      if (Object.keys(camposConCambio).length > 0) {
        payload.cambios = camposConCambio
      }
      if (nivel === 'eqt' && fechasChanged) {
        payload.fechas_ejecucion = fechasArr.filter(f => f.fecha_inicio && f.fecha_fin)
      }

      const res = await fetch(`/api/eventos/${eventoId}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json()
        throw new Error(apiError ?? 'Error al comunicar el discernimiento')
      }

      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const readonlyInputClass = 'rounded border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground w-full'
  const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded border-2 border-foreground bg-foreground flex items-center justify-center">
          <svg className="h-3 w-3 text-background" fill="currentColor" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</span>
      </div>

      {yaRegistrado ? (
        /* Modo solo lectura */
        <div className="grid gap-3 pl-6">
          <div className="grid gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha discernimiento</p>
              <div className={readonlyInputClass}>{formatDateAR(yaRegistrado.fecha)}</div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estado discernimiento</p>
              <div className={readonlyInputClass}>
                {estadoDiscLabel[yaRegistrado.estado] ?? yaRegistrado.estado}
              </div>
            </div>
          </div>
          {yaRegistrado.notas && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notas aclaratorias</p>
              <div className={`${readonlyInputClass} min-h-16 whitespace-pre-wrap`}>{yaRegistrado.notas}</div>
            </div>
          )}
        </div>
      ) : (
        /* Modo edición */
        <div className="grid gap-4 pl-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha discernimiento</p>
            <div className={readonlyInputClass}>{formatDateAR(new Date().toISOString().split('T')[0])} (hoy)</div>
          </div>

          {/* Datos del evento */}
          <div className="space-y-3 rounded-md border border-border p-4 bg-muted/30">
            <p className="text-xs font-medium text-foreground uppercase tracking-wide">
              Datos del evento
            </p>
            <p className="text-xs text-muted-foreground">
              Podés proponer cambios a los campos. Si modificás algo, el discernimiento se registrará como &quot;con modificaciones&quot;.
            </p>

            {/* Nombre — solo lectura */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nombre</p>
              <div className={readonlyInputClass}>{evento.nombre}</div>
            </div>

            {/* Fechas principales */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha inicio</p>
                <input
                  type="date"
                  className={inputClass}
                  value={currentVal('fecha_inicio')}
                  onChange={e => setCampo('fecha_inicio', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha fin</p>
                <input
                  type="date"
                  className={inputClass}
                  value={currentVal('fecha_fin')}
                  onChange={e => setCampo('fecha_fin', e.target.value)}
                />
              </div>
            </div>

            {/* Períodos adicionales */}
            {nivel === 'confra' ? (
              /* Confra: solo lectura */
              fechasEjecucion.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Períodos adicionales</p>
                  {fechasEjecucion.map((f, i) => (
                    <div key={f.id ?? i} className={`${readonlyInputClass} flex gap-2`}>
                      <span className="text-xs text-muted-foreground shrink-0">Período {i + 1}</span>
                      <span>{formatDateAR(f.fecha_inicio)} — {formatDateAR(f.fecha_fin)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* EqT: editable */
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Períodos adicionales</p>
                {fechasArr.map((f, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2 items-end">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Inicio período {i + 1}</p>
                      <input
                        type="date"
                        className={inputClass}
                        value={f.fecha_inicio}
                        onChange={e => updateFecha(i, 'fecha_inicio', e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Fin período {i + 1}</p>
                        <input
                          type="date"
                          className={inputClass}
                          value={f.fecha_fin}
                          onChange={e => updateFecha(i, 'fecha_fin', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFecha(i)}
                        className="shrink-0 self-end pb-1 text-muted-foreground hover:text-destructive text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFecha}
                  className="text-xs text-primary hover:underline"
                >
                  + Agregar período
                </button>
              </div>
            )}

            {/* Modalidad */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Modalidad</p>
              <select
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                value={currentVal('modalidad')}
                onChange={e => setCampo('modalidad', e.target.value)}
              >
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
                <option value="bimodal">Bimodal</option>
              </select>
            </div>

            {/* Coordinadores propuestos — multi-input */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Coordinadores propuestos</p>
              {coordinadoresArr.map((val, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <PersonaRolSelector
                    className="flex-1"
                    mode="nombre"
                    value={val}
                    onChange={newVal => {
                      const arr = [...coordinadoresArr]
                      arr[i] = newVal
                      updateCoordinadores(arr)
                    }}
                    opcionesRol={coordinadoresRol}
                    otro={{ tipo: 'buscador', opciones: serviciosBusqueda }}
                  />
                  {coordinadoresArr.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateCoordinadores(coordinadoresArr.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive text-lg leading-none px-1 pt-1.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateCoordinadores([...coordinadoresArr, ''])}
                className="text-xs text-primary hover:underline"
              >
                + Agregar coordinador
              </button>
            </div>

            {/* Asesores propuestos — multi-input + voluntario */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Asesor/es propuestos</p>
              {asesoresArr.map((val, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <PersonaRolSelector
                    className="flex-1"
                    mode="nombre"
                    value={val}
                    onChange={newVal => {
                      const arr = [...asesoresArr]
                      arr[i] = newVal
                      updateAsesores(arr)
                    }}
                    opcionesRol={asesoresRol}
                    otro={{ tipo: 'texto', placeholder: 'Nombre y apellido' }}
                  />
                  {asesoresArr.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateAsesores(asesoresArr.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive text-lg leading-none px-1 pt-1.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateAsesores([...asesoresArr, ''])}
                className="text-xs text-primary hover:underline"
              >
                + Agregar asesor
              </button>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`asesor_voluntario_${nivel}`}
                  checked={currentVal('asesor_voluntario') === 'true'}
                  onChange={e => setCampo('asesor_voluntario', String(e.target.checked))}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor={`asesor_voluntario_${nivel}`} className="text-sm text-foreground cursor-pointer">
                  Asesor voluntario
                </label>
              </div>
            </div>

            {/* EqT-only: Coordinador y asesor ASIGNADOS */}
            {nivel === 'eqt' && (
              <>
                {/* Coordinador asignado */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Coordinador asignado</p>
                  <div className="flex gap-2 items-start">
                    <PersonaRolSelector
                      className="flex-1"
                      mode="id"
                      value={currentVal('coordinador_asignado_id')}
                      onChange={val => setCampo('coordinador_asignado_id', val)}
                      opcionesRol={coordinadoresRol}
                      otro={{ tipo: 'buscador', opciones: serviciosBusqueda, personasFallback: personas }}
                    />
                    {selectedCoordinador && (
                      <Link
                        href={`/personas/${selectedCoordinador.id}`}
                        target="_blank"
                        className="shrink-0 text-primary hover:underline text-xs pt-2"
                        title="Ver perfil"
                      >
                        →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Asesor asignado */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Asesor asignado</p>
                  <div className="flex gap-2 items-start">
                    <PersonaRolSelector
                      className="flex-1"
                      mode="id"
                      value={currentVal('asesor_asignado_id')}
                      onChange={val => setCampo('asesor_asignado_id', val)}
                      opcionesRol={asesoresRol}
                      otro={{ tipo: 'buscador', opciones: serviciosBusqueda, personasFallback: personas }}
                    />
                    {selectedAsesor && (
                      <Link
                        href={`/personas/${selectedAsesor.id}`}
                        target="_blank"
                        className="shrink-0 text-primary hover:underline text-xs pt-2"
                        title="Ver perfil"
                      >
                        →
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Casa de Retiro */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Casa de Retiros</p>
              <Combobox
                value={currentVal('casa_retiro_id')}
                onSelect={val => setCampo('casa_retiro_id', val)}
                options={casaRetiroOptions}
                placeholder="— Sin asignar —"
                searchPlaceholder="Buscar casa de retiro..."
                emptyText="No se encontraron casas de retiro."
              />
            </div>

            {/* Ubicación */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ciudad</p>
                <input
                  className={inputClass}
                  value={currentVal('ciudad')}
                  onChange={e => setCampo('ciudad', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Provincia</p>
                <input
                  className={inputClass}
                  value={currentVal('provincia_evento')}
                  onChange={e => setCampo('provincia_evento', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">País</p>
                <input
                  className={inputClass}
                  value={currentVal('pais_evento')}
                  onChange={e => setCampo('pais_evento', e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Código postal</p>
                <input
                  className={inputClass}
                  value={currentVal('codigo_postal')}
                  onChange={e => setCampo('codigo_postal', e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Diócesis</p>
              <input
                className={inputClass}
                value={currentVal('diocesis')}
                onChange={e => setCampo('diocesis', e.target.value)}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notas del evento</p>
              <textarea
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground min-h-16"
                value={currentVal('notas')}
                onChange={e => setCampo('notas', e.target.value)}
              />
            </div>
          </div>

          {/* Estado discernimiento — después de datos del evento */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estado discernimiento *</p>
            <select
              value={resultado}
              onChange={e => { setResultado(e.target.value as ResultadoDiscernimiento); setError('') }}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">— Seleccionar —</option>
              <option value="aprobado_sin_modificaciones">Aprobado sin modificaciones</option>
              <option value="aprobado_con_modificaciones">Aprobado con modificaciones</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          {/* Notas aclaratorias */}
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Notas aclaratorias{resultado === 'rechazado' && <span className="text-destructive"> *</span>}
            </p>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, cambios sugeridos, contexto pastoral..."
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground min-h-20"
            />
          </div>

          <Button
            size="sm"
            disabled={loading || !resultado}
            onClick={pedirComunicar}
            className="w-full"
          >
            {loading ? 'Comunicando...' : 'Comunicar Discernimiento'}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <ConfirmDialog
            open={confirmando}
            onOpenChange={setConfirmando}
            titulo={resultado === 'rechazado' ? '¿Rechazar la solicitud?' : '¿Comunicar el discernimiento?'}
            descripcion={
              resultado === 'rechazado'
                ? 'El evento pasará a estado "Rechazado". Una vez comunicado, el discernimiento no se puede modificar.'
                : 'El evento avanzará al siguiente estado. Una vez comunicado, el discernimiento no se puede modificar.'
            }
            confirmar={resultado === 'rechazado' ? 'Rechazar solicitud' : 'Comunicar discernimiento'}
            tono={resultado === 'rechazado' ? 'destructivo' : 'normal'}
            onConfirm={handleComunicar}
          />
        </div>
      )}
    </div>
  )
}

export default function DiscernimientoPanel({ eventoId, niveles, evento, fechasEjecucion, casasRetiro, personas, coordinadoresRol, asesoresRol, serviciosBusqueda }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground border-b border-border pb-3">
        Discernimiento de la Solicitud
      </h3>

      {niveles.map((n, i) => (
        <div key={n.nivel}>
          <NivelDiscernimiento
            eventoId={eventoId}
            evento={evento}
            fechasEjecucion={fechasEjecucion}
            casasRetiro={casasRetiro}
            personas={personas}
            coordinadoresRol={coordinadoresRol}
            asesoresRol={asesoresRol}
            serviciosBusqueda={serviciosBusqueda}
            {...n}
          />
          {i < niveles.length - 1 && <div className="border-t border-border mt-6" />}
        </div>
      ))}
    </div>
  )
}

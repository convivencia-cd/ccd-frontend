'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Copy, Download, Users, FileText, Sparkles, Package, DollarSign, Camera, Lock } from 'lucide-react'
import type { PreguntaInforme } from '@/lib/eventos/cierre'
import type { FotoCierre } from '@/lib/eventos/fotos-cierre'
import { FotosCierre } from './fotos-cierre'
import { exportConviventesPDF, exportInformeCcdPDF, exportInformeCarismasPDF, ROMANOS, type EventoInfo } from '@/lib/eventos/cierre-pdf'
import { CerrarConvivenciaButton } from './cerrar-convivencia-button'

const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'

type Persona = { id: string; nombre: string; apellido: string; email?: string | null; telefono?: string | null }
type Convivente = { persona_id: string; nombre: string; apellido: string; email: string | null; telefono: string | null; rol: string }
type Servidor = { persona_id: string; nombre: string; apellido: string; rol: string; fraternidad: string | null }

type Props = {
  eventoId: string
  estado: string
  eventoInfo: EventoInfo
  canEditar: boolean
  canVerCarismas: boolean
  canVerInformeEqt: boolean
  canVerInformeResponsables: boolean
  /** Solo el coordinador del evento completa los informes confidenciales. */
  canEditarConfidencial: boolean
  canCerrar: boolean
  canSubirFotos: boolean
  fotos: FotoCierre[]
  conviventes: Convivente[]
  servidores: Servidor[]
  cecistas: Persona[]
  preguntas: PreguntaInforme[]
  /** El Informe Económico vive en su propio panel del detalle; acá solo se linkea si el usuario lo ve. */
  canVerInformeEconomico: boolean
  inicial: {
    cierre_bolso_manuales_completo: boolean | null
    cierre_manuales_saldo_final: number | null
    cierre_manuales_recibidos_de: string | null
    cierre_manuales_entrego_a: string | null
    cierre_manuales_notas: string | null
    informe_eqt_respuestas: Record<string, string> | null
    informe_responsables_respuestas: Record<string, string> | null
    informe_carismas: { persona_id: string; texto: string }[] | null
  }
}

function Section({ icon: Icon, title, badge, children }: { icon: React.ElementType; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h4>
        {badge && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <Lock className="h-3 w-3" /> {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function InformeCcd({ titulo, preguntas, respuestas, onChange, otras, canEditar, guardando, bloqueado, onGuardar, onExportar }: {
  titulo: string
  preguntas: PreguntaInforme[]
  respuestas: Record<string, string>
  onChange: (fn: (prev: Record<string, string>) => Record<string, string>) => void
  /** El otro informe de la CcD, para copiar sus respuestas a las vacías de este. */
  otras: { nombre: string; respuestas: Record<string, string> } | null
  canEditar: boolean
  guardando: boolean
  bloqueado: boolean
  onGuardar: () => void
  onExportar: () => void
}) {
  // Solo completa las respuestas vacías: nunca pisa lo que ya está escrito.
  const copiables = otras
    ? preguntas.filter(q => !(respuestas[q.id] ?? '').trim() && (otras.respuestas[q.id] ?? '').trim()).length
    : 0

  return (
    <Section icon={FileText} title={titulo} badge="Confidencial">
      {preguntas.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay preguntas definidas para este tipo de evento. Configuralas en Tipos de Evento.</p>
      ) : preguntas.map((q, i) => (
        <div key={q.id} className="space-y-1">
          <p className="text-sm font-medium text-foreground">{ROMANOS[i] ?? i + 1}) {q.texto}</p>
          <textarea
            className={`${inputClass} min-h-16`}
            value={respuestas[q.id] ?? ''}
            disabled={!canEditar}
            onChange={e => onChange(prev => ({ ...prev, [q.id]: e.target.value }))}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {canEditar && (
          <Button size="sm" onClick={onGuardar} disabled={bloqueado}>
            {guardando ? 'Guardando...' : 'Guardar informe'}
          </Button>
        )}
        {canEditar && otras && copiables > 0 && (
          <Button size="sm" variant="outline" className="gap-1 bg-transparent" disabled={bloqueado}
            onClick={() => onChange(prev => {
              const next = { ...prev }
              for (const q of preguntas) {
                if (!(next[q.id] ?? '').trim() && (otras.respuestas[q.id] ?? '').trim()) next[q.id] = otras.respuestas[q.id]
              }
              return next
            })}>
            <Copy className="h-4 w-4" /> Completar vacías con el informe para {otras.nombre} ({copiables})
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1 bg-transparent" onClick={onExportar}>
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>
    </Section>
  )
}

export default function CierrePanel(props: Props) {
  const { eventoId, estado, eventoInfo, canEditar, canVerCarismas, canVerInformeEqt, canVerInformeResponsables, canEditarConfidencial, canCerrar, canSubirFotos, fotos, conviventes, servidores, cecistas, preguntas, canVerInformeEconomico, inicial } = props
  const router = useRouter()

  const cerrado = estado === 'cerrado'
  const cecistaOptions = cecistas.map(p => ({ value: p.id, label: `${p.apellido}, ${p.nombre}` }))

  // ── Materiales ──
  const [bolsoCompleto, setBolsoCompleto] = useState<string>(
    inicial.cierre_bolso_manuales_completo === null ? '' : inicial.cierre_bolso_manuales_completo ? 'si' : 'no'
  )
  const [saldoFinal, setSaldoFinal] = useState(inicial.cierre_manuales_saldo_final == null ? '' : String(inicial.cierre_manuales_saldo_final))
  const [recibidosDe, setRecibidosDe] = useState(inicial.cierre_manuales_recibidos_de ?? '')
  const [entregoA, setEntregoA] = useState(inicial.cierre_manuales_entrego_a ?? '')
  const [notasMateriales, setNotasMateriales] = useState(inicial.cierre_manuales_notas ?? '')

  // ── Informes confidenciales ──
  const [respuestasEqt, setRespuestasEqt] = useState<Record<string, string>>(inicial.informe_eqt_respuestas ?? {})
  const [respuestasResponsables, setRespuestasResponsables] = useState<Record<string, string>>(inicial.informe_responsables_respuestas ?? {})
  const [carismas, setCarismas] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const c of inicial.informe_carismas ?? []) map[c.persona_id] = c.texto
    return map
  })


  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  async function patchCierre(payload: Record<string, unknown>, tag: string, okText: string) {
    setSaving(tag)
    setError('')
    setOkMsg('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/cierre`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al guardar')
      }
      setOkMsg(okText)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(null)
    }
  }

  function guardarMateriales() {
    patchCierre({
      cierre_bolso_manuales_completo: bolsoCompleto === '' ? null : bolsoCompleto === 'si',
      cierre_manuales_saldo_final: saldoFinal === '' ? null : Number(saldoFinal),
      cierre_manuales_recibidos_de: recibidosDe || null,
      cierre_manuales_entrego_a: entregoA || null,
      cierre_manuales_notas: notasMateriales || null,
    }, 'materiales', 'Materiales guardados.')
  }

  function guardarCarismas() {
    const arr = servidores.map(s => ({ persona_id: s.persona_id, texto: carismas[s.persona_id] ?? '' }))
    patchCierre({ informe_carismas: arr }, 'carismas', 'Informe de carismas guardado.')
  }


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-foreground">Cierre de la Convivencia</h3>
          <p className="text-xs text-muted-foreground">
            {cerrado
              ? 'El evento está cerrado. Los datos son de solo lectura.'
              : 'Cargá los entregables del cierre. Cuando esté todo listo, el Equipo Timón cierra la convivencia.'}
          </p>
        </div>
        {canCerrar && <CerrarConvivenciaButton eventoId={eventoId} />}
      </div>

      {(error || okMsg) && (
        <p className={`text-sm ${error ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{error || okMsg}</p>
      )}

      {/* 1. Listado de conviventes */}
      <Section icon={Users} title="Listado de conviventes">
        <p className="text-sm text-muted-foreground">{conviventes.length} convivente(s) registrado(s).</p>
        <div className="max-h-48 overflow-y-auto rounded border border-border divide-y divide-border">
          {conviventes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin conviventes registrados.</p>
          ) : conviventes.map(p => (
            <div key={p.persona_id} className="px-3 py-1.5 text-sm text-foreground flex justify-between gap-2">
              <span>{p.apellido}, {p.nombre}</span>
              <span className="text-xs text-muted-foreground">{p.rol}</span>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="gap-1 bg-transparent"
          onClick={() => exportConviventesPDF(eventoInfo, conviventes)}>
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </Section>

      {/* 2. Informe económico */}
      <Section icon={DollarSign} title="Informe económico">
        <p className="text-sm text-muted-foreground">
          El registro de ingresos y egresos (Caja, Banco, Mercado Pago) lo cargan el/los Centralizador(es) y el Tesorero en su propia pantalla.
        </p>
        {canVerInformeEconomico && (
          <Link href={`/eventos/${eventoId}/informe-economico`} className="text-sm font-medium text-primary hover:underline">
            Ir al Informe Económico →
          </Link>
        )}
      </Section>

      {/* 3 y 5. Fotos */}
      <Section icon={Camera} title="Fotos">
        <FotosCierre eventoId={eventoId} fotos={fotos} canSubir={canSubirFotos} />
      </Section>

      {/* 6. Informes de la CcD: uno para Responsables y otro para Equipo Timón,
          mismas preguntas, el coordinador completa los dos (confidenciales) */}
      {canVerInformeResponsables && (
        <InformeCcd
          titulo="Informe de la CcD (para Responsables)"
          preguntas={preguntas}
          respuestas={respuestasResponsables}
          onChange={setRespuestasResponsables}
          otras={canVerInformeEqt ? { nombre: 'Equipo Timón', respuestas: respuestasEqt } : null}
          canEditar={canEditarConfidencial}
          guardando={saving === 'responsables'}
          bloqueado={saving !== null}
          onGuardar={() => patchCierre({ informe_responsables_respuestas: respuestasResponsables }, 'responsables', 'Informe para Responsables guardado.')}
          onExportar={() => exportInformeCcdPDF(eventoInfo, 'responsables', preguntas, respuestasResponsables)}
        />
      )}
      {canVerInformeEqt && (
        <InformeCcd
          titulo="Informe de la CcD (para Equipo Timón)"
          preguntas={preguntas}
          respuestas={respuestasEqt}
          onChange={setRespuestasEqt}
          otras={canVerInformeResponsables ? { nombre: 'Responsables', respuestas: respuestasResponsables } : null}
          canEditar={canEditarConfidencial}
          guardando={saving === 'eqt'}
          bloqueado={saving !== null}
          onGuardar={() => patchCierre({ informe_eqt_respuestas: respuestasEqt }, 'eqt', 'Informe para Equipo Timón guardado.')}
          onExportar={() => exportInformeCcdPDF(eventoInfo, 'eqt', preguntas, respuestasEqt)}
        />
      )}

      {/* 7. Planilla de Carismas de Servidores (confidencial) */}
      {canVerCarismas && (
        <Section icon={Sparkles} title="Planilla de Carismas de Servidores" badge="Confidencial">
          {servidores.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay servidores, asesor ni coordinador registrados en el equipo.</p>
          ) : servidores.map(s => (
            <div key={s.persona_id} className="space-y-1">
              <p className="text-sm font-medium text-foreground">{s.apellido}, {s.nombre} <span className="text-xs text-muted-foreground">({s.rol} · {s.fraternidad ?? 'sin fraternidad registrada'})</span></p>
              <textarea
                className={`${inputClass} min-h-16`}
                value={carismas[s.persona_id] ?? ''}
                disabled={!canEditarConfidencial}
                onChange={e => setCarismas(prev => ({ ...prev, [s.persona_id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {canEditarConfidencial && (
              <Button size="sm" onClick={guardarCarismas} disabled={saving !== null}>
                {saving === 'carismas' ? 'Guardando...' : 'Guardar planilla'}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1 bg-transparent"
              onClick={() => exportInformeCarismasPDF(eventoInfo, servidores.map(s => ({ ...s, texto: carismas[s.persona_id] ?? '' })))}>
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>
        </Section>
      )}

      {/* 8 y 9. Materiales / Manuales */}
      <Section icon={Package} title="Materiales / Manuales">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bolso de manuales completo</p>
            <select className={inputClass} value={bolsoCompleto} disabled={!canEditar} onChange={e => setBolsoCompleto(e.target.value)}>
              <option value="">— Sin especificar —</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo final de manuales en stock</p>
            <input className={inputClass} type="number" min={0} value={saldoFinal} disabled={!canEditar} onChange={e => setSaldoFinal(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">De quién recibí los manuales</p>
            <Combobox value={recibidosDe} onSelect={setRecibidosDe} options={cecistaOptions}
              placeholder="Buscar cecista..." searchPlaceholder="Buscar por apellido o nombre..." emptyText="No se encontraron personas." disabled={!canEditar} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">A quién entrego los manuales</p>
            <Combobox value={entregoA} onSelect={setEntregoA} options={cecistaOptions}
              placeholder="Buscar cecista..." searchPlaceholder="Buscar por apellido o nombre..." emptyText="No se encontraron personas." disabled={!canEditar} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notas de materiales</p>
          <textarea className={`${inputClass} min-h-16`} value={notasMateriales} disabled={!canEditar} onChange={e => setNotasMateriales(e.target.value)} />
        </div>
        {canEditar && (
          <Button size="sm" onClick={guardarMateriales} disabled={saving !== null}>
            {saving === 'materiales' ? 'Guardando...' : 'Guardar materiales'}
          </Button>
        )}
      </Section>
    </div>
  )
}

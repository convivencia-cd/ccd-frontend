'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Ban, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDateAR } from '@/lib/utils'
import {
  MEDIOS,
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  calcularResumenEconomico,
  categoriasDe,
  formatMonto,
  libroDeMedio,
  resumenPorCategoria,
  saldosPorMedio,
  type BecaOtorgada,
  type InformeEconomicoData,
  type InformeEconomicoInfo,
  type Medio,
  type Movimiento,
  type SaldosIniciales,
  type VistaLibro,
} from '@/lib/eventos/informe-economico'

const inputClass = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground'
const fmt = (n: number) => `$${formatMonto(n)}`

type Props = {
  eventoId: string
  info: InformeEconomicoInfo
  movimientosIniciales: Movimiento[]
  saldosIniciales: SaldosIniciales
  becas: BecaOtorgada[]
  observaciones: string | null
  canEditar: boolean
}

type FormState = {
  tipo: 'ingreso' | 'egreso'
  medio: Medio
  categoria: string
  fecha: string
  monto: string
  concepto: string
}

const hoy = () => new Date().toISOString().slice(0, 10)

const POR_PAGINA = 20

/** Conceptos para el filtro: los de ingreso y egreso sin repetir (Inscripciones/Pensiones están en ambos). */
const CONCEPTOS_FILTRO = [...new Set<string>([...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO])].sort((a, b) => a.localeCompare(b))

function formVacio(medio: Medio): FormState {
  return { tipo: 'ingreso', medio, categoria: categoriasDe('ingreso')[0], fecha: hoy(), monto: '', concepto: '' }
}

export default function InformeEconomicoPanel(props: Props) {
  const { eventoId, info, becas, canEditar } = props
  const [movimientos, setMovimientos] = useState<Movimiento[]>(props.movimientosIniciales)
  const [saldosIni, setSaldosIni] = useState<SaldosIniciales>(props.saldosIniciales)
  const [observaciones, setObservaciones] = useState(props.observaciones ?? '')
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(props.observaciones ?? '')
  const [medioActivo, setMedioActivo] = useState<VistaLibro>('todos')
  const [verAnulados, setVerAnulados] = useState(false)
  const [form, setForm] = useState<FormState>(formVacio('caja'))
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [anulando, setAnulando] = useState<Movimiento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [filtroConcepto, setFiltroConcepto] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const formRef = useRef<HTMLDivElement>(null)

  const resumen = calcularResumenEconomico(movimientos)
  const saldosActuales = useMemo(() => saldosPorMedio(movimientos, saldosIni), [movimientos, saldosIni])
  const porCategoria = useMemo(() => resumenPorCategoria(movimientos), [movimientos])
  const esTodos = medioActivo === 'todos'
  const libro = useMemo(
    () => libroDeMedio(
      movimientos,
      medioActivo,
      medioActivo === 'todos' ? saldosIni.caja + saldosIni.banco + saldosIni.mp : saldosIni[medioActivo],
    ),
    [movimientos, medioActivo, saldosIni],
  )
  const colsTabla = 6 + (esTodos ? 1 : 0) + (canEditar ? 1 : 0)
  const cantAnulados = libro.asientos.length - libro.asientos.filter(a => !a.anulado_at).length
  // Los filtros se aplican DESPUÉS de calcular el libro: el saldo de cada fila
  // sigue siendo el saldo real acumulado, no el de las filas filtradas.
  const asientosFiltrados = libro.asientos.filter(a =>
    (verAnulados || !a.anulado_at) &&
    (!filtroConcepto || a.categoria === filtroConcepto) &&
    (!filtroDesde || (a.fecha ?? '') >= filtroDesde) &&
    (!filtroHasta || (a.fecha ?? '') <= filtroHasta),
  )
  const hayFiltros = !!(filtroConcepto || filtroDesde || filtroHasta)
  const totalPaginas = Math.max(1, Math.ceil(asientosFiltrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const asientosVisibles = asientosFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
  const totalesFiltrados = asientosFiltrados.reduce(
    (acc, a) => {
      if (a.anulado_at) return acc
      if (a.tipo === 'ingreso') acc.ingresos += Number(a.monto)
      else acc.egresos += Number(a.monto)
      return acc
    },
    { ingresos: 0, egresos: 0 },
  )
  const editando = editandoId ? movimientos.find(m => m.id === editandoId) ?? null : null
  const data: InformeEconomicoData = { info, movimientos, saldosIniciales: saldosIni, becas, observaciones: observacionesGuardadas || null }

  async function request(url: string, init?: RequestInit) {
    const res = await fetch(url, init)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'Error inesperado')
    return json
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  function reemplazar(mov: Movimiento) {
    setMovimientos(prev => prev.map(m => (m.id === mov.id ? mov : m)))
  }

  function guardarAsiento() {
    const monto = Number(form.monto)
    if (!Number.isFinite(monto) || monto <= 0) return toast.error('Ingresá un monto válido.')
    if (!form.fecha) return toast.error('La fecha es obligatoria.')
    const body = JSON.stringify({ ...form, monto })
    run(async () => {
      if (editandoId) {
        const { movimiento } = await request(`/api/eventos/${eventoId}/movimientos?movimiento_id=${editandoId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body,
        })
        reemplazar(movimiento)
        toast.success('Movimiento actualizado')
      } else {
        const { movimiento } = await request(`/api/eventos/${eventoId}/movimientos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        })
        setMovimientos(prev => [...prev, movimiento])
        toast.success('Movimiento registrado')
      }
      if (medioActivo !== 'todos') setMedioActivo(form.medio)
      setEditandoId(null)
      setForm({ ...formVacio(form.medio), tipo: form.tipo, categoria: form.categoria, fecha: form.fecha })
    })
  }

  function empezarEdicion(m: Movimiento) {
    setEditandoId(m.id)
    setForm({
      tipo: m.tipo, medio: m.medio, categoria: m.categoria,
      fecha: m.fecha ?? hoy(), monto: String(m.monto), concepto: m.concepto ?? '',
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function cambiarFiltro(fn: () => void) {
    fn()
    setPagina(1)
  }

  function limpiarFiltros() {
    setFiltroConcepto('')
    setFiltroDesde('')
    setFiltroHasta('')
    setPagina(1)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(formVacio(medioActivo === 'todos' ? 'caja' : medioActivo))
  }

  function confirmarAnulacion() {
    if (!anulando) return
    const mov = anulando
    const qs = new URLSearchParams({ movimiento_id: mov.id })
    if (motivo.trim()) qs.set('motivo', motivo.trim())
    run(async () => {
      const { movimiento } = await request(`/api/eventos/${eventoId}/movimientos?${qs}`, { method: 'DELETE' })
      reemplazar(movimiento)
      if (editandoId === mov.id) cancelarEdicion()
      toast.success('Movimiento anulado')
    })
    setAnulando(null)
    setMotivo('')
  }

  function guardarSaldoInicial(medio: Medio, valor: string) {
    const n = Number(valor || 0)
    if (!Number.isFinite(n) || n < 0) return toast.error('Saldo inicial inválido.')
    if (n === saldosIni[medio]) return
    run(async () => {
      await request(`/api/eventos/${eventoId}/informe-economico`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`saldo_inicial_${medio}`]: n }),
      })
      setSaldosIni(prev => ({ ...prev, [medio]: n }))
    })
  }

  function guardarObservaciones() {
    run(async () => {
      await request(`/api/eventos/${eventoId}/informe-economico`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones }),
      })
      setObservacionesGuardadas(observaciones)
      toast.success('Observaciones guardadas')
    })
  }

  const totalBecas = becas.reduce((s, b) => s + b.importe, 0)

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumenBox label="Ingresos" value={resumen.ingresos} tone="pos" />
        <ResumenBox label="Egresos" value={resumen.egresos} tone="neg" />
        <ResumenBox label="Saldo" value={resumen.saldo} tone={resumen.saldo >= 0 ? 'pos' : 'neg'} strong />
        <ResumenBox label="Diezmo (20% EqT)" value={resumen.diezmo} tone="neutral" strong />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {MEDIOS.map(m => (
            <span key={m.value} className="rounded-full border border-border px-3 py-1 text-muted-foreground">
              Saldo {m.corto}: <span className="font-medium text-foreground tabular-nums">{fmt(saldosActuales[m.value])}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1 bg-transparent"
            onClick={async () => (await import('@/lib/eventos/cierre-pdf')).exportInformeEconomicoPDF(data)}>
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-1 bg-transparent"
            onClick={async () => (await import('@/lib/eventos/informe-economico-xlsx')).exportInformeEconomicoXLSX(data)}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card">
      <CardContent className="pt-6">
        <Tabs defaultValue="registro">
          <TabsList>
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="informe">Informe</TabsTrigger>
          </TabsList>

          {/* ── Registro ── */}
          <TabsContent value="registro" className="space-y-4 pt-2">
            {canEditar && (
              <div ref={formRef} className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {editando ? 'Editar movimiento' : 'Nuevo movimiento'}
                  {editando?.pago_id && ' — registrado automáticamente desde Mercado Pago: solo se editan fecha y descripción'}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select className={inputClass} value={form.tipo} disabled={!!editando?.pago_id}
                    onChange={e => {
                      const tipo = e.target.value as 'ingreso' | 'egreso'
                      setForm(f => ({ ...f, tipo, categoria: categoriasDe(tipo)[0] }))
                    }}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                  <select className={inputClass} value={form.medio} disabled={!!editando?.pago_id}
                    onChange={e => setForm(f => ({ ...f, medio: e.target.value as Medio }))}>
                    {MEDIOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select className={inputClass} value={form.categoria} disabled={!!editando?.pago_id}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {categoriasDe(form.tipo).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className={inputClass} type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  <input className={inputClass} type="number" min={0} step="0.01" placeholder="Monto" value={form.monto}
                    disabled={!!editando?.pago_id} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  <input className={inputClass} type="text" placeholder="Descripción (ej.: a quién, qué)" value={form.concepto}
                    onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={guardarAsiento} disabled={busy} className="gap-1">
                    {editando ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editando ? 'Guardar cambios' : 'Registrar movimiento'}
                  </Button>
                  {editando && (
                    <Button size="sm" variant="outline" onClick={cancelarEdicion} disabled={busy} className="gap-1 bg-transparent">
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Las inscripciones pagadas por Mercado Pago se registran solas en el libro MP (concepto Inscripciones). Pensiones, efectivo y transferencias se cargan acá.
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border border-border p-0.5">
                {[{ value: 'todos' as const, corto: 'Todos' }, ...MEDIOS].map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => cambiarFiltro(() => setMedioActivo(m.value))}
                    className={`rounded px-3 py-1 text-sm ${medioActivo === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {m.corto}
                  </button>
                ))}
              </div>
              {cantAnulados > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={verAnulados} onChange={e => cambiarFiltro(() => setVerAnulados(e.target.checked))} />
                  Mostrar anulados ({cantAnulados})
                </label>
              )}
            </div>

            {/* Filtros */}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <label className="space-y-1 text-xs text-muted-foreground">
                Concepto
                <select className={inputClass} value={filtroConcepto} onChange={e => cambiarFiltro(() => setFiltroConcepto(e.target.value))}>
                  <option value="">Todos los conceptos</option>
                  {CONCEPTOS_FILTRO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Desde
                <input className={inputClass} type="date" value={filtroDesde} max={filtroHasta || undefined}
                  onChange={e => cambiarFiltro(() => setFiltroDesde(e.target.value))} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Hasta
                <input className={inputClass} type="date" value={filtroHasta} min={filtroDesde || undefined}
                  onChange={e => cambiarFiltro(() => setFiltroHasta(e.target.value))} />
              </label>
              <Button size="sm" variant="ghost" onClick={limpiarFiltros} disabled={!hayFiltros} className="gap-1">
                <X className="h-4 w-4" /> Limpiar
              </Button>
            </div>
            {hayFiltros && (
              <p className="text-xs text-muted-foreground">
                {asientosFiltrados.length} movimiento(s) con estos filtros · Ingresos{' '}
                <span className="font-medium text-green-600 dark:text-green-400 tabular-nums">{fmt(totalesFiltrados.ingresos)}</span> · Egresos{' '}
                <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">{fmt(totalesFiltrados.egresos)}</span>
              </p>
            )}

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    {esTodos && <th className="px-3 py-2 text-left font-medium">Medio</th>}
                    <th className="px-3 py-2 text-left font-medium">Concepto</th>
                    <th className="px-3 py-2 text-left font-medium">Descripción</th>
                    <th className="px-3 py-2 text-right font-medium">Ingreso</th>
                    <th className="px-3 py-2 text-right font-medium">Egreso</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo</th>
                    {canEditar && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {paginaActual === 1 && !filtroDesde && (
                  <tr className="border-b border-border bg-muted/20">
                    <td className="px-3 py-2" />
                    {esTodos && <td className="px-3 py-2" />}
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 font-medium text-foreground">
                      Saldo inicial{esTodos && <span className="ml-1 text-xs font-normal text-muted-foreground">(suma de los tres medios)</span>}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">
                      {canEditar && medioActivo !== 'todos' ? (
                        <input
                          key={`${medioActivo}-${saldosIni[medioActivo]}`}
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={saldosIni[medioActivo] || ''}
                          placeholder="0"
                          disabled={busy}
                          onBlur={e => guardarSaldoInicial(medioActivo, e.target.value)}
                          className="w-28 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                        />
                      ) : fmt(libro.saldoInicial)}
                    </td>
                    {canEditar && <td />}
                  </tr>
                  )}
                  {asientosVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={colsTabla} className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {hayFiltros
                          ? 'No hay movimientos con estos filtros.'
                          : esTodos ? 'Sin movimientos registrados.' : `Sin movimientos en ${MEDIOS.find(m => m.value === medioActivo)?.label}.`}
                      </td>
                    </tr>
                  ) : asientosVisibles.map(a => {
                    const anulado = !!a.anulado_at
                    return (
                      <tr
                        key={a.id}
                        className={`border-b border-border last:border-0 ${anulado ? 'text-muted-foreground line-through' : ''} ${editandoId === a.id ? 'bg-primary/5' : ''}`}
                        title={anulado && a.motivo_anulacion ? `Anulado: ${a.motivo_anulacion}` : undefined}
                      >
                        <td className="whitespace-nowrap px-3 py-2">{a.fecha ? formatDateAR(a.fecha) : '—'}</td>
                        {esTodos && (
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            {MEDIOS.find(m => m.value === a.medio)?.corto}
                          </td>
                        )}
                        <td className="px-3 py-2">{a.categoria}</td>
                        <td className="px-3 py-2">{a.concepto || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                          {a.tipo === 'ingreso' ? fmt(Number(a.monto)) : ''}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                          {a.tipo === 'egreso' ? fmt(Number(a.monto)) : ''}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.saldo != null ? fmt(a.saldo) : 'Anulado'}</td>
                        {canEditar && (
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {!anulado && (
                              <>
                                <button type="button" onClick={() => empezarEdicion(a)} disabled={busy}
                                  className="mr-2 text-muted-foreground hover:text-foreground disabled:opacity-40" title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => setAnulando(a)} disabled={busy}
                                  className="text-destructive hover:opacity-70 disabled:opacity-40" title="Anular">
                                  <Ban className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {asientosFiltrados.length > POR_PAGINA && (
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, asientosFiltrados.length)} de {asientosFiltrados.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="bg-transparent" disabled={paginaActual === 1}
                    onClick={() => setPagina(paginaActual - 1)} aria-label="Página anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">Página {paginaActual} de {totalPaginas}</span>
                  <Button size="sm" variant="outline" className="bg-transparent" disabled={paginaActual === totalPaginas}
                    onClick={() => setPagina(paginaActual + 1)} aria-label="Página siguiente">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

          </TabsContent>

          {/* ── Informe (réplica de la hoja "Informe Economico") ── */}
          <TabsContent value="informe" className="space-y-5 pt-2">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Dato label="Evento" value={info.nombre} />
              <Dato label="Fechas" value={[info.fecha_inicio, info.fecha_fin].filter(Boolean).map(f => formatDateAR(f!.split('T')[0])).join(' al ')} />
              <Dato label="Lugar" value={info.lugar} />
              <Dato label="Confraternidad / Fraternidad" value={[info.confraternidad, info.fraternidad].filter(Boolean).join(' - ')} />
              <Dato label="Cantidad de asistentes" value={String(info.asistentes)} />
              <Dato label="Equipo de Servidores y Auxiliar" value={`${info.servidores + info.auxiliares} (${info.servidores} servidores + ${info.auxiliares} auxiliares)`} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TablaConceptos titulo="Ingresos" filas={porCategoria.ingresos} total={resumen.ingresos} tone="pos" />
              <TablaConceptos titulo="Egresos" filas={porCategoria.egresos} total={resumen.egresos} tone="neg" />
            </div>

            <div className="max-w-sm space-y-1 rounded-md border border-border p-3 text-sm">
              <FilaTotal label="Total Ingresos" value={resumen.ingresos} />
              <FilaTotal label="Total Egresos" value={resumen.egresos} />
              <FilaTotal label="Saldo" value={resumen.saldo} strong />
              <FilaTotal label="Diezmo al EqT (20%)" value={resumen.diezmo} strong />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Becas otorgadas</h4>
                {becas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin becas. Se cargan en el panel “Becas en Pensión”.</p>
                ) : (
                  <div className="rounded-md border border-border text-sm">
                    {becas.map((b, i) => (
                      <div key={i} className="flex justify-between border-b border-border px-3 py-1.5 last:border-0">
                        <span>{b.nombre}</span>
                        <span className="tabular-nums">{fmt(b.importe)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between bg-muted/30 px-3 py-1.5 font-medium">
                      <span>Total</span>
                      <span className="tabular-nums">{fmt(totalBecas)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor inscripción</h4>
                <p className="text-sm tabular-nums">{info.valor_inscripcion != null ? fmt(info.valor_inscripcion) : '—'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observaciones</h4>
              {canEditar ? (
                <>
                  <textarea className={`${inputClass} min-h-20`} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                  {observaciones !== observacionesGuardadas && (
                    <Button size="sm" onClick={guardarObservaciones} disabled={busy}>Guardar observaciones</Button>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">{observacionesGuardadas || '—'}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </CardContent>
      </Card>

      <ConfirmDialog
        open={!!anulando}
        onOpenChange={open => { if (!open) { setAnulando(null); setMotivo('') } }}
        titulo="Anular movimiento"
        descripcion={anulando ? `${anulando.categoria} — ${fmt(Number(anulando.monto))}. Deja de contar en los saldos y totales, pero queda registrado como anulado.` : undefined}
        confirmar="Anular"
        tono="destructivo"
        onConfirm={confirmarAnulacion}
      >
        <input className={inputClass} placeholder="Motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
      </ConfirmDialog>
    </div>
  )
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || '—'}</p>
    </div>
  )
}

function TablaConceptos({ titulo, filas, total, tone }: {
  titulo: string; filas: { categoria: string; total: number }[]; total: number; tone: 'pos' | 'neg'
}) {
  return (
    <div className="rounded-md border border-border text-sm">
      <div className="flex justify-between border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{titulo}</span>
        <span>Total</span>
      </div>
      {filas.map(f => (
        <div key={f.categoria} className={`flex justify-between px-3 py-1 ${f.total === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
          <span>{f.categoria}</span>
          <span className="tabular-nums">{fmt(f.total)}</span>
        </div>
      ))}
      <div className={`flex justify-between border-t border-border px-3 py-2 font-semibold ${tone === 'pos' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        <span>Total {titulo.toLowerCase()}</span>
        <span className="tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  )
}

function FilaTotal({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  )
}

function ResumenBox({ label, value, tone, strong }: { label: string; value: number; tone: 'pos' | 'neg' | 'neutral'; strong?: boolean }) {
  const color = tone === 'pos' ? 'text-green-600 dark:text-green-400'
    : tone === 'neg' ? 'text-red-600 dark:text-red-400'
    : 'text-foreground'
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`${strong ? 'text-base font-bold' : 'text-sm font-medium'} ${color} tabular-nums`}>{fmt(value)}</p>
    </div>
  )
}

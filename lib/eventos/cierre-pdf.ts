// PDF export helpers para el cierre de convivencia. Usa jsPDF (importado dinámicamente).
// Client-only.
import type jsPDF from 'jspdf'
import { formatDateAR } from '@/lib/utils'
import type { PreguntaInforme } from './cierre'
import { formatMonto } from './cierre'
import {
  calcularResumenEconomico,
  libroDeMedio,
  MEDIOS,
  nombreArchivoInforme,
  resumenPorCategoria,
  type InformeEconomicoData,
} from './informe-economico'

const fmt = (n: number) => `$${formatMonto(n)}`

const MARGIN = 15
const LINE = 6

type Cursor = { doc: jsPDF; y: number }

function nuevaPagina(c: Cursor) {
  c.doc.addPage()
  c.y = MARGIN
}

function ensureSpace(c: Cursor, needed: number) {
  const pageH = c.doc.internal.pageSize.getHeight()
  if (c.y + needed > pageH - MARGIN) nuevaPagina(c)
}

function writeWrapped(c: Cursor, text: string, opts?: { size?: number; bold?: boolean; gap?: number }) {
  const size = opts?.size ?? 11
  const pageW = c.doc.internal.pageSize.getWidth()
  c.doc.setFontSize(size)
  c.doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  const lines = c.doc.splitTextToSize(text || '—', pageW - MARGIN * 2) as string[]
  for (const line of lines) {
    ensureSpace(c, LINE)
    c.doc.text(line, MARGIN, c.y)
    c.y += LINE
  }
  if (opts?.gap) c.y += opts.gap
}

function encabezado(c: Cursor, titulo: string, evento: EventoInfo) {
  writeWrapped(c, titulo, { size: 16, bold: true })
  c.y += 1
  const sub = [
    evento.nombre,
    evento.fecha_inicio ? formatDateAR(evento.fecha_inicio.split('T')[0]) : null,
    evento.confraternidad_nombre,
  ].filter(Boolean).join('  ·  ')
  writeWrapped(c, sub, { size: 10 })
  c.y += 2
  const pageW = c.doc.internal.pageSize.getWidth()
  c.doc.setDrawColor(180)
  c.doc.line(MARGIN, c.y, pageW - MARGIN, c.y)
  c.y += 6
}

async function nuevoDoc(): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf')
  return new JsPDF({ unit: 'mm', format: 'a4' })
}

function nombreArchivo(evento: EventoInfo, sufijo: string): string {
  const base = (evento.nombre || 'evento').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return `${base}-${sufijo}.pdf`
}

export type EventoInfo = {
  nombre: string
  fecha_inicio: string | null
  confraternidad_nombre: string | null
  /** Casa de retiro / ciudad — encabezado de los informes para Equipo Timón. */
  lugar?: string | null
}

// ─── Listado de conviventes ───────────────────────────────────────────────────

export async function exportConviventesPDF(
  evento: EventoInfo,
  conviventes: { nombre: string; apellido: string; email?: string | null; telefono?: string | null; rol: string }[],
) {
  const doc = await nuevoDoc()
  const c: Cursor = { doc, y: MARGIN }
  encabezado(c, 'Listado de Conviventes', evento)
  writeWrapped(c, `Total: ${conviventes.length}`, { size: 10, gap: 2 })
  conviventes.forEach((p, i) => {
    const contacto = [p.email, p.telefono].filter(Boolean).join(' · ')
    const linea = `${i + 1}. ${p.apellido}, ${p.nombre}${p.rol ? `  (${p.rol})` : ''}${contacto ? `  —  ${contacto}` : ''}`
    writeWrapped(c, linea, { size: 10 })
  })
  doc.save(nombreArchivo(evento, 'conviventes'))
}

// ─── Informes confidenciales: mismo formato que los Word de la Comunidad ──────

function centrado(c: Cursor, text: string, opts?: { size?: number; bold?: boolean }) {
  const pageW = c.doc.internal.pageSize.getWidth()
  c.doc.setFontSize(opts?.size ?? 11)
  c.doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  ensureSpace(c, LINE)
  c.doc.text(text, pageW / 2, c.y, { align: 'center' })
  c.y += LINE
}

/** Encabezado de los Word: título centrado + Cc / Fecha / Lugar / Confraternidad. */
function encabezadoPlanilla(c: Cursor, titulos: string[], evento: EventoInfo) {
  titulos.forEach((t, i) => centrado(c, t, { size: i === 0 ? 15 : 12, bold: true }))
  centrado(c, '(Para Equipo Timón)', { size: 10 })
  c.y += 3
  const fecha = evento.fecha_inicio ? formatDateAR(evento.fecha_inicio.split('T')[0]) : '—'
  writeWrapped(c, `Cc: ${evento.nombre}`, { size: 11 })
  writeWrapped(c, `Fecha de inicio: ${fecha}`, { size: 11 })
  writeWrapped(c, `Lugar: ${evento.lugar || '—'}`, { size: 11 })
  writeWrapped(c, `Confraternidad: ${evento.confraternidad_nombre || '—'}`, { size: 11, gap: 2 })
  const pageW = c.doc.internal.pageSize.getWidth()
  c.doc.setDrawColor(180)
  c.doc.line(MARGIN, c.y, pageW - MARGIN, c.y)
  c.y += 7
}

function firma(c: Cursor, texto: string) {
  ensureSpace(c, 30)
  c.y += 16
  c.doc.setDrawColor(120)
  c.doc.line(MARGIN, c.y, MARGIN + 70, c.y)
  c.y += 5
  writeWrapped(c, texto, { size: 10 })
}

export const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

// ─── Informe de la CcD para Equipo Timón (confidencial) ───────────────────────

export async function exportInformeEqtPDF(
  evento: EventoInfo,
  preguntas: PreguntaInforme[],
  respuestas: Record<string, string>,
) {
  const doc = await nuevoDoc()
  const c: Cursor = { doc, y: MARGIN }
  encabezadoPlanilla(c, ['INFORME DE LA CcD'], evento)
  preguntas.forEach((p, i) => {
    writeWrapped(c, `${ROMANOS[i] ?? i + 1}) ${p.texto}`, { size: 11, bold: true })
    writeWrapped(c, respuestas?.[p.id] || '—', { size: 11, gap: 4 })
  })
  firma(c, 'Firma y aclaración — Coordinador')
  doc.save(nombreArchivo(evento, 'informe-equipo-timon'))
}

// ─── Planilla de Carismas de Servidores (confidencial) ────────────────────────

const ETIQUETA_CARISMA: Record<string, string> = { servidor: 'SERVIDOR', asesor: 'ASESOR', coordinador: 'COORDINADOR' }

export async function exportInformeCarismasPDF(
  evento: EventoInfo,
  carismas: { nombre: string; apellido: string; rol: string; fraternidad: string | null; texto: string }[],
) {
  const doc = await nuevoDoc()
  const c: Cursor = { doc, y: MARGIN }
  encabezadoPlanilla(c, ['EVALUACIÓN', '(CARISMA DE SERVIDORES)'], evento)
  carismas.forEach(item => {
    const etiqueta = ETIQUETA_CARISMA[item.rol] ?? item.rol.toUpperCase()
    const quien = `${item.apellido}, ${item.nombre} — Fraternidad: ${item.fraternidad || 'sin fraternidad registrada'}`
    writeWrapped(c, `${etiqueta}: ${quien}`, { size: 11, bold: true })
    writeWrapped(c, item.texto || '—', { size: 11, gap: 4 })
  })
  firma(c, 'Firma del Coordinador')
  doc.save(nombreArchivo(evento, 'planilla-carismas'))
}

// ─── Informe económico (réplica de la hoja "Informe Economico" + registro por medio) ─

export async function exportInformeEconomicoPDF({ info, movimientos, saldosIniciales, becas, observaciones }: InformeEconomicoData) {
  const doc = await nuevoDoc()
  const c: Cursor = { doc, y: MARGIN }
  const pageW = doc.internal.pageSize.getWidth()
  const colW = (pageW - MARGIN * 2 - 6) / 2
  const xDer = MARGIN + colW + 6

  const center = (text: string, size: number, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    ensureSpace(c, LINE)
    doc.text(text, pageW / 2, c.y, { align: 'center' })
    c.y += LINE
  }
  const fechaAR = (f: string | null) => (f ? formatDateAR(f.split('T')[0]) : '')
  // Fila "etiqueta ........ monto" dentro de una columna
  const fila = (x: number, y: number, label: string, monto: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, x, y)
    doc.text(fmt(monto), x + colW, y, { align: 'right' })
  }

  center('COMUNIDAD CONVIVENCIA CON DIOS', 13, true)
  center('INFORME ECONÓMICO', 12, true)
  center(info.nombre, 11)
  const fechas = [fechaAR(info.fecha_inicio), fechaAR(info.fecha_fin)].filter(Boolean).join(' al ')
  if (fechas) center(fechas, 10)
  const lugar = [info.lugar, info.confraternidad, info.fraternidad].filter(Boolean).join(' - ')
  if (lugar) center(lugar, 10)
  c.y += 3

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Cantidad de Asistentes', MARGIN, c.y)
  doc.text(String(info.asistentes), MARGIN + colW, c.y, { align: 'right' })
  doc.text('Equipo de Servidores y Auxiliar', xDer, c.y)
  doc.text(String(info.servidores + info.auxiliares), xDer + colW, c.y, { align: 'right' })
  c.y += LINE + 2

  // Tabla de conceptos en dos columnas
  const { ingresos: porIngreso, egresos: porEgreso } = resumenPorCategoria(movimientos)
  doc.setFont('helvetica', 'bold')
  doc.text('INGRESOS', MARGIN, c.y)
  doc.text('TOTAL', MARGIN + colW, c.y, { align: 'right' })
  doc.text('EGRESOS', xDer, c.y)
  doc.text('TOTAL', xDer + colW, c.y, { align: 'right' })
  c.y += 2
  doc.setDrawColor(180)
  doc.line(MARGIN, c.y, pageW - MARGIN, c.y)
  c.y += LINE - 1
  const filas = Math.max(porIngreso.length, porEgreso.length)
  for (let i = 0; i < filas; i++) {
    ensureSpace(c, LINE)
    if (porIngreso[i]) fila(MARGIN, c.y, porIngreso[i].categoria, porIngreso[i].total)
    if (porEgreso[i]) fila(xDer, c.y, porEgreso[i].categoria, porEgreso[i].total)
    c.y += LINE - 0.5
  }
  c.y += 3

  const { ingresos, egresos, saldo, diezmo } = calcularResumenEconomico(movimientos)
  ensureSpace(c, LINE * 4)
  fila(MARGIN, c.y, 'Total Ingresos', ingresos, true); c.y += LINE
  fila(MARGIN, c.y, 'Total Egresos', egresos, true); c.y += LINE
  fila(MARGIN, c.y, 'Saldo', saldo, true); c.y += LINE
  fila(MARGIN, c.y, 'Diezmo al EqT (20%)', diezmo, true); c.y += LINE + 4

  // Becas + valor inscripción
  ensureSpace(c, LINE * 3)
  doc.setFont('helvetica', 'bold')
  doc.text('BECAS OTORGADAS', MARGIN, c.y)
  if (info.valor_inscripcion != null) {
    doc.text('Valor Inscripción', xDer, c.y)
    doc.text(fmt(info.valor_inscripcion), xDer + colW, c.y, { align: 'right' })
  }
  c.y += LINE
  if (becas.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.text('Sin becas otorgadas.', MARGIN, c.y)
    c.y += LINE
  } else {
    for (const b of becas) {
      ensureSpace(c, LINE)
      fila(MARGIN, c.y, b.nombre, b.importe)
      c.y += LINE - 0.5
    }
    fila(MARGIN, c.y, 'Total becas', becas.reduce((s, b) => s + b.importe, 0), true)
    c.y += LINE
  }
  c.y += 3
  writeWrapped(c, 'Observaciones', { size: 10, bold: true })
  writeWrapped(c, observaciones || '—', { size: 10, gap: 2 })

  // Anexo: registro por medio (hoja "Registro")
  nuevaPagina(c)
  writeWrapped(c, `Registro de movimientos — ${info.nombre}`, { size: 13, bold: true, gap: 2 })
  const cols = [MARGIN, MARGIN + 22, MARGIN + 70, pageW - MARGIN - 50, pageW - MARGIN - 25, pageW - MARGIN]
  for (const m of MEDIOS) {
    const libro = libroDeMedio(movimientos, m.value, saldosIniciales[m.value])
    ensureSpace(c, LINE * 4)
    c.y += 2
    writeWrapped(c, m.label.toUpperCase(), { size: 11, bold: true })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha', cols[0], c.y)
    doc.text('Concepto', cols[1], c.y)
    doc.text('Descripción', cols[2], c.y)
    doc.text('Ingreso', cols[3], c.y, { align: 'right' })
    doc.text('Egreso', cols[4], c.y, { align: 'right' })
    doc.text('Saldo', cols[5], c.y, { align: 'right' })
    c.y += LINE - 1
    doc.setFont('helvetica', 'normal')
    doc.text('Saldo inicial', cols[2], c.y)
    doc.text(fmt(libro.saldoInicial), cols[5], c.y, { align: 'right' })
    c.y += LINE - 1
    for (const a of libro.asientos) {
      if (a.anulado_at) continue
      ensureSpace(c, LINE)
      doc.setFontSize(8)
      doc.text(fechaAR(a.fecha), cols[0], c.y)
      doc.text(doc.splitTextToSize(a.categoria, 46)[0] ?? '', cols[1], c.y)
      doc.text(doc.splitTextToSize(a.concepto ?? '', cols[3] - cols[2] - 22)[0] ?? '', cols[2], c.y)
      if (a.tipo === 'ingreso') doc.text(fmt(Number(a.monto)), cols[3], c.y, { align: 'right' })
      else doc.text(fmt(Number(a.monto)), cols[4], c.y, { align: 'right' })
      doc.text(fmt(a.saldo ?? 0), cols[5], c.y, { align: 'right' })
      c.y += LINE - 1
    }
  }

  doc.save(nombreArchivoInforme(info.nombre, 'pdf'))
}

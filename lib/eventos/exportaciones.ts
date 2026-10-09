// Exports de Gestión del Evento (card #54): cartelitos en Word y dietas en
// Excel, ambos editables. Client-only: docx y xlsx se importan dinámicamente
// para no inflar el bundle, igual que en informe-economico-xlsx.ts.
import { labelRestriccion } from './inscripcion-datos'
import { ROLES_EVENTO_LABEL } from './equipo'

/** Una persona que va a estar en la casa (participante o equipo). La arma /api/eventos/[id]/exportaciones. */
export type FilaExportacion = {
  nombre: string
  apellido: string
  apodo: string | null
  localidad: string | null
  rol_en_evento: string
  /** Completó el formulario del link de pago (los del equipo no lo completan). */
  completo_inscripcion: boolean
  restricciones_alimentarias: string[]
  /** `null` también cuando quien exporta no puede ver datos sensibles. */
  dieta_detalle: string | null
}

const porApellido = (a: FilaExportacion, b: FilaExportacion) =>
  a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es')

function nombreArchivo(prefijo: string, evento: string, ext: string) {
  const slug = evento
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${prefijo}-${slug || 'evento'}.${ext}`
}

function descargar(blob: Blob, archivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ─── Cartelitos ──────────────────────────────────────────────────────────────
// Pedido de la comunidad: apodo en mayúsculas y localidad abajo (sin pasar a
// mayúsculas), 85 mm de ancho x 55 mm de alto, por duplicado. Van en una tabla
// de 2 columnas sobre A4 con bordes para recortar: cada fila es la misma
// persona dos veces, 5 personas por hoja.

const CARTEL_ANCHO_MM = 85
const CARTEL_ALTO_MM = 55

/** Tamaño de letra (en medios puntos, como pide Word) para que el apodo entre en 85 mm. */
function tamanioNombre(texto: string) {
  if (texto.length <= 9) return 64
  if (texto.length <= 12) return 52
  if (texto.length <= 16) return 40
  return 32
}

export async function exportCartelitosDOCX(evento: string, filas: FilaExportacion[]) {
  const {
    AlignmentType,
    BorderStyle,
    convertMillimetersToTwip,
    Document,
    HeightRule,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx')

  const ancho = convertMillimetersToTwip(CARTEL_ANCHO_MM)
  const alto = convertMillimetersToTwip(CARTEL_ALTO_MM)
  const borde = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }

  const cartel = (f: FilaExportacion) => {
    const nombre = (f.apodo?.trim() || f.nombre.trim()).toUpperCase()
    const localidad = f.localidad?.trim() ?? ''
    return new TableCell({
      width: { size: ancho, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      borders: bordes,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: nombre, bold: true, size: tamanioNombre(nombre), font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: localidad, bold: true, size: 32, font: 'Arial', color: 'C00000' })],
        }),
      ],
    })
  }

  const rows = [...filas].sort(porApellido).map(
    f =>
      new TableRow({
        height: { value: alto, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [cartel(f), cartel(f)],
      })
  )

  const doc = new Document({
    creator: 'Convivencia con Dios',
    title: `Cartelitos — ${evento}`,
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(10),
              bottom: convertMillimetersToTwip(10),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: [
          new Table({
            layout: TableLayoutType.FIXED,
            width: { size: ancho * 2, type: WidthType.DXA },
            columnWidths: [ancho, ancho],
            rows,
          }),
        ],
      },
    ],
  })

  descargar(await Packer.toBlob(doc), nombreArchivo('cartelitos', evento, 'docx'))
}

// ─── Dietas ──────────────────────────────────────────────────────────────────

export async function exportDietasXLSX(evento: string, filas: FilaExportacion[], verSensibles: boolean) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ordenadas = [...filas].sort(porApellido)

  // ── Dietas: una fila por persona ──
  const encabezado = ['Apellido', 'Nombre', 'Rol', 'Restricciones alimentarias', ...(verSensibles ? ['Detalle de la dieta'] : [])]
  const detalle = ordenadas.map(f => [
    f.apellido,
    f.nombre,
    ROLES_EVENTO_LABEL[f.rol_en_evento] ?? f.rol_en_evento,
    f.completo_inscripcion ? f.restricciones_alimentarias.map(labelRestriccion).join(', ') : 'Sin datos',
    ...(verSensibles ? [f.dieta_detalle ?? ''] : []),
  ])
  const wsDietas = XLSX.utils.aoa_to_sheet([encabezado, ...detalle])
  wsDietas['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 40 }, ...(verSensibles ? [{ wch: 50 }] : [])]
  wsDietas['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detalle.length, c: encabezado.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, wsDietas, 'Dietas')

  // ── Resumen: cuántas personas por restricción, para la cocina ──
  const conteo = new Map<string, number>()
  let sinDatos = 0
  for (const f of filas) {
    if (!f.completo_inscripcion) {
      sinDatos++
      continue
    }
    for (const r of f.restricciones_alimentarias) conteo.set(r, (conteo.get(r) ?? 0) + 1)
  }
  const resumen: (string | number)[][] = [
    [evento],
    [],
    ['Restricción', 'Personas'],
    ...[...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => [labelRestriccion(r), n]),
    ...(sinDatos > 0 ? [['Sin datos (no completaron la inscripción)', sinDatos]] : []),
    [],
    ['Total de personas', filas.length],
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 42 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  XLSX.writeFile(wb, nombreArchivo('dietas', evento, 'xlsx'))
}

// Exportación de las fichas de inscripción de un evento (card #97). Mismo
// contenido que la ficha que se abre de a una (ficha-inscripcion-dialog.tsx):
// PDF con una ficha por hoja, y Excel con una fila por persona.
// Client-only (jspdf y xlsx se cargan al exportar).
import type jsPDF from 'jspdf'
import {
  labelComoSeEntero,
  labelEstadoCivil,
  labelEstadoEclesial,
  labelNivelEstudios,
  labelRangoEclesial,
  labelRestriccion,
  labelSexo,
  type InscripcionDatos,
} from './inscripcion-datos'

export type FichaExport = {
  /** estado_participacion, salvo 'preinscripto' (interesado con planilla). */
  estado: string
  persona: Record<string, string | null>
  inscripcion: InscripcionDatos | null
  realizados: { nombre: string; anio: number | null }[]
}

const ESTADO_LABEL: Record<string, string> = {
  preinscripto: 'Preinscripto',
  inscripto: 'Inscripto',
  en_curso: 'Convivente',
  completado: 'Completado',
  lista_espera: 'Lista de espera',
}

const OCULTO = 'Oculto (requiere permiso para ver datos sensibles)'

type Seccion = { titulo: string; datos: { label: string; valor: string }[] }

function fecha(valor: string | null | undefined): string {
  if (!valor) return ''
  const [a, m, d] = valor.split('T')[0].split('-')
  return a && m && d ? `${d}/${m}/${a}` : valor
}

const unir = (partes: (string | null | undefined)[], sep: string) => partes.filter(p => p && p.trim()).join(sep)

function secciones(f: FichaExport, verSensibles: boolean): Seccion[] {
  const p = f.persona
  const i = f.inscripcion
  const familia =
    i?.familia_hizo_convivencias == null ? '' : i.familia_hizo_convivencias ? unir(['Sí', i.familia_quien], ' — ') : 'No'

  return [
    {
      titulo: 'Datos personales',
      datos: [
        { label: 'Sobrenombre', valor: p.apodo ?? '' },
        { label: 'Sexo', valor: labelSexo(p.sexo) },
        { label: 'Documento', valor: unir([p.tipo_documento?.toUpperCase(), p.documento], ' ') },
        { label: 'Fecha de nacimiento', valor: fecha(p.fecha_nacimiento) },
        { label: 'Estado civil', valor: labelEstadoCivil(p.estado_vida) },
        { label: 'Nacionalidad', valor: p.nacionalidad ?? '' },
        { label: 'Nivel de estudios', valor: labelNivelEstudios(p.nivel_estudios) },
        { label: 'Ocupación o profesión', valor: p.ocupacion ?? '' },
      ],
    },
    {
      titulo: 'Contacto y domicilio',
      datos: [
        { label: 'Teléfono', valor: p.telefono ?? '' },
        { label: 'Email', valor: p.email ?? '' },
        { label: 'Domicilio', valor: unir([p.direccion, p.direccion_nro], ' ') },
        { label: 'Localidad', valor: unir([p.localidad, p.provincia, p.pais], ', ') },
        { label: 'Código postal', valor: p.codigo_postal ?? '' },
      ],
    },
    {
      titulo: 'Vida de fe',
      datos: [
        {
          label: 'Estado eclesial',
          valor: unir(
            [labelEstadoEclesial(p.estado_eclesial), labelRangoEclesial(p.estado_eclesial_rango), p.institucion_religiosa],
            ' — '
          ),
        },
        { label: 'Diócesis', valor: p.diocesis ?? '' },
        { label: 'Formación religiosa', valor: p.formacion_religiosa ?? '' },
        { label: 'Participación en grupos de la Iglesia', valor: p.participacion_grupos_iglesia ?? '' },
        { label: 'Acción social', valor: p.accion_social ?? '' },
        {
          label: 'Convivencias realizadas',
          valor: f.realizados.map(c => (c.anio ? `${c.nombre} (${c.anio})` : c.nombre)).join(', '),
        },
      ],
    },
    {
      titulo: 'Sobre esta convivencia',
      datos: [
        { label: '¿Cómo se enteró?', valor: i ? unir([labelComoSeEntero(i.como_se_entero), i.como_se_entero_otro], ' — ') : '' },
        { label: '¿Alguien de su familia hizo convivencias?', valor: familia },
        { label: 'Asiste con', valor: i?.acompanante ?? '' },
        { label: 'Dificultad con el horario de llegada o salida', valor: i?.dificultad_horario ?? '' },
        { label: 'Restricciones alimentarias', valor: i ? i.restricciones_alimentarias.map(labelRestriccion).join(', ') : '' },
        { label: 'Detalle de la dieta', valor: verSensibles ? (i?.dieta_detalle ?? '') : OCULTO },
        { label: 'Salud / algo importante a saber', valor: verSensibles ? (i?.salud_observaciones ?? '') : OCULTO },
      ],
    },
  ]
}

function nombreArchivo(eventoNombre: string, extension: 'pdf' | 'xlsx') {
  const base = (eventoNombre || 'evento').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return `${base}-fichas-inscripcion.${extension}`
}

const nombreCompleto = (f: FichaExport) => unir([f.persona.apellido, f.persona.nombre], ', ')

// ─── PDF ──────────────────────────────────────────────────────────────────────

const MARGEN = 15
const ANCHO_LABEL = 62

export async function exportFichasPDF(eventoNombre: string, fichas: FichaExport[], verSensibles: boolean) {
  const { default: JsPDF } = await import('jspdf')
  const doc: jsPDF = new JsPDF({ unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoValor = anchoPagina - MARGEN * 2 - ANCHO_LABEL
  let y = MARGEN

  const asegurarEspacio = (alto: number) => {
    if (y + alto <= altoPagina - MARGEN) return
    doc.addPage()
    y = MARGEN
  }

  fichas.forEach((f, idx) => {
    if (idx > 0) doc.addPage()
    y = MARGEN

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(110)
    doc.text(`Comunidad Convivencia con Dios · ${eventoNombre}`, MARGEN, y)
    doc.text('Ficha de inscripción', anchoPagina - MARGEN, y, { align: 'right' })
    y += 9

    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(nombreCompleto(f) || '—', MARGEN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(ESTADO_LABEL[f.estado] ?? f.estado, anchoPagina - MARGEN, y, { align: 'right' })
    y += 3
    doc.setDrawColor(180)
    doc.line(MARGEN, y, anchoPagina - MARGEN, y)
    y += 7

    for (const s of secciones(f, verSensibles)) {
      asegurarEspacio(14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(s.titulo.toUpperCase(), MARGEN, y)
      y += 6

      for (const d of s.datos) {
        doc.setFontSize(9)
        const lineasLabel = doc.splitTextToSize(d.label, ANCHO_LABEL - 3) as string[]
        const lineasValor = doc.splitTextToSize(d.valor.trim() || '—', anchoValor) as string[]
        const alto = Math.max(lineasLabel.length, lineasValor.length) * 4.2 + 1.5
        asegurarEspacio(alto)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(110)
        doc.text(lineasLabel, MARGEN, y)
        doc.setTextColor(0)
        doc.text(lineasValor, MARGEN + ANCHO_LABEL, y)
        y += alto
      }
      y += 4
    }
  })

  doc.save(nombreArchivo(eventoNombre, 'pdf'))
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function exportFichasXLSX(eventoNombre: string, fichas: FichaExport[], verSensibles: boolean) {
  const XLSX = await import('xlsx')
  const columnas = secciones(fichas[0], verSensibles).flatMap(s => s.datos.map(d => d.label))
  const encabezado = ['Apellido', 'Nombre', 'Estado', ...columnas]
  const filas = fichas.map(f => [
    f.persona.apellido ?? '',
    f.persona.nombre ?? '',
    ESTADO_LABEL[f.estado] ?? f.estado,
    ...secciones(f, verSensibles).flatMap(s => s.datos.map(d => d.valor)),
  ])

  const ws = XLSX.utils.aoa_to_sheet([encabezado, ...filas])
  ws['!cols'] = encabezado.map((_, c) => ({ wch: c < 3 ? 18 : 24 }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezado.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fichas')
  XLSX.writeFile(wb, nombreArchivo(eventoNombre, 'xlsx'))
}

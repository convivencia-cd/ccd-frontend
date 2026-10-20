// Listado Final de Conviventes (card "Listado Final de Conviventes", minuta #138).
// Réplica del formato que usa la Comunidad ("FORMATO LISTA DE CONVIVENTES"):
// encabezado con el evento, Coordinador y Asesor arriba, un bloque por grupo
// con su servidor en negrita y sus conviventes, y al final Ministerio de
// Música, Equipo Auxiliar y Centralizadores. A4 apaisado, una fila por persona.
//
// Los datos (DNI, domicilio, cumpleaños) se piden recién al exportar: no hace
// falta mandarlos a la página para mostrar el listado del cierre.
// Client-only.
import type jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase/client'

type PersonaListado = {
  nombre: string
  apellido: string
  documento: string | null
  direccion: string | null
  direccion_nro: string | null
  localidad: string | null
  provincia: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  email: string | null
}

/** Una fila del listado. Los centralizadores sin persona cargada solo tienen nombre, mail y teléfono. */
export type FilaListado = Partial<PersonaListado> & { nombreCompleto: string }

export type BloqueListado = {
  titulo: string
  /** Rótulo de la fila destacada (ej. "Servidor:"); sin rótulo, todas las filas van destacadas. */
  rotulo?: string
  /** Para el Excel: nombre del grupo y rol de las filas destacadas (las demás son conviventes). */
  grupo?: string
  rolDestacados: string
  destacados: FilaListado[]
  filas: FilaListado[]
}

export type ListadoConviventes = {
  evento: {
    nombre: string
    fechas: string
    lugar: string
    organizacion: string
  }
  bloques: BloqueListado[]
  totalConviventes: number
}

const CAMPOS_PERSONA = 'nombre, apellido, documento, direccion, direccion_nro, localidad, provincia, telefono, fecha_nacimiento, email'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const fila = (p: PersonaListado): FilaListado => ({ ...p, nombreCompleto: `${p.apellido} ${p.nombre}`.trim() })

const porApellido = (a: FilaListado, b: FilaListado) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')

/** "20 al 26 de julio 2026", o la fecha sola si dura un día. */
function rangoFechas(inicio: string | null, fin: string | null): string {
  if (!inicio) return ''
  const [ai, mi, di] = inicio.split('T')[0].split('-').map(Number)
  const [af, mf, df] = (fin ?? inicio).split('T')[0].split('-').map(Number)
  if (ai === af && mi === mf && di === df) return `${di} de ${MESES[mi - 1]} ${ai}`
  if (ai === af && mi === mf) return `${di} al ${df} de ${MESES[mi - 1]} ${ai}`
  if (ai === af) return `${di} de ${MESES[mi - 1]} al ${df} de ${MESES[mf - 1]} ${ai}`
  return `${di} de ${MESES[mi - 1]} ${ai} al ${df} de ${MESES[mf - 1]} ${af}`
}

export async function cargarListadoConviventes(eventoId: string): Promise<ListadoConviventes> {
  const supabase = createClient()

  const [{ data: evento, error: eventoError }, { data: participantes, error: partError }, { data: grupos, error: gruposError }] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        nombre, fecha_inicio, fecha_fin, ciudad,
        coordinador_asignado_id, asesor_asignado_id,
        centralizador_1_persona_id, centralizador_1_nombre, centralizador_1_email, centralizador_1_telefono,
        centralizador_2_persona_id, centralizador_2_nombre, centralizador_2_email, centralizador_2_telefono,
        centralizador_3_persona_id, centralizador_3_nombre, centralizador_3_email, centralizador_3_telefono,
        confraternidad:organizaciones!organizacion_id(nombre),
        fraternidad:organizaciones!fraternidad_id(nombre),
        casa_retiro:casas_retiro!casa_retiro_id(nombre, ciudad)
      `)
      .eq('id', eventoId)
      .single(),
    supabase
      .from('evento_participantes')
      .select(`id, persona_id, rol_en_evento, estado_participacion, grupo_id, persona:personas!persona_id(${CAMPOS_PERSONA})`)
      .eq('evento_id', eventoId)
      .neq('estado_participacion', 'cancelado'),
    supabase
      .from('evento_grupos')
      .select('id, nombre, servidor_participante_id')
      .eq('evento_id', eventoId)
      .order('created_at'),
  ])
  if (eventoError || partError || gruposError || !evento) {
    throw new Error('No se pudieron cargar los datos del listado.')
  }

  type Participante = { id: string; persona_id: string; rol_en_evento: string; grupo_id: string | null; persona: PersonaListado | null }
  const parts = (participantes ?? []) as unknown as Participante[]
  const ev = evento as unknown as Record<string, string | null> & {
    confraternidad: { nombre: string } | null
    fraternidad: { nombre: string } | null
    casa_retiro: { nombre: string; ciudad: string | null } | null
  }

  // Coordinador, asesor y centralizadores pueden estar solo en columnas de
  // `eventos` sin estar cargados como participantes: se traen aparte.
  const centralizadores = [1, 2, 3].map(n => ({
    persona_id: ev[`centralizador_${n}_persona_id`],
    nombre: ev[`centralizador_${n}_nombre`],
    email: ev[`centralizador_${n}_email`],
    telefono: ev[`centralizador_${n}_telefono`],
  }))
  const idsColumnas = [ev.coordinador_asignado_id, ev.asesor_asignado_id, ...centralizadores.map(c => c.persona_id)]
    .filter((id): id is string => !!id && !parts.some(p => p.persona_id === id))
  const personasColumnas = new Map<string, PersonaListado>()
  if (idsColumnas.length) {
    const { data } = await supabase.from('personas').select(`id, ${CAMPOS_PERSONA}`).in('id', idsColumnas)
    for (const p of (data ?? []) as unknown as (PersonaListado & { id: string })[]) personasColumnas.set(p.id, p)
  }
  const personaPorId = (id: string | null) =>
    id ? (parts.find(p => p.persona_id === id)?.persona ?? personasColumnas.get(id) ?? null) : null

  const conRol = (rol: string) => parts.filter(p => p.rol_en_evento === rol && p.persona)
  /** Por rol en evento y, si el evento tiene asignada a alguien en su columna, también esa persona. */
  const integrantes = (rol: string, idColumna: string | null) => {
    const filas = conRol(rol).map(p => fila(p.persona!))
    const deColumna = personaPorId(idColumna)
    if (deColumna && !conRol(rol).some(p => p.persona_id === idColumna)) filas.unshift(fila(deColumna))
    return filas
  }

  const bloques: BloqueListado[] = []
  const coordinadores = integrantes('coordinador', ev.coordinador_asignado_id)
  if (coordinadores.length) bloques.push({ titulo: 'Coordinador:', rolDestacados: 'Coordinador', destacados: coordinadores, filas: [] })
  const asesores = integrantes('asesor', ev.asesor_asignado_id)
  if (asesores.length) bloques.push({ titulo: 'Asesor:', rolDestacados: 'Asesor', destacados: asesores, filas: [] })

  const conviventes = conRol('convivente')
  const listaGrupos = (grupos ?? []) as { id: string; nombre: string; servidor_participante_id: string | null }[]
  const servidorPorParticipante = new Map(parts.map(p => [p.id, p]))
  const servidoresConGrupo = new Set<string>()
  for (const g of listaGrupos) {
    const servidor = g.servidor_participante_id ? servidorPorParticipante.get(g.servidor_participante_id) : undefined
    if (servidor) servidoresConGrupo.add(servidor.id)
    bloques.push({
      titulo: g.nombre,
      rotulo: 'Servidor:',
      grupo: g.nombre,
      rolDestacados: 'Servidor',
      destacados: servidor?.persona ? [fila(servidor.persona)] : [],
      filas: conviventes.filter(p => p.grupo_id === g.id).map(p => fila(p.persona!)).sort(porApellido),
    })
  }
  const sinGrupo = conviventes.filter(p => !p.grupo_id || !listaGrupos.some(g => g.id === p.grupo_id))
  if (sinGrupo.length) {
    bloques.push({ titulo: listaGrupos.length ? 'Sin grupo asignado' : 'Conviventes', rolDestacados: 'Convivente', destacados: [], filas: sinGrupo.map(p => fila(p.persona!)).sort(porApellido) })
  }
  const servidoresSueltos = conRol('servidor').filter(p => !servidoresConGrupo.has(p.id))
  if (servidoresSueltos.length) {
    bloques.push({ titulo: 'Servidores sin grupo:', rolDestacados: 'Servidor', destacados: servidoresSueltos.map(p => fila(p.persona!)).sort(porApellido), filas: [] })
  }
  const musica = conRol('musica').map(p => fila(p.persona!)).sort(porApellido)
  if (musica.length) bloques.push({ titulo: 'Ministerio de Música:', rolDestacados: 'Ministerio de Música', destacados: musica, filas: [] })
  const auxiliares = conRol('equipo_auxiliar').map(p => fila(p.persona!)).sort(porApellido)
  if (auxiliares.length) bloques.push({ titulo: 'Equipo Auxiliar:', rolDestacados: 'Equipo Auxiliar', destacados: auxiliares, filas: [] })

  const filasCentralizadores: FilaListado[] = conRol('centralizador').map(p => fila(p.persona!))
  for (const c of centralizadores) {
    if (c.persona_id && parts.some(p => p.persona_id === c.persona_id && p.rol_en_evento === 'centralizador')) continue
    const persona = personaPorId(c.persona_id)
    if (persona) filasCentralizadores.push(fila(persona))
    else if (c.nombre) filasCentralizadores.push({ nombreCompleto: c.nombre, email: c.email, telefono: c.telefono })
  }
  if (filasCentralizadores.length) bloques.push({ titulo: 'Centralizador:', rolDestacados: 'Centralizador', destacados: filasCentralizadores, filas: [] })

  const lugar = ev.casa_retiro
    ? [ev.casa_retiro.nombre, ev.casa_retiro.ciudad].filter(Boolean).join(' - ')
    : (ev.ciudad ?? '')
  return {
    evento: {
      nombre: ev.nombre ?? '',
      fechas: rangoFechas(ev.fecha_inicio, ev.fecha_fin),
      lugar,
      organizacion: [
        ev.fraternidad?.nombre ? `Fraternidad ${ev.fraternidad.nombre}` : null,
        ev.confraternidad?.nombre ? `Confraternidad ${ev.confraternidad.nombre}` : null,
      ].filter(Boolean).join(' - '),
    },
    bloques,
    totalConviventes: conviventes.length,
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const MARGEN = 10
const ALTO_FILA = 5

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "14922476" → "14.922.476"; si trae letras o puntos se deja como está. */
function formatoDni(dni: string | null | undefined): string {
  const limpio = (dni ?? '').trim()
  return /^\d{7,8}$/.test(limpio) ? limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : limpio
}

/** "1990-04-30" → "30-abr", como en la planilla de la Comunidad. */
function formatoCumple(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const [, mes, dia] = fecha.split('T')[0].split('-').map(Number)
  return mes && dia ? `${dia}-${MESES_CORTOS[mes - 1]}` : ''
}

const COLUMNAS: { titulo: string; ancho: number; valor: (f: FilaListado) => string }[] = [
  { titulo: '', ancho: 60, valor: f => f.nombreCompleto },
  { titulo: 'DNI', ancho: 22, valor: f => formatoDni(f.documento) },
  { titulo: 'Domicilio', ancho: 50, valor: f => [f.direccion, f.direccion_nro].filter(Boolean).join(' ') },
  { titulo: 'Localidad', ancho: 52, valor: f => (f.localidad ? `${f.localidad}${f.provincia ? ` (${f.provincia})` : ''}` : (f.provincia ?? '')) },
  { titulo: 'Teléfono', ancho: 27, valor: f => f.telefono ?? '' },
  { titulo: 'Cumple', ancho: 15, valor: f => formatoCumple(f.fecha_nacimiento) },
  { titulo: 'Email', ancho: 51, valor: f => f.email ?? '' },
]

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch('/logoccd.jpeg')).blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportListadoConviventesPDF(listado: ListadoConviventes) {
  const [{ default: JsPDF }, logo] = await Promise.all([import('jspdf'), logoDataUrl()])
  const doc: jsPDF = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoTabla = COLUMNAS.reduce((s, c) => s + c.ancho, 0)
  const x0 = (anchoPagina - anchoTabla) / 2
  let y = MARGEN

  const encabezadoColumnas = () => {
    doc.setFillColor(128, 128, 128)
    doc.rect(x0, y, anchoTabla, ALTO_FILA, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(255)
    let x = x0
    for (const col of COLUMNAS) {
      if (col.titulo) doc.text(col.titulo, x + col.ancho / 2, y + 3.5, { align: 'center' })
      x += col.ancho
    }
    doc.setTextColor(0)
    y += ALTO_FILA
  }

  const asegurarEspacio = (alto: number) => {
    if (y + alto <= altoPagina - MARGEN) return
    doc.addPage()
    y = MARGEN
    encabezadoColumnas()
  }

  /** Fila de rótulo a todo el ancho ("Caná", "Servidor:"). */
  const rotulo = (texto: string, opts: { fondo?: boolean; subrayado?: boolean; italica?: boolean }) => {
    if (opts.fondo) {
      doc.setFillColor(235, 235, 235)
      doc.rect(x0, y, anchoTabla, ALTO_FILA, 'F')
    }
    doc.setFont('helvetica', opts.italica ? 'bolditalic' : 'bold')
    doc.setFontSize(9)
    doc.text(texto, x0 + 1, y + 3.6)
    if (opts.subrayado) doc.line(x0 + 1, y + 4.2, x0 + 1 + doc.getTextWidth(texto), y + 4.2)
    y += ALTO_FILA
  }

  const filaPersona = (f: FilaListado, destacada: boolean) => {
    asegurarEspacio(ALTO_FILA)
    doc.setFont('helvetica', destacada ? 'bolditalic' : 'normal')
    doc.setFontSize(destacada ? 8 : 7.5)
    doc.setDrawColor(0)
    doc.setLineWidth(0.2)
    let x = x0
    for (const col of COLUMNAS) {
      doc.rect(x, y, col.ancho, ALTO_FILA)
      // Una sola línea por celda: lo que no entra se corta, como en la planilla.
      const texto = (doc.splitTextToSize(col.valor(f), col.ancho - 1.5) as string[])[0] ?? ''
      doc.text(texto, x + col.ancho / 2, y + 3.5, { align: 'center' })
      x += col.ancho
    }
    y += ALTO_FILA
  }

  // Encabezado del evento
  if (logo) doc.addImage(logo, 'JPEG', x0, y, 22, 22)
  const centro = anchoPagina / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Comunidad Convivencia con Dios', centro, y + 5, { align: 'center' })
  doc.line(centro - doc.getTextWidth('Comunidad Convivencia con Dios') / 2, y + 6, centro + doc.getTextWidth('Comunidad Convivencia con Dios') / 2, y + 6)
  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(12)
  doc.text(listado.evento.nombre, centro, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  const linea3 = [listado.evento.fechas, listado.evento.lugar].filter(Boolean).join(' - ')
  if (linea3) doc.text(linea3, centro, y + 15.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  if (listado.evento.organizacion) doc.text(listado.evento.organizacion, centro, y + 20, { align: 'center' })
  doc.setFontSize(8)
  doc.text(`Total de conviventes: ${listado.totalConviventes}`, x0 + anchoTabla, y + 20, { align: 'right' })
  y += 25

  encabezadoColumnas()
  for (const bloque of listado.bloques) {
    // Que el título no quede solo al pie de la página.
    asegurarEspacio(ALTO_FILA * (bloque.rotulo ? 3 : 2))
    if (bloque.rotulo) {
      rotulo(bloque.titulo, { fondo: true, subrayado: true })
      rotulo(bloque.rotulo, { italica: true })
    } else {
      rotulo(bloque.titulo, { fondo: true, italica: true })
    }
    bloque.destacados.forEach(f => filaPersona(f, true))
    bloque.filas.forEach(f => filaPersona(f, false))
  }

  doc.save(nombreArchivo(listado, 'pdf'))
}

function nombreArchivo(listado: ListadoConviventes, extension: 'pdf' | 'xlsx') {
  const base = (listado.evento.nombre || 'evento').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return `${base}-listado-conviventes.${extension}`
}

// ─── Excel ────────────────────────────────────────────────────────────────────
// Misma información y mismo orden que el PDF, pero como tabla plana (una fila
// por persona, con su Rol y Grupo) para poder filtrar y ordenar.

export async function exportListadoConviventesXLSX(listado: ListadoConviventes) {
  const XLSX = await import('xlsx')
  const encabezado = ['Rol', 'Grupo', 'Apellido y nombre', ...COLUMNAS.slice(1).map(c => c.titulo)]
  const filaExcel = (rol: string, grupo: string, f: FilaListado) => [rol, grupo, ...COLUMNAS.map(c => c.valor(f))]

  const filas: string[][] = []
  for (const b of listado.bloques) {
    const grupo = b.grupo ?? ''
    b.destacados.forEach(f => filas.push(filaExcel(b.rolDestacados, grupo, f)))
    b.filas.forEach(f => filas.push(filaExcel('Convivente', grupo, f)))
  }

  const aoa = [
    ['Comunidad Convivencia con Dios'],
    [listado.evento.nombre],
    [[listado.evento.fechas, listado.evento.lugar].filter(Boolean).join(' - ')],
    [listado.evento.organizacion],
    [`Total de conviventes: ${listado.totalConviventes}`],
    [],
    encabezado,
    ...filas,
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 34 }, { wch: 12 }, { wch: 30 }, { wch: 32 }, { wch: 15 }, { wch: 8 }, { wch: 34 }]
  // Filtro sobre la tabla (fila 7 en adelante).
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 6, c: 0 }, e: { r: 6 + filas.length, c: encabezado.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Listado')
  XLSX.writeFile(wb, nombreArchivo(listado, 'xlsx'))
}

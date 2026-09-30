// Export del Informe Económico a Excel con el mismo layout que la planilla
// "Base para IE" (hojas Datos, Registro e Informe Economico). Client-only:
// xlsx se importa dinámicamente, igual que en personas/_components/export-button.tsx.
import { formatDateAR } from '@/lib/utils'
import {
  calcularResumenEconomico,
  libroDeMedio,
  MEDIOS,
  nombreArchivoInforme,
  resumenPorCategoria,
  type InformeEconomicoData,
} from './informe-economico'

type Celda = string | number | null

const fechaAR = (f: string | null) => (f ? formatDateAR(f.split('T')[0]) : '')

export async function exportInformeEconomicoXLSX({ info, movimientos, saldosIniciales, becas, observaciones }: InformeEconomicoData) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // ── Datos ──
  const datos: Celda[][] = [
    ['Evento', info.nombre],
    ['Fecha de Inicio', fechaAR(info.fecha_inicio)],
    ['Fecha de Finalización', fechaAR(info.fecha_fin)],
    ['Año', info.fecha_inicio ? Number(info.fecha_inicio.slice(0, 4)) : null],
    ['Lugar', info.lugar],
    ['Confraternidad', info.confraternidad],
    ['Fraternidad', info.fraternidad],
    ['Centralizador 1', info.centralizadores[0] ?? null],
    ['Centralizador 2', info.centralizadores[1] ?? null],
    ['Centralizador 3', info.centralizadores[2] ?? null],
    ['Cantidad de Asistentes', info.asistentes],
    ['Equipo de Servidores #', info.servidores],
    ['Equipo Auxiliar #', info.auxiliares],
  ]
  const wsDatos = XLSX.utils.aoa_to_sheet(datos)
  wsDatos['!cols'] = [{ wch: 24 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos')

  // ── Registro: tres bloques lado a lado (CAJA | BANCO | MP), 6 columnas + 1 de separación ──
  const libros = MEDIOS.map(m => ({
    titulo: m.value === 'caja' ? 'CAJA' : m.value === 'banco' ? 'BANCO' : 'MP',
    ...libroDeMedio(movimientos, m.value, saldosIniciales[m.value]),
  }))
  const filas = Math.max(...libros.map(l => l.asientos.filter(a => !a.anulado_at).length))
  const registro: Celda[][] = [[], []]
  for (let i = 0; i < filas + 1; i++) registro.push([])
  libros.forEach((libro, b) => {
    const x = b * 7
    registro[0][x] = libro.titulo
    ;['Concepto', 'Fecha', 'Descripcion', 'Ingreso', 'Egreso', 'Saldo'].forEach((h, j) => { registro[1][x + j] = h })
    registro[2][x + 2] = 'Saldo inicial'
    registro[2][x + 5] = libro.saldoInicial
    libro.asientos.filter(a => !a.anulado_at).forEach((a, i) => {
      const row = registro[3 + i]
      row[x] = a.categoria
      row[x + 1] = fechaAR(a.fecha)
      row[x + 2] = a.concepto ?? ''
      row[x + 3] = a.tipo === 'ingreso' ? Number(a.monto) : null
      row[x + 4] = a.tipo === 'egreso' ? Number(a.monto) : null
      row[x + 5] = a.saldo
    })
  })
  const wsRegistro = XLSX.utils.aoa_to_sheet(registro)
  wsRegistro['!cols'] = Array.from({ length: 20 }, (_, i) => ({ wch: [22, 11, 30, 12, 12, 12, 3][i % 7] }))
  XLSX.utils.book_append_sheet(wb, wsRegistro, 'Registro')

  // ── Informe Economico ──
  const { ingresos: porIngreso, egresos: porEgreso } = resumenPorCategoria(movimientos)
  const { ingresos, egresos, saldo, diezmo } = calcularResumenEconomico(movimientos)
  const informe: Celda[][] = [
    ['COMUNIDAD CONVIVENCIA CON DIOS'],
    ['INFORME ECONÓMICO'],
    [info.nombre],
    [[fechaAR(info.fecha_inicio), fechaAR(info.fecha_fin)].filter(Boolean).join(' al ')],
    [[info.lugar, info.confraternidad, info.fraternidad].filter(Boolean).join(' - ')],
    [],
    ['Cantidad de Asistentes', info.asistentes, null, 'Equipo de Servidores y Auxiliar', info.servidores + info.auxiliares],
    [],
    ['INGRESOS', 'TOTAL', null, 'EGRESOS', 'TOTAL'],
  ]
  for (let i = 0; i < Math.max(porIngreso.length, porEgreso.length); i++) {
    informe.push([
      porIngreso[i]?.categoria ?? null, porIngreso[i]?.total ?? null, null,
      porEgreso[i]?.categoria ?? null, porEgreso[i]?.total ?? null,
    ])
  }
  informe.push(
    [],
    ['Total Ingresos', ingresos],
    ['Total Egresos', egresos],
    ['Saldo', saldo],
    ['Diezmo al EqT', diezmo],
    [],
    ['BECAS OTORGADAS', null, null, 'Valor Inscripción', info.valor_inscripcion],
    ['Nombre y Apellido', 'Importe'],
    ...becas.map(b => [b.nombre, b.importe] as Celda[]),
    [],
    ['Observaciones'],
    [observaciones ?? ''],
  )
  const wsInforme = XLSX.utils.aoa_to_sheet(informe)
  wsInforme['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 3 }, { wch: 30 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsInforme, 'Informe Economico')

  XLSX.writeFile(wb, nombreArchivoInforme(info.nombre, 'xlsx'))
}

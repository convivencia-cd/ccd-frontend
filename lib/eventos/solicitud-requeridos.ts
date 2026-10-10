// Campos obligatorios de la Solicitud del evento (card #35).
// Sin ellos el evento no puede crearse como solicitud ni pasar al siguiente estado.
// La única excepción es el check "Es De Aporte Voluntario" (es_apv), que es opcional.

export const CAMPOS_REQUERIDOS_SOLICITUD = {
  organizacion_id: 'Confraternidad',
  fraternidad_id: 'Fraternidad',
  tipo: 'Categoría de retiro',
  tipo_evento_id: 'Tipo de retiro',
  pais_evento: 'País',
  provincia_evento: 'Provincia',
  ciudad: 'Ciudad',
  codigo_postal: 'CP',
  diocesis: 'Diócesis',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de fin',
  modalidad: 'Modalidad',
  notas: 'Notas aclaratorias y observaciones',
} as const

export type CampoRequeridoSolicitud = keyof typeof CAMPOS_REQUERIDOS_SOLICITUD

/** Devuelve las etiquetas de los campos obligatorios que están vacíos. */
export function camposFaltantesSolicitud(
  datos: Partial<Record<CampoRequeridoSolicitud, unknown>>,
): string[] {
  return (Object.keys(CAMPOS_REQUERIDOS_SOLICITUD) as CampoRequeridoSolicitud[])
    .filter((campo) => {
      const v = datos[campo]
      return v == null || (typeof v === 'string' && v.trim() === '')
    })
    .map((campo) => CAMPOS_REQUERIDOS_SOLICITUD[campo])
}

export function mensajeFaltantesSolicitud(faltantes: string[]): string {
  return `Faltan completar campos obligatorios de la solicitud: ${faltantes.join(', ')}.`
}

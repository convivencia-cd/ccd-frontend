/**
 * Un convivente "dio el presente" si se le tomó asistencia o ya está en curso
 * o completado. Misma regla que los triggers de las migraciones 082 y 100.
 * Interesados, preinscriptos e inscriptos sin presente quedan afuera.
 */
export function dioPresente(p: { fecha_asistencia?: string | null; estado_participacion: string | null }): boolean {
  return !!p.fecha_asistencia || p.estado_participacion === 'en_curso' || p.estado_participacion === 'completado'
}

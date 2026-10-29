// Vigencia de la inscripción y el pago (card #111).
//
// Acordado en la reunión del 28/10: el link del mail (inscripción y pago) deja
// de servir cuando el retiro comienza, y nunca se puede pagar un retiro que ya
// está en curso, finalizado o suspendido. `fecha_inicio` es solo día, así que
// "comienza" = las 00:00 de ese día en hora argentina, o antes si el equipo ya
// lo pasó a otro estado.

type EventoVigencia = { estado: string | null; fecha_inicio: string | null }

/** Instante en que arranca el retiro (00:00 hora argentina del día de inicio). */
export function inicioDelRetiro(fechaInicio: string | null): Date | null {
  if (!fechaInicio) return null
  const inicio = new Date(`${fechaInicio.slice(0, 10)}T00:00:00-03:00`)
  return Number.isNaN(inicio.getTime()) ? null : inicio
}

/** null si la inscripción sigue abierta; si no, el mensaje para mostrarle a la persona. */
export function motivoInscripcionCerrada(evento: EventoVigencia | null, ahora = new Date()): string | null {
  if (!evento) return 'El retiro no está disponible.'
  if (evento.estado === 'en_curso') return 'Este retiro ya comenzó y las inscripciones están cerradas.'
  if (evento.estado === 'finalizado' || evento.estado === 'cerrado') return 'Este retiro ya finalizó y las inscripciones están cerradas.'
  if (evento.estado === 'suspendido' || evento.estado === 'cancelado') return 'Este retiro fue suspendido y las inscripciones están cerradas.'
  if (evento.estado !== 'publicado') return 'Las inscripciones para este retiro no están disponibles.'
  const inicio = inicioDelRetiro(evento.fecha_inicio)
  if (inicio && ahora >= inicio) return 'Este retiro ya comenzó y las inscripciones están cerradas.'
  return null
}

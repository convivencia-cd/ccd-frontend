// Los flyers (cuadrado y horizontal) se muestran recién desde "Pendiente Datos Noticias"
// (card #37). En la solicitud y los discernimientos todavía no corresponden.
const ESTADOS_SIN_FLYERS = [
  'borrador',
  'solicitud',
  'discernimiento_confra',
  'discernimiento_eqt',
  'rechazado',
] as const

export function muestraFlyers(estado: string | null | undefined): boolean {
  return !!estado && !(ESTADOS_SIN_FLYERS as readonly string[]).includes(estado)
}

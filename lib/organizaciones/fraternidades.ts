// Combos Confraternidad → Fraternidad de los formularios de persona.
// Una fraternidad cuelga de su confraternidad por `parent_id`.

export type OrganizacionCombo = { id: string; nombre: string; tipo: string; parent_id: string | null }

/** Fraternidades de la confraternidad elegida; sin confraternidad, todas. */
export function fraternidadesDe<T extends OrganizacionCombo>(organizaciones: T[], confraternidadId: string): T[] {
  return organizaciones.filter(
    o => o.tipo === 'fraternidad' && (!confraternidadId || o.parent_id === confraternidadId)
  )
}

/** Confraternidad de la que cuelga una fraternidad, o '' si no tiene una cargada. */
export function confraternidadDe(organizaciones: OrganizacionCombo[], fraternidadId: string): string {
  const parentId = organizaciones.find(o => o.id === fraternidadId)?.parent_id
  return parentId && organizaciones.some(o => o.id === parentId && o.tipo === 'confraternidad') ? parentId : ''
}

/** ¿La fraternidad sigue siendo válida con esta confraternidad? */
export function fraternidadPerteneceA(
  organizaciones: OrganizacionCombo[],
  fraternidadId: string,
  confraternidadId: string
): boolean {
  if (!fraternidadId || !confraternidadId) return true
  return organizaciones.find(o => o.id === fraternidadId)?.parent_id === confraternidadId
}

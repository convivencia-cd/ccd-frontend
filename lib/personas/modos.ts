export function correspondeAsesorAutomatico(persona: {
  tipo_persona: string | null
  estado_eclesial: string | null
  estado_eclesial_rango?: string | null
}) {
  return persona.tipo_persona === 'cecista'
    && persona.estado_eclesial === 'clerigo'
    && ['presbitero', 'obispo', 'cardenal'].includes(persona.estado_eclesial_rango ?? '')
}

/** Asesor se muestra después del modo principal, sin repetir modos. */
export function ordenarModos(modos: readonly string[]): string[] {
  return [...new Set(modos)].sort((a, b) =>
    Number(a === 'asesor') - Number(b === 'asesor') || a.localeCompare(b, 'es')
  )
}

export function agruparModosPorPersona(rows: { persona_id: string; modo: string }[]) {
  const modos = new Map<string, string[]>()
  for (const row of rows) {
    const actuales = modos.get(row.persona_id) ?? []
    actuales.push(row.modo)
    modos.set(row.persona_id, actuales)
  }
  return modos
}

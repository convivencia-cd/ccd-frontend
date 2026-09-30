import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type GrupoEventoRow = {
  id: string
  nombre: string
  servidor_participante_id: string | null
}

/**
 * Grupos ya armados en el evento y los nombres que habilita su tipo de evento
 * (minuta #138: el nombre de cada grupo se elige de un listado definido en
 * `tipos_eventos.nombres_grupos`, ej. "Jerusalem").
 *
 * Lo usan por igual la pantalla de Gestión y la de Editar evento.
 */
export async function cargarGruposDelEvento(
  supabase: SupabaseServerClient,
  eventoId: string,
  tipoEventoId: string | null
): Promise<{ grupos: GrupoEventoRow[]; nombresGrupos: string[] }> {
  const [{ data: grupos }, { data: tipoEvento }] = await Promise.all([
    supabase
      .from('evento_grupos')
      .select('id, nombre, servidor_participante_id')
      .eq('evento_id', eventoId)
      .order('nombre'),
    tipoEventoId
      ? supabase.from('tipos_eventos').select('nombres_grupos').eq('id', tipoEventoId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const crudos = (tipoEvento as { nombres_grupos?: unknown } | null)?.nombres_grupos
  const nombresGrupos = Array.isArray(crudos)
    ? crudos.map(n => String(n).trim()).filter(Boolean)
    : []

  return { grupos: (grupos ?? []) as GrupoEventoRow[], nombresGrupos }
}

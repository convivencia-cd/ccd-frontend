import { createClient as createAdminClient } from '@supabase/supabase-js'
import { nombreLegible } from '@/lib/personas/eventos-realizados'

// Datos de "Mi perfil" (card #92). La cuenta de Participante solo puede leer su
// propia fila de `personas` por RLS (083); sus retiros y su historial viven en
// tablas cerradas a usuarios internos. Se leen con service role, SIEMPRE
// filtrando por el persona_id de la sesión, que resuelve getUserContext.
// Solo importar desde Server Components.

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type MiPerfil = {
  persona: Record<string, string | null>
  retiros: { id: string; nombre: string; fecha_inicio: string | null; estado: string }[]
  realizados: { nombre: string; anio: number | null }[]
}

const CAMPOS = `
  nombre, apellido, apodo, email, telefono, tipo_documento, documento, fecha_nacimiento,
  direccion, direccion_nro, localidad, codigo_postal, provincia, pais, sexo, estado_vida,
  nacionalidad, nivel_estudios, ocupacion, diocesis, parroquia,
  estado_eclesial, estado_eclesial_rango, institucion_religiosa, foto_url
`

export async function cargarMiPerfil(personaId: string): Promise<MiPerfil | null> {
  const supabase = adminClient()
  const [{ data: persona }, { data: participaciones }, { data: realizados }] = await Promise.all([
    supabase.from('personas').select(CAMPOS).eq('id', personaId).maybeSingle(),
    supabase
      .from('evento_participantes')
      .select('estado_participacion, evento:eventos!evento_id(id, nombre, fecha_inicio)')
      .eq('persona_id', personaId)
      .neq('estado_participacion', 'cancelado'),
    supabase
      .from('persona_eventos_realizados')
      .select('anio, tipo:tipos_eventos!tipo_evento_id(nombre)')
      .eq('persona_id', personaId)
      .order('anio', { ascending: true, nullsFirst: false }),
  ])
  if (!persona) return null

  const retiros = ((participaciones ?? []) as unknown as {
    estado_participacion: string
    evento: { id: string; nombre: string; fecha_inicio: string | null } | null
  }[])
    .filter(p => p.evento)
    .map(p => ({ ...p.evento!, estado: p.estado_participacion }))
    .sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''))

  return {
    persona: persona as unknown as Record<string, string | null>,
    retiros,
    realizados: ((realizados ?? []) as unknown as { anio: number | null; tipo: { nombre: string } | null }[])
      .filter(r => r.tipo)
      .map(r => ({ nombre: nombreLegible(r.tipo!.nombre), anio: r.anio })),
  }
}

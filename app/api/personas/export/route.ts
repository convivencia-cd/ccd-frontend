import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { fetchUbicaciones, variantesDe } from '@/lib/personas/ubicaciones'
import { aplicarFiltrosPadron, leerFiltrosPadron } from '@/lib/personas/padron'

export async function GET(req: NextRequest) {
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (
    !canPerform(ctx, 'personas.export') ||
    !canPerform(ctx, 'person.create') ||
    !canPerform(ctx, 'person.update')
  ) {
    return NextResponse.json({ error: 'Sin permiso para exportar personas' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? ''
  const estado_eclesial = searchParams.get('estado_eclesial') ?? ''
  const provincia = searchParams.get('provincia') ?? ''
  const localidad = searchParams.get('localidad') ?? ''
  const filtrosPadron = leerFiltrosPadron({
    modo: searchParams.get('modo'),
    categoria: searchParams.get('categoria'),
    convivente: searchParams.get('convivente'),
  })
  const { modo } = filtrosPadron
  const ministerio_id = searchParams.get('ministerio_id') ?? ''
  const organizacion_id = searchParams.get('organizacion_id') ?? ''

  const supabase = await createClient()

  // Relational filters: get matching persona ids
  let modoIds: string[] | null = null
  if (modo) {
    const { data } = await supabase
      .from('persona_modos')
      .select('persona_id')
      .eq('modo', modo)
      .is('fecha_fin', null)
    modoIds = data?.map(r => r.persona_id) ?? []
  }

  let ministerioIds: string[] | null = null
  if (ministerio_id) {
    const { data } = await supabase
      .from('asignaciones_ministerio')
      .select('persona_id')
      .eq('ministerio_id', ministerio_id)
      .is('fecha_fin', null)
    ministerioIds = data?.map(r => r.persona_id) ?? []
  }

  let orgIds: string[] | null = null
  if (organizacion_id) {
    const { data } = await supabase
      .from('persona_organizacion')
      .select('persona_id')
      .eq('organizacion_id', organizacion_id)
      .is('fecha_fin', null)
    orgIds = data?.map(r => r.persona_id) ?? []
  }

  // Intersect every relational filter that was applied
  const idFilters = [modoIds, ministerioIds, orgIds].filter((f): f is string[] => f !== null)
  const filterIds = idFilters.length > 0
    ? idFilters.reduce((acc, ids) => acc.filter(id => ids.includes(id)))
    : null

  if (filterIds !== null && filterIds.length === 0) {
    return NextResponse.json([])
  }

  let variantesProvincia: Record<string, string[]> | undefined
  let variantesLocalidad: Record<string, string[]> | undefined
  if (provincia || localidad) {
    ;({ variantesProvincia, variantesLocalidad } = await fetchUbicaciones(supabase))
  }

  // Builds a fresh, fully-filtered query each time it's called (Supabase query
  // builders are one-shot), so it can be re-issued per page/chunk below.
  // `idChunk`, when given, restricts to those ids instead of the full filterIds
  // list — needed because a single .in('id', filterIds) can itself blow past
  // Supabase's URL length limit when a modo/ministerio/organización filter
  // matches hundreds of personas.
  function buildQuery(idChunk?: string[]) {
    let q_ = supabase
      .from('personas')
      .select(`
        id, apellido, nombre, apodo, email, telefono,
        localidad, provincia, pais,
        estado_eclesial, diocesis,
        tipo_persona,
        fecha_nacimiento
      `)
      .is('fecha_baja', null)

    if (q) q_ = q_.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,apodo.ilike.%${q}%,email.ilike.%${q}%`)
    if (estado) q_ = q_.eq('estado', estado)
    if (estado_eclesial) q_ = q_.eq('estado_eclesial', estado_eclesial)
    // Mismo criterio que el listado: se buscan las variantes tal cual están guardadas.
    if (provincia && variantesProvincia) {
      const variantes = variantesDe(provincia, variantesProvincia)
      q_ = variantes.length ? q_.in('provincia', variantes) : q_.ilike('provincia', provincia)
    }
    if (localidad && variantesLocalidad) {
      const variantes = variantesDe(localidad, variantesLocalidad)
      q_ = variantes.length ? q_.in('localidad', variantes) : q_.ilike('localidad', localidad)
    }
    q_ = aplicarFiltrosPadron(q_, filtrosPadron)
    if (idChunk) q_ = q_.in('id', idChunk)

    return q_
  }

  const ID_CHUNK_SIZE = 200
  type PersonaRow = {
    id: string
    apellido: string
    nombre: string
    apodo: string | null
    email: string | null
    telefono: string | null
    localidad: string | null
    provincia: string | null
    pais: string | null
    estado_eclesial: string | null
    diocesis: string | null
    tipo_persona: string | null
    fecha_nacimiento: string | null
  }
  const personas: PersonaRow[] = []

  if (filterIds !== null) {
    // Small, bounded chunks — no risk of hitting Supabase's 1000-row cap per request.
    for (let i = 0; i < filterIds.length; i += ID_CHUNK_SIZE) {
      const chunk = filterIds.slice(i, i + ID_CHUNK_SIZE)
      const { data, error } = await buildQuery(chunk)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      personas.push(...((data ?? []) as PersonaRow[]))
    }
  } else {
    // No relational filter: page through everything, since Supabase caps each
    // response at 1000 rows regardless of table size.
    const PAGE_SIZE = 1000
    for (let page = 0; ; page++) {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await buildQuery().range(from, to)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      personas.push(...((data ?? []) as PersonaRow[]))
      if (!data || data.length < PAGE_SIZE) break
    }
  }

  // El orden se pierde al trocear/paginar por separado, así que se ordena acá.
  personas.sort((a, b) => a.apellido.localeCompare(b.apellido, 'es'))

  if (personas.length === 0) {
    return NextResponse.json([])
  }

  const ids = personas.map(p => p.id)

  // Supabase/PostgREST truncates queries whose URL grows too long, so a single
  // .in('persona_id', ids) silently returns nothing once there are a few hundred
  // ids. Chunk the lookups instead.
  const CHUNK_SIZE = 200
  const idChunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) idChunks.push(ids.slice(i, i + CHUNK_SIZE))

  // Fetch current modos for all returned personas
  const modos: { persona_id: string; modo: string }[] = []
  for (const chunk of idChunks) {
    const { data } = await supabase
      .from('persona_modos')
      .select('persona_id, modo')
      .in('persona_id', chunk)
      .is('fecha_fin', null)
    if (data) modos.push(...data)
  }

  // Fetch current confraternidad/fraternidad membership
  const organizaciones: {
    persona_id: string
    tipo_relacion: string
    organizacion: { nombre: string } | null
  }[] = []
  for (const chunk of idChunks) {
    const { data } = await supabase
      .from('persona_organizacion')
      .select('persona_id, tipo_relacion, organizacion:organizaciones!organizacion_id(nombre)')
      .in('persona_id', chunk)
      .is('fecha_fin', null)
    if (data) organizaciones.push(...(data as unknown as typeof organizaciones))
  }

  // Index by persona_id for fast lookup
  const modoByPersona = Object.fromEntries(modos.map(m => [m.persona_id, m.modo]))
  const organizacionByPersona = new Map<string, { confraternidad: string | null; fraternidad: string | null }>()
  for (const row of organizaciones) {
    const actual = organizacionByPersona.get(row.persona_id) ?? { confraternidad: null, fraternidad: null }
    if (row.tipo_relacion === 'confraternidad') actual.confraternidad = row.organizacion?.nombre ?? null
    if (row.tipo_relacion === 'fraternidad') actual.fraternidad = row.organizacion?.nombre ?? null
    organizacionByPersona.set(row.persona_id, actual)
  }

  const rows = personas.map(p => ({
    Apellido: p.apellido,
    Nombre: p.nombre,
    Apodo: p.apodo ?? '',
    Email: p.email ?? '',
    Teléfono: p.telefono ?? '',
    Localidad: p.localidad ?? '',
    Provincia: p.provincia ?? '',
    País: p.pais ?? '',
    Confraternidad: organizacionByPersona.get(p.id)?.confraternidad ?? '',
    Fraternidad: organizacionByPersona.get(p.id)?.fraternidad ?? '',
    'Estado eclesiástico': p.estado_eclesial ?? '',
    Diócesis: p.diocesis ?? '',
    'Fecha nacimiento': p.fecha_nacimiento ?? '',
    'Modo actual': p.tipo_persona === 'otro'
      ? 'otro'
      : p.tipo_persona === 'convivente' || p.tipo_persona === 'no_cecista'
        ? 'convivente'
        : modoByPersona[p.id] ?? '',
  }))

  return NextResponse.json(rows)
}

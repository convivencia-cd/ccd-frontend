import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/server'
import { CIERRE_BUCKET, FOTO_CIERRE_MIME, MAX_FOTO_CIERRE_BYTES } from './cierre'

// Fotos del cierre — tabla evento_fotos_cierre (migración 087) + bucket público
// `eventos-cierre`. Las escrituras van con service role desde las rutas
// /api/eventos/[id]/fotos*, DESPUÉS de chequear canSubirFotosCierre.
// La subida del archivo la hace el navegador con una URL firmada (así no pasa
// por el límite de body de Vercel). Solo importar desde el servidor.

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type FotoCierre = {
  id: string
  url: string
  descripcion: string | null
  created_at: string
}

export const EVENTO_CIERRE_SELECT =
  'id, estado, organizacion_id, fraternidad_id, coordinador_asignado_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id'

export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const EXT_POR_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Valida tipo/tamaño y arma el path dentro del bucket: `<evento>/fotos/<uuid>.<ext>`. */
export function pathParaFoto(eventoId: string, tipo: unknown, tamano: unknown): { path: string } | { error: string } {
  if (typeof tipo !== 'string' || !(FOTO_CIERRE_MIME as readonly string[]).includes(tipo)) {
    return { error: 'Formato no admitido. Subí JPG, PNG o WEBP.' }
  }
  if (typeof tamano !== 'number' || tamano <= 0 || tamano > MAX_FOTO_CIERRE_BYTES) {
    return { error: 'La foto supera 10 MB.' }
  }
  return { path: `${eventoId}/fotos/${crypto.randomUUID()}.${EXT_POR_MIME[tipo]}` }
}

/** El path es de una foto de este evento, armado por pathParaFoto. */
export function esPathDelEvento(eventoId: string, path: unknown): path is string {
  return typeof path === 'string' &&
    new RegExp(`^${eventoId}/fotos/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)
}

export async function firmarSubida(path: string) {
  const { data, error } = await adminClient().storage.from(CIERRE_BUCKET).createSignedUploadUrl(path)
  if (error) throw error
  return data
}

/** Registra la foto ya subida. Falla si el archivo no está en el bucket. */
export async function registrarFoto(
  eventoId: string,
  path: string,
  descripcion: string | null,
  personaId: string | null,
): Promise<FotoCierre> {
  const supabase = adminClient()
  const carpeta = path.slice(0, path.lastIndexOf('/'))
  const archivo = path.slice(path.lastIndexOf('/') + 1)
  const { data: objetos, error: listError } = await supabase.storage
    .from(CIERRE_BUCKET)
    .list(carpeta, { search: archivo, limit: 1 })
  if (listError) throw listError
  if (!objetos?.some(o => o.name === archivo)) throw new Error('No se encontró la foto subida.')

  const { data: urlData } = supabase.storage.from(CIERRE_BUCKET).getPublicUrl(path)
  const { data, error } = await supabase
    .from('evento_fotos_cierre')
    .insert({ evento_id: eventoId, storage_path: path, url: urlData.publicUrl, descripcion, created_by: personaId })
    .select('id, url, descripcion, created_at')
    .single()
  if (error) throw error
  return data as FotoCierre
}

/** Baja lógica: la foto deja de mostrarse; el archivo queda en el bucket. */
export async function quitarFoto(eventoId: string, fotoId: string, personaId: string | null): Promise<boolean> {
  const { data, error } = await adminClient()
    .from('evento_fotos_cierre')
    .update({ eliminado_at: new Date().toISOString(), eliminado_por: personaId })
    .eq('id', fotoId)
    .eq('evento_id', eventoId)
    .is('eliminado_at', null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** Fotos vigentes del evento (lectura con la sesión del usuario: RLS de internos). */
export async function cargarFotosCierre(supabase: SupabaseServerClient, eventoId: string): Promise<FotoCierre[]> {
  const { data, error } = await supabase
    .from('evento_fotos_cierre')
    .select('id, url, descripcion, created_at')
    .eq('evento_id', eventoId)
    .is('eliminado_at', null)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as FotoCierre[]
}

export async function contarFotosCierre(eventoId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from('evento_fotos_cierre')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', eventoId)
    .is('eliminado_at', null)
  if (error) throw error
  return count ?? 0
}

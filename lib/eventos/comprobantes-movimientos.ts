import { createClient as createAdminClient } from '@supabase/supabase-js'

export const COMPROBANTES_BUCKET = 'informe-economico-comprobantes'
export const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024
export const COMPROBANTE_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function adminComprobantes() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export function pathComprobante(eventoId: string, usuarioId: string, tipo: unknown, tamano: unknown) {
  const ext = typeof tipo === 'string' ? COMPROBANTE_EXT[tipo] : undefined
  if (!ext) return { error: 'Formato no permitido. Usá PDF, JPG, PNG o WebP.' } as const
  if (typeof tamano !== 'number' || tamano <= 0 || tamano > MAX_COMPROBANTE_BYTES) {
    return { error: 'El comprobante debe tener contenido y no superar los 10 MB.' } as const
  }
  return { path: `${eventoId}/${usuarioId}/${crypto.randomUUID()}.${ext}` } as const
}

export function esPathComprobante(eventoId: string, usuarioId: string, path: unknown): path is string {
  return typeof path === 'string' &&
    new RegExp(`^${eventoId}/${usuarioId}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`).test(path)
}

export async function existeComprobante(path: string): Promise<boolean> {
  const carpeta = path.slice(0, path.lastIndexOf('/'))
  const nombre = path.slice(path.lastIndexOf('/') + 1)
  const { data, error } = await adminComprobantes().storage
    .from(COMPROBANTES_BUCKET)
    .list(carpeta, { search: nombre, limit: 1 })
  if (error) throw error
  return !!data?.some(obj => obj.name === nombre)
}

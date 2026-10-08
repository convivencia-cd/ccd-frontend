'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Upload } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CIERRE_BUCKET, FOTO_CIERRE_MIME, MAX_FOTO_CIERRE_BYTES, MIN_FOTOS_CIERRE } from '@/lib/eventos/cierre'
import type { FotoCierre } from '@/lib/eventos/fotos-cierre'

type Props = {
  eventoId: string
  fotos: FotoCierre[]
  /** Centralizador del evento o cierre.upload_fotos, con el evento finalizado. */
  canSubir: boolean
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error inesperado')
  return data as T
}

// Galería de fotos del cierre. Subida en dos pasos: el servidor firma la subida
// (chequea permisos), el navegador sube al bucket y el servidor la registra.
export function FotosCierre({ eventoId, fotos, canSubir }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [aQuitar, setAQuitar] = useState<FotoCierre | null>(null)
  const [error, setError] = useState('')

  const faltan = Math.max(0, MIN_FOTOS_CIERRE - fotos.length)

  async function subirArchivos(files: File[]) {
    setError('')
    const errores: string[] = []
    for (const [i, file] of files.entries()) {
      setSubiendo(files.length > 1 ? `Subiendo ${i + 1} de ${files.length}…` : 'Subiendo…')
      try {
        if (!(FOTO_CIERRE_MIME as readonly string[]).includes(file.type)) throw new Error('formato no admitido (JPG, PNG o WEBP)')
        if (file.size > MAX_FOTO_CIERRE_BYTES) throw new Error('supera 10 MB')
        const { path, token } = await postJson<{ path: string; token: string }>(
          `/api/eventos/${eventoId}/fotos/firma`,
          { tipo: file.type, tamano: file.size }
        )
        const { error: upErr } = await supabase.storage
          .from(CIERRE_BUCKET)
          .uploadToSignedUrl(path, token, file, { contentType: file.type })
        if (upErr) throw upErr
        await postJson(`/api/eventos/${eventoId}/fotos`, { path })
      } catch (e: unknown) {
        errores.push(`${file.name}: ${e instanceof Error ? e.message : 'error al subir'}`)
      }
    }
    setSubiendo(null)
    if (errores.length) setError(errores.join(' · '))
    router.refresh()
  }

  async function quitar(foto: FotoCierre) {
    setAQuitar(null)
    setQuitando(foto.id)
    setError('')
    try {
      const res = await fetch(`/api/eventos/${eventoId}/fotos/${foto.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al quitar la foto')
      }
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al quitar la foto')
    } finally {
      setQuitando(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className={`text-sm ${faltan > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
        {fotos.length} foto(s) adjunta(s).{' '}
        {faltan > 0
          ? `Faltan ${faltan} para poder cerrar la convivencia (mínimo ${MIN_FOTOS_CIERRE}).`
          : `Mínimo de ${MIN_FOTOS_CIERRE} cumplido.`}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {fotos.length === 0 ? (
        <div className="flex aspect-video w-full max-w-sm items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
          Sin fotos
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {fotos.map(foto => (
            <div key={foto.id} className="space-y-1">
              <div className="relative">
                <a href={foto.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto.url} alt={foto.descripcion ?? 'Foto del cierre'} className="w-full rounded-md border border-border object-cover aspect-video" />
                </a>
                {canSubir && (
                  <button type="button" onClick={() => setAQuitar(foto)} disabled={quitando === foto.id}
                    className="absolute right-1.5 top-1.5 rounded bg-background/90 p-1 text-destructive hover:opacity-80 disabled:opacity-40" title="Quitar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {foto.descripcion && <p className="text-xs text-muted-foreground">{foto.descripcion}</p>}
            </div>
          ))}
        </div>
      )}

      {canSubir && (
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/50">
          <Upload className="h-3.5 w-3.5" />
          {subiendo ?? 'Adjuntar fotos'}
          <input type="file" multiple accept={FOTO_CIERRE_MIME.join(',')} className="hidden" disabled={subiendo !== null}
            onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) subirArchivos(fs) }} />
        </label>
      )}

      <ConfirmDialog
        open={aQuitar !== null}
        onOpenChange={open => { if (!open) setAQuitar(null) }}
        titulo="¿Quitar esta foto?"
        descripcion="Deja de mostrarse en el cierre de la convivencia."
        confirmar="Quitar foto"
        tono="destructivo"
        onConfirm={() => { if (aQuitar) quitar(aQuitar) }}
      />
    </div>
  )
}

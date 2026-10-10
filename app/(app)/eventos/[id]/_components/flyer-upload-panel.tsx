'use client'

import { useState, useRef } from 'react'
import type { RefObject } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, GalleryHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'

const BUCKET = 'eventos-flyers'
const MAX_SIZE_BYTES = 10 * 1024 * 1024

type Format = 'horizontal' | 'cuadrado'

type SlotProps = {
  format: Format
  currentUrl: string | null
  label: string
  aspectHint: string
  recommendedSize: string
  loading: Format | null
  inputRef: RefObject<HTMLInputElement | null>
  onUpload: (format: Format, file: File) => void
  onDelete: (format: Format) => void
}

function FlyerSlot({
  format, currentUrl, label, aspectHint, recommendedSize,
  loading, inputRef, onUpload, onDelete,
}: SlotProps) {
  const isLoading = loading === format
  const aspectClass = format === 'horizontal' ? 'aspect-video' : 'aspect-square'

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{aspectHint}</p>
          <p className="text-xs text-muted-foreground">{recommendedSize}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(format)}
              disabled={loading !== null}
              className="text-destructive hover:text-destructive h-7 px-2 gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-xs">Eliminar</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={loading !== null}
            className="h-7 px-2 gap-1"
          >
            {isLoading ? (
              <span className="text-xs">Subiendo…</span>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span className="text-xs">{currentUrl ? 'Reemplazar' : 'Subir'}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(format, file)
          e.target.value = ''
        }}
      />

      {currentUrl ? (
        <div className={`relative overflow-hidden rounded-md border border-border bg-muted/30 ${aspectClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`Flyer ${label}`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading !== null}
          className={`${aspectClass} w-full flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:pointer-events-none disabled:opacity-50`}
        >
          <Upload className="h-7 w-7" />
          <span className="text-xs">Clic para subir imagen</span>
        </button>
      )}
    </div>
  )
}

export default function FlyerUploadPanel({
  eventoId,
  flyerHorizontalUrl,
  flyerCuadradoUrl,
}: {
  eventoId: string
  flyerHorizontalUrl: string | null
  flyerCuadradoUrl: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<Format | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Internal URL state so the panel is self-contained even inside client components
  const [urls, setUrls] = useState({ horizontal: flyerHorizontalUrl, cuadrado: flyerCuadradoUrl })

  const horizontalRef = useRef<HTMLInputElement>(null)
  const cuadradoRef = useRef<HTMLInputElement>(null)

  async function handleUpload(format: Format, file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      setError('El archivo supera el límite de 10 MB.')
      return
    }

    setError(null)
    setLoading(format)

    try {
      const path = `${eventoId}/${format}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const newUrl = `${urlData.publicUrl}?v=${Date.now()}`
      const column = format === 'horizontal' ? 'flyer_horizontal_url' : 'flyer_cuadrado_url'

      const { error: dbError } = await supabase
        .from('eventos')
        .update({ [column]: newUrl })
        .eq('id', eventoId)

      if (dbError) throw dbError

      setUrls(prev => ({ ...prev, [format]: newUrl }))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al subir el flyer.')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(format: Format) {
    setError(null)
    setLoading(format)

    try {
      const path = `${eventoId}/${format}`
      await supabase.storage.from(BUCKET).remove([path])

      const column = format === 'horizontal' ? 'flyer_horizontal_url' : 'flyer_cuadrado_url'

      const { error: dbError } = await supabase
        .from('eventos')
        .update({ [column]: null })
        .eq('id', eventoId)

      if (dbError) throw dbError

      setUrls(prev => ({ ...prev, [format]: null }))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar el flyer.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <GalleryHorizontal className="h-4 w-4 text-muted-foreground" />
          Flyers del Retiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <FlyerSlot
            format="horizontal"
            currentUrl={urls.horizontal}
            label="Flyer Horizontal"
            aspectHint="Proporción 16:9 · Desktop y difusión"
            recommendedSize="Recomendado: 1200 × 675 px"
            loading={loading}
            inputRef={horizontalRef}
            onUpload={handleUpload}
            onDelete={handleDelete}
          />
          <FlyerSlot
            format="cuadrado"
            currentUrl={urls.cuadrado}
            label="Flyer Cuadrado"
            aspectHint="Proporción 1:1 · Móviles e Instagram"
            recommendedSize="Recomendado: 1080 × 1080 px"
            loading={loading}
            inputRef={cuadradoRef}
            onUpload={handleUpload}
            onDelete={handleDelete}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Formatos admitidos: JPEG, PNG, WebP · Tamaño máximo: 10 MB por imagen
        </p>
      </CardContent>
    </Card>
  )
}

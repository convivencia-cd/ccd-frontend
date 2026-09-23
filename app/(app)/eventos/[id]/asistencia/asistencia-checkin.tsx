'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, CameraOff, Check, Search, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Html5Qrcode } from 'html5-qrcode'
import { ROLES_EVENTO_LABEL } from '@/lib/eventos/equipo'

interface Participante {
  id: string
  rol_en_evento: string
  estado_participacion: string
  fecha_asistencia: string | null
  asistencia_metodo: string | null
  persona: { id: string; nombre: string; apellido: string; email: string | null } | null
}

const QR_READER_ID = 'qr-reader'

export function AsistenciaCheckin({
  eventoId,
  estadoEvento,
  participantes: participantesIniciales,
}: {
  eventoId: string
  estadoEvento: string
  participantes: Participante[]
}) {
  const router = useRouter()
  const [participantes, setParticipantes] = useState<Participante[]>(participantesIniciales)
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [confirmandoIniciar, setConfirmandoIniciar] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<{ text: string; at: number } | null>(null)

  const presentes = participantes.filter((p) => p.estado_participacion === 'en_curso').length
  const total = participantes.length

  const checkin = useCallback(
    async (participanteId: string, metodo: 'qr' | 'manual') => {
      setPendingId(participanteId)
      try {
        const res = await fetch(`/api/eventos/${eventoId}/asistencia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participante_id: participanteId, metodo }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Error al registrar asistencia')
          return
        }
        setParticipantes((prev) =>
          prev.map((p) =>
            p.id === participanteId
              ? {
                  ...p,
                  estado_participacion: 'en_curso',
                  fecha_asistencia: new Date().toISOString(),
                  asistencia_metodo: metodo,
                }
              : p,
          ),
        )
        if (data.already) {
          toast.info(`${data.nombre} ya estaba presente`)
        } else {
          toast.success(`${data.nombre} · asistencia registrada`)
        }
      } catch {
        toast.error('Error de red al registrar asistencia')
      } finally {
        setPendingId(null)
      }
    },
    [eventoId],
  )

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        await scanner.stop()
        scanner.clear()
      } catch {
        // ignore stop errors
      }
    }
  }, [])

  const startScanner = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(QR_READER_ID)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Debounce duplicate reads of the same code within 3s
          const now = Date.now()
          const last = lastScanRef.current
          if (last && last.text === decodedText && now - last.at < 3000) return
          lastScanRef.current = { text: decodedText, at: now }
          checkin(decodedText.trim(), 'qr')
        },
        () => {
          // per-frame decode failures are expected; ignore
        },
      )
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? `No se pudo iniciar la cámara: ${err.message}`
          : 'No se pudo iniciar la cámara',
      )
      setScanning(false)
      scannerRef.current = null
    }
  }, [checkin])

  useEffect(() => {
    if (scanning) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => {
      stopScanner()
    }
  }, [scanning, startScanner, stopScanner])

  const handleIniciar = async () => {
    setConfirmandoIniciar(false)
    setIniciando(true)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/iniciar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al iniciar el evento')
        return
      }
      toast.success('Evento iniciado (En Curso)')
      router.refresh()
    } catch {
      toast.error('Error de red al iniciar el evento')
    } finally {
      setIniciando(false)
    }
  }

  const term = search.trim().toLowerCase()
  const filtrados = term
    ? participantes.filter((p) => {
        if (!p.persona) return false
        const hay = `${p.persona.nombre} ${p.persona.apellido} ${p.persona.email ?? ''}`.toLowerCase()
        return hay.includes(term)
      })
    : participantes

  return (
    <div className="space-y-6">
      {estadoEvento === 'publicado' && (
        <Card className="border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">El evento aún no fue iniciado</p>
              <p className="text-sm text-muted-foreground">
                Iniciá el evento para marcarlo "En Curso". Podés registrar asistencia antes o después.
              </p>
            </div>
            <Button
              onClick={() => setConfirmandoIniciar(true)}
              disabled={iniciando}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar Evento
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
          {presentes} de {total} presentes
        </span>
        <Button
          onClick={() => setScanning((s) => !s)}
          variant={scanning ? 'outline' : 'default'}
          size="sm"
          className="gap-2"
        >
          {scanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {scanning ? 'Detener escáner' : 'Escanear QR'}
        </Button>
      </div>

      {scanning && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div id={QR_READER_ID} className="mx-auto w-full max-w-sm" />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Apuntá la cámara al QR de inscripción del asistente.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar inscripto por nombre o email..."
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground"
        />
      </div>

      {filtrados.length > 0 ? (
        <div className="space-y-2">
          {filtrados.map((p) => {
            const presente = p.estado_participacion === 'en_curso'
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLES_EVENTO_LABEL[p.rol_en_evento] ?? p.rol_en_evento}
                    {p.persona?.email ? ` · ${p.persona.email}` : ''}
                  </p>
                </div>
                {presente ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    <Check className="h-3.5 w-3.5" />
                    Presente
                    {p.asistencia_metodo === 'qr' ? ' (QR)' : p.asistencia_metodo === 'manual' ? ' (manual)' : ''}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-2 bg-transparent"
                    onClick={() => checkin(p.id, 'manual')}
                    disabled={pendingId === p.id}
                  >
                    {pendingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Marcar presente
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          {total === 0
            ? 'No hay inscriptos para este evento.'
            : 'Ningún inscripto coincide con la búsqueda.'}
        </div>
      )}

      <ConfirmDialog
        open={confirmandoIniciar}
        onOpenChange={setConfirmandoIniciar}
        titulo="¿Iniciar el evento?"
        descripcion='Pasará a estado "En Curso" y dejará de mostrarse en la home pública.'
        confirmar="Iniciar evento"
        onConfirm={handleIniciar}
      />
    </div>
  )
}

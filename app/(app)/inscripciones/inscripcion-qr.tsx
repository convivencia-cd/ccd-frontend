'use client'

import { useEffect, useState } from 'react'
import { QrCode, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function InscripcionQr({
  participanteId,
  eventoNombre,
}: {
  participanteId: string
  eventoNombre: string
}) {
  const [open, setOpen] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || dataUrl) return
    let cancelled = false
    ;(async () => {
      const QRCode = (await import('qrcode')).default
      const url = await QRCode.toDataURL(participanteId, { width: 512, margin: 2 })
      if (!cancelled) setDataUrl(url)
    })()
    return () => {
      cancelled = true
    }
  }, [open, dataUrl, participanteId])

  const handleDownload = async () => {
    if (!dataUrl) return
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    pdf.setFontSize(16)
    pdf.text('QR de Inscripción', pageWidth / 2, 25, { align: 'center' })
    pdf.setFontSize(12)
    pdf.text(eventoNombre, pageWidth / 2, 35, { align: 'center' })
    const size = 120
    pdf.addImage(dataUrl, 'PNG', (pageWidth - size) / 2, 50, size, size)
    pdf.setFontSize(9)
    pdf.text('Presentá este código al ingresar al retiro.', pageWidth / 2, 185, { align: 'center' })
    pdf.save(`qr-inscripcion-${eventoNombre.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <QrCode className="h-4 w-4" />
          Ver QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR de Inscripción</DialogTitle>
          <DialogDescription>
            Presentá este código al ingresar a <strong>{eventoNombre}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR de inscripción" className="h-64 w-64" />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <Button onClick={handleDownload} disabled={!dataUrl} className="gap-2">
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

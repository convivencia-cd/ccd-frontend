'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, FileSpreadsheet, FileText, IdCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportFichasPDF, exportFichasXLSX, type FichaExport } from '@/lib/eventos/fichas-inscripcion'

type Respuesta = { evento: { nombre: string }; fichas: FichaExport[]; verSensibles: boolean }

/** Botón "Exportar fichas" del detalle del evento (card #97). */
export function ExportarFichasButton({ eventoId }: { eventoId: string }) {
  const [cargando, setCargando] = useState(false)

  async function exportar(formato: 'pdf' | 'xlsx') {
    setCargando(true)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/fichas`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudieron exportar las fichas.')
        return
      }
      const { evento, fichas, verSensibles } = data as Respuesta
      if (fichas.length === 0) {
        toast.info('Todavía no hay participantes con ficha de inscripción.')
        return
      }
      if (formato === 'pdf') await exportFichasPDF(evento.nombre, fichas, verSensibles)
      else await exportFichasXLSX(evento.nombre, fichas, verSensibles)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo generar el archivo. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent" disabled={cargando}>
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
          Exportar fichas
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => exportar('pdf')} className="gap-2">
          <FileText className="h-4 w-4" />
          PDF (una ficha por hoja)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportar('xlsx')} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Excel (una fila por persona)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

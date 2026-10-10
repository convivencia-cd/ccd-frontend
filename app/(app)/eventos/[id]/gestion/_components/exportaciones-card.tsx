'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { exportCartelitosDOCX, exportDietasXLSX, type FilaExportacion } from '@/lib/eventos/exportaciones'

type Respuesta = { evento: { nombre: string }; filas: FilaExportacion[]; verSensibles: boolean }

export function ExportacionesCard({ eventoId }: { eventoId: string }) {
  const [cargando, setCargando] = useState<'cartelitos' | 'dietas' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportar(tipo: 'cartelitos' | 'dietas') {
    setCargando(tipo)
    setError(null)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/exportaciones`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo exportar.')
        return
      }
      const { evento, filas, verSensibles } = data as Respuesta
      if (filas.length === 0) {
        setError('Todavía no hay participantes ni equipo para exportar.')
        return
      }
      if (tipo === 'cartelitos') await exportCartelitosDOCX(evento.nombre, filas)
      else await exportDietasXLSX(evento.nombre, filas, verSensibles)
    } catch (err) {
      console.error(err)
      setError('No se pudo generar el archivo. Intentá de nuevo.')
    } finally {
      setCargando(null)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Printer className="h-5 w-5 text-primary" />
          Cartelitos y Dietas
        </CardTitle>
        <CardDescription>
          Archivos editables con los participantes y el equipo del retiro (sin interesados ni cancelados).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Cartelitos</p>
              <p className="text-xs text-muted-foreground">
                Apodo y localidad, 85 × 55 mm, por duplicado. Listos para imprimir y recortar.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportar('cartelitos')} disabled={cargando !== null}>
              {cargando === 'cartelitos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Descargar cartelitos
            </Button>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Dietas</p>
              <p className="text-xs text-muted-foreground">
                Restricciones alimentarias de cada persona y un resumen por tipo para la cocina.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportar('dietas')} disabled={cargando !== null}>
              {cargando === 'dietas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Descargar dietas
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

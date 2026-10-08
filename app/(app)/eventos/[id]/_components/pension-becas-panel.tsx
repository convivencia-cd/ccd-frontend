'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatMonto } from '@/lib/eventos/cierre'
import { valorInscripcionEfectivo, valorPensionEfectivo, calcularSaldoPension } from '@/lib/eventos/pension'

const inputClass = 'w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground'

type Persona = { id: string; nombre: string; apellido: string } | null

type ParticipanteRow = {
  id: string
  persona: Persona
  valor_inscripcion: number | null
  valor_pension: number | null
  beca_pension: number
  notas_beca: string | null
  /** Suma de pagos de pensión confirmados del participante. */
  pagado_pension: number
}

type Props = {
  eventoId: string
  precioEvento: { cuota_inscripcion: number; pension: number }
  participantes: ParticipanteRow[]
}

type CampoNumerico = 'valor_inscripcion' | 'valor_pension' | 'beca_pension'

export default function PensionBecasPanel({ eventoId, precioEvento, participantes: participantesIniciales }: Props) {
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>(participantesIniciales)
  const [savingId, setSavingId] = useState<string | null>(null)

  const totalBecas = participantes.reduce((sum, p) => sum + Number(p.beca_pension || 0), 0)

  async function guardar(participanteId: string, campo: CampoNumerico | 'notas_beca', valor: number | string | null) {
    setSavingId(`${participanteId}:${campo}`)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/participantes-pension`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participante_id: participanteId, [campo]: valor }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al guardar')
        return
      }
      setParticipantes(prev =>
        prev.map(p => (p.id === participanteId ? { ...p, ...data.participante } : p))
      )
      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success('Guardado')
      }
    } catch {
      toast.error('Error de red al guardar')
    } finally {
      setSavingId(null)
    }
  }

  function handleNumeroBlur(participanteId: string, campo: CampoNumerico, e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value.trim()
    if (campo !== 'beca_pension' && raw === '') {
      guardar(participanteId, campo, null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    guardar(participanteId, campo, n)
  }

  function handleNotasBlur(participanteId: string, e: React.FocusEvent<HTMLInputElement>) {
    guardar(participanteId, 'notas_beca', e.target.value)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Becas en Pensión</CardTitle>
        <CardDescription>
          Valor de inscripción, pensión y beca por participante. El Saldo de Pensión se calcula automáticamente; Pagado suma los pagos de pensión confirmados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {participantes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay conviventes inscriptos todavía.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-2 py-2 text-left font-medium">Persona</th>
                    <th className="px-2 py-2 text-left font-medium">Valor Inscripción</th>
                    <th className="px-2 py-2 text-left font-medium">Valor Pensión</th>
                    <th className="px-2 py-2 text-left font-medium">Beca Pensión</th>
                    <th className="px-2 py-2 text-right font-medium">Saldo Pensión</th>
                    <th className="px-2 py-2 text-right font-medium">Pagado</th>
                    <th className="px-2 py-2 text-right font-medium">Resta pagar</th>
                    <th className="px-2 py-2 text-left font-medium">Notas Beca</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p) => {
                    const valorInscripcionVal = valorInscripcionEfectivo(p.valor_inscripcion, precioEvento.cuota_inscripcion)
                    const valorPensionVal = valorPensionEfectivo(p.valor_pension, precioEvento.pension)
                    const saldo = calcularSaldoPension(valorPensionVal, Number(p.beca_pension || 0))
                    const pagado = Number(p.pagado_pension || 0)
                    const resta = Math.max(0, saldo - pagado)
                    const guardando =(campo: string) => savingId === `${p.id}:${campo}`
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 text-foreground whitespace-nowrap">
                          {p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative w-28">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={inputClass}
                              defaultValue={p.valor_inscripcion ?? ''}
                              placeholder={String(valorInscripcionVal)}
                              onBlur={(e) => handleNumeroBlur(p.id, 'valor_inscripcion', e)}
                              key={`vi-${p.id}-${p.valor_inscripcion}`}
                            />
                            {guardando('valor_inscripcion') && (
                              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative w-28">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={inputClass}
                              defaultValue={p.valor_pension ?? ''}
                              placeholder={String(valorPensionVal)}
                              onBlur={(e) => handleNumeroBlur(p.id, 'valor_pension', e)}
                              key={`vp-${p.id}-${p.valor_pension}`}
                            />
                            {guardando('valor_pension') && (
                              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative w-28">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={inputClass}
                              defaultValue={p.beca_pension || ''}
                              placeholder="0"
                              onBlur={(e) => handleNumeroBlur(p.id, 'beca_pension', e)}
                              key={`bp-${p.id}-${p.beca_pension}`}
                            />
                            {guardando('beca_pension') && (
                              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground whitespace-nowrap">
                          ${formatMonto(saldo)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          ${formatMonto(pagado)}
                        </td>
                        <td className={`px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${resta > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                          ${formatMonto(resta)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative min-w-40">
                            <input
                              type="text"
                              className={inputClass}
                              defaultValue={p.notas_beca ?? ''}
                              placeholder="Motivo de la beca (opcional)"
                              onBlur={(e) => handleNotasBlur(p.id, e)}
                              key={`nb-${p.id}-${p.notas_beca}`}
                            />
                            {guardando('notas_beca') && (
                              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total becas otorgadas:</span>
              <span className="font-semibold text-foreground tabular-nums">${formatMonto(totalBecas)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

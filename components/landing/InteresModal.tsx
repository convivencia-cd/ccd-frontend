'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Copy, Check, Link2, AlertCircle } from 'lucide-react'

export type DatosPago = {
  alias: string
  cbu: string | null
  titular: string | null
  banco: string | null
  instrucciones: string | null
}

interface Props {
  eventoId: string
  eventoNombre: string
  montoInscripcion: number | null
  mpDisponible: boolean
  datosPago: DatosPago | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se define, al cerrar tras registrar el interés se navega a esta URL (ej. el listado de eventos publicados). */
  volverAlListadoHref?: string
}

type Step = 'datos' | 'pago' | 'listo'

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* noop */
        }
      }}
      className="inline-flex items-center gap-1 text-xs text-[#F08020] hover:underline"
      aria-label="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

export function InteresModal({ eventoId, eventoNombre, montoInscripcion, mpDisponible, datosPago, open, onOpenChange, volverAlListadoHref }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    tipo_documento: 'dni',
    documento: '',
  })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('datos')
  const [error, setError] = useState<string | null>(null)
  const [participanteId, setParticipanteId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [comprobanteEnviado, setComprobanteEnviado] = useState(false)
  const [yaRegistrado, setYaRegistrado] = useState(false)

  // ¿Corresponde el paso de pago? Solo si hay monto y algún medio de cobro configurado
  // (Mercado Pago conectado y/o datos de transferencia cargados).
  const requierePago = (montoInscripcion ?? 0) > 0 && (mpDisponible || !!datosPago)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmitDatos(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/public/interes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, evento_id: eventoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error inesperado. Intentá de nuevo.')
      } else {
        setYaRegistrado(!!data.ya_registrado)
        if (requierePago && data.evento_participante_id) {
          setParticipanteId(data.evento_participante_id)
          setStep('pago')
        } else {
          setStep('listo')
        }
      }
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePagarMercadoPago() {
    if (!participanteId) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/public/pagos/mercadopago/preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_participante_id: participanteId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo iniciar el pago. Intentá de nuevo.')
        setLoading(false)
        return
      }
      window.location.href = data.checkout_url
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
      setLoading(false)
    }
  }

  async function handleSubmitComprobante(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !participanteId) return
    setLoading(true)
    setError(null)

    if (file.size > MAX_SIZE_BYTES) {
      setError('El archivo supera los 10 MB.')
      setLoading(false)
      return
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setError('Formato no permitido. Usá PDF, JPG, PNG o WebP.')
      setLoading(false)
      return
    }

    try {
      const fd = new FormData()
      fd.append('evento_participante_id', participanteId)
      fd.append('file', file)
      const res = await fetch('/api/public/pago-transferencia', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el comprobante. Intentá de nuevo.')
      } else {
        setComprobanteEnviado(true)
        setStep('listo')
      }
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Si el interés quedó registrado (paso final) y hay un destino, volver al listado de eventos publicados.
      const debeVolverAlListado = step === 'listo' && !!volverAlListadoHref
      setStep('datos')
      setError(null)
      setParticipanteId(null)
      setFile(null)
      setComprobanteEnviado(false)
      setYaRegistrado(false)
      setForm({ nombre: '', apellido: '', email: '', telefono: '', tipo_documento: 'dni', documento: '' })
      onOpenChange(open)
      if (debeVolverAlListado) router.push(volverAlListadoHref!)
      return
    }
    onOpenChange(open)
  }

  const montoLabel = montoInscripcion != null ? `$${montoInscripcion.toLocaleString('es-AR')}` : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'listo' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {yaRegistrado ? (
              <AlertCircle className="h-12 w-12 text-amber-500" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            <div>
              <p className="text-lg font-semibold text-foreground">
                {yaRegistrado ? 'Ya estabas registrado/a' : '¡Gracias por tu interés!'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {/* La inscripción nunca queda cerrada acá: siempre la confirma
                    un centralizador después. Decir "quedó registrada" hacía
                    creer que ya estaba adentro de la convivencia. */}
                {yaRegistrado
                  ? <>Ese email ya había registrado interés en <strong>{eventoNombre}</strong>. No hace falta que te registres de nuevo; si necesitás actualizar tus datos, contactanos.</>
                  : comprobanteEnviado
                    ? <>Recibimos tu comprobante para <strong>{eventoNombre}</strong>. Un centralizador lo va a verificar y se va a comunicar con vos para confirmar tu inscripción.</>
                    : <>Recibimos tus datos para <strong>{eventoNombre}</strong>. Un centralizador se va a comunicar con vos para confirmar tu inscripción.</>}
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Cerrar
            </Button>
          </div>
        ) : step === 'pago' ? (
          <>
            <DialogHeader>
              <DialogTitle>Pago de inscripción</DialogTitle>
              <DialogDescription>
                Para reservar tu lugar en <strong className="text-foreground">{eventoNombre}</strong>
                {montoLabel ? <> aboná <strong className="text-foreground">{montoLabel}</strong></> : <> aboná el pago de inscripción</>}.
              </DialogDescription>
            </DialogHeader>

            {yaRegistrado && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Ese email ya tenía una inscripción registrada para este evento. Podés continuar para completar el pago.</p>
              </div>
            )}

            <div className="grid gap-4 py-1">
              {mpDisponible && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Pagar con Mercado Pago</p>
                  <p className="text-xs text-muted-foreground">
                    Vas a ser redirigido a un entorno seguro para completar el pago al instante.
                  </p>
                  <Button type="button" onClick={handlePagarMercadoPago} disabled={loading}>
                    <Link2 className="h-4 w-4" />
                    {loading ? 'Redirigiendo...' : 'Pagar con Mercado Pago'}
                  </Button>
                </div>
              )}

              {datosPago && (
                <form onSubmit={handleSubmitComprobante} className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Pagar por transferencia</p>

                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Alias</p>
                        <p className="font-medium text-foreground">{datosPago.alias}</p>
                      </div>
                      <CopyButton value={datosPago.alias} />
                    </div>
                    {datosPago.cbu && (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">CBU / CVU</p>
                          <p className="font-medium text-foreground break-all">{datosPago.cbu}</p>
                        </div>
                        <CopyButton value={datosPago.cbu} />
                      </div>
                    )}
                    {datosPago.titular && (
                      <div>
                        <p className="text-xs text-muted-foreground">Titular</p>
                        <p className="font-medium text-foreground">{datosPago.titular}</p>
                      </div>
                    )}
                    {datosPago.banco && (
                      <div>
                        <p className="text-xs text-muted-foreground">Banco</p>
                        <p className="font-medium text-foreground">{datosPago.banco}</p>
                      </div>
                    )}
                    {datosPago.instrucciones && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-border pt-2">{datosPago.instrucciones}</p>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="comprobante">
                      Comprobante <span className="text-destructive">*</span>{' '}
                      <span className="text-muted-foreground text-xs">(PDF o imagen, máx. 10 MB)</span>
                    </Label>
                    <Input
                      id="comprobante"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      disabled={loading}
                    />
                  </div>

                  <Button type="submit" disabled={loading || !file}>
                    {loading ? 'Enviando...' : 'Enviar comprobante'}
                  </Button>
                </form>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('listo')}
                disabled={loading}
              >
                Lo pago más tarde
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Quiero participar</DialogTitle>
              <DialogDescription>
                Te invitamos a completar tus datos para recibir más información sobre{' '}
                <strong className="text-foreground">{eventoNombre}</strong>.
                Dentro de las próximas 48 horas, nos estaremos comunicando. ¡Bendiciones!
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitDatos} className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="nombre">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="apellido">
                    Apellido <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="apellido"
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="telefono">
                  Teléfono <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange}
                  required
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="tipo_documento">Tipo de Documento</Label>
                  {/* Los valores están acotados por el CHECK de personas.tipo_documento */}
                  <select
                    id="tipo_documento"
                    name="tipo_documento"
                    value={form.tipo_documento}
                    onChange={handleChange}
                    disabled={loading}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— Sin especificar —</option>
                    <option value="dni">DNI</option>
                    <option value="pasaporte">Pasaporte</option>
                    <option value="cedula">Cédula</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="documento">Número de Documento</Label>
                  <Input
                    id="documento"
                    name="documento"
                    value={form.documento}
                    onChange={handleChange}
                    inputMode="numeric"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : requierePago ? 'Enviar' : 'Registrar interés'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

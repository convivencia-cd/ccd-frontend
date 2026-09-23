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
import { CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  eventoId: string
  eventoNombre: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se define, al cerrar tras registrar el interés se navega a esta URL (ej. el listado de eventos publicados). */
  volverAlListadoHref?: string
}

type Step = 'datos' | 'listo'

export function InteresModal({ eventoId, eventoNombre, open, onOpenChange, volverAlListadoHref }: Props) {
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
  const [yaRegistrado, setYaRegistrado] = useState(false)

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
      setYaRegistrado(false)
      setForm({ nombre: '', apellido: '', email: '', telefono: '', tipo_documento: 'dni', documento: '' })
      onOpenChange(open)
      if (debeVolverAlListado) router.push(volverAlListadoHref!)
      return
    }
    onOpenChange(open)
  }

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
                  : <>Recibimos tus datos para <strong>{eventoNombre}</strong>. Un centralizador se va a comunicar con vos para confirmar tu inscripción.</>}
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Cerrar
            </Button>
          </div>
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
                  {loading ? 'Enviando...' : 'Registrar interés'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

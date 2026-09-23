'use client'

import { useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Copy, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationFields } from '@/components/location-fields'
import { formatDateAR } from '@/lib/utils'

export type DatosPago = {
  alias: string
  cbu: string | null
  titular: string | null
  banco: string | null
  instrucciones: string | null
}

export type PersonaDatos = {
  id: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  tipo_documento: string | null
  documento: string | null
  fecha_nacimiento: string | null
  direccion: string | null
  direccion_nro: string | null
  localidad: string | null
  codigo_postal: string | null
  provincia: string | null
  pais: string | null
}

type EventoResumen = {
  id: string
  nombre: string
  fechaInicio: string | null
  fechaFin: string | null
  lugar: string | null
  monto: number | null
}

interface Props {
  participanteId: string
  persona: PersonaDatos
  evento: EventoResumen
  mpDisponible: boolean
  datosPago: DatosPago | null
  comprobanteEnRevision: boolean
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const TIPOS_DOCUMENTO = [
  { value: 'dni', label: 'DNI' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'otro', label: 'Otro' },
]

/** Un dato ya cargado se muestra, pero no se puede pisar desde el link. */
function yaCargado(valor: string | null | undefined) {
  return !!valor && valor.trim() !== ''
}

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

function StepHeader({ paso }: { paso: 1 | 2 }) {
  const pasos = [
    { n: 1 as const, label: 'Tus datos' },
    { n: 2 as const, label: 'Pago' },
  ]
  return (
    <ol className="mb-6 flex items-center gap-3" aria-label="Progreso de la inscripción">
      {pasos.map((p, i) => {
        const completo = paso > p.n
        const actual = paso === p.n
        return (
          <li key={p.n} className="flex flex-1 items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                completo
                  ? 'bg-green-600 text-white'
                  : actual
                    ? 'bg-[#F08020] text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
              aria-current={actual ? 'step' : undefined}
            >
              {completo ? <Check className="h-4 w-4" /> : p.n}
            </span>
            <span className={`text-sm ${actual ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {p.label}
            </span>
            {i < pasos.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

export function PagoStepper({ participanteId, persona, evento, mpDisponible, datosPago, comprobanteEnRevision }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [comprobanteEnviado, setComprobanteEnviado] = useState(false)

  const [form, setForm] = useState({
    telefono: persona.telefono ?? '',
    tipo_documento: persona.tipo_documento ?? 'dni',
    documento: persona.documento ?? '',
    fecha_nacimiento: persona.fecha_nacimiento ?? '',
    direccion: persona.direccion ?? '',
    direccion_nro: persona.direccion_nro ?? '',
    pais: persona.pais ?? 'Argentina',
    provincia: persona.provincia ?? '',
    localidad: persona.localidad ?? '',
    codigo_postal: persona.codigo_postal ?? '',
  })

  const set = (campo: keyof typeof form) => (valor: string) => setForm((prev) => ({ ...prev, [campo]: valor }))
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  // El país arranca en "Argentina" aunque la ficha lo tenga vacío, así que la
  // ubicación se bloquea solo si ya había una provincia cargada.
  const ubicacionBloqueada = yaCargado(persona.provincia) && yaCargado(persona.localidad)

  const montoLabel = evento.monto != null ? `$${evento.monto.toLocaleString('es-AR')}` : null
  const hayMedioDePago = mpDisponible || !!datosPago

  async function handleSubmitDatos(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/public/inscripcion/${participanteId}/datos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron guardar tus datos. Intentá de nuevo.')
      } else {
        setPaso(2)
      }
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePagarMercadoPago() {
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
    if (!file) return
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
      }
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (comprobanteEnviado) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Recibimos tu comprobante</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un centralizador lo va a verificar y se va a comunicar con vos para confirmar tu inscripción a{' '}
          <strong>{evento.nombre}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Completá tu inscripción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {evento.nombre}
          {evento.fechaInicio ? ` · ${formatDateAR(evento.fechaInicio)}` : ''}
          {evento.lugar ? ` · ${evento.lugar}` : ''}
        </p>
      </div>

      <StepHeader paso={paso} />

      {paso === 1 ? (
        <form onSubmit={handleSubmitDatos} className="space-y-5 rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground">
            Estos son los datos que tenemos de vos. Completá los que falten para terminar la inscripción.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={persona.nombre} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" value={persona.apellido} disabled />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={persona.email ?? ''} disabled />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="telefono">
                Teléfono {!yaCargado(persona.telefono) && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                value={form.telefono}
                onChange={handleChange}
                required
                disabled={loading || yaCargado(persona.telefono)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
              <Input
                id="fecha_nacimiento"
                name="fecha_nacimiento"
                type="date"
                value={form.fecha_nacimiento}
                onChange={handleChange}
                disabled={loading || yaCargado(persona.fecha_nacimiento)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tipo_documento">Tipo de documento</Label>
              <select
                id="tipo_documento"
                name="tipo_documento"
                value={form.tipo_documento}
                onChange={handleChange}
                disabled={loading || yaCargado(persona.documento)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="documento">
                Número de documento {!yaCargado(persona.documento) && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="documento"
                name="documento"
                value={form.documento}
                onChange={handleChange}
                inputMode="numeric"
                required
                disabled={loading || yaCargado(persona.documento)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                disabled={loading || yaCargado(persona.direccion)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="direccion_nro">Número</Label>
              <Input
                id="direccion_nro"
                name="direccion_nro"
                value={form.direccion_nro}
                onChange={handleChange}
                className="sm:w-28"
                disabled={loading || yaCargado(persona.direccion_nro)}
              />
            </div>
          </div>

          <LocationFields
            pais={form.pais}
            provincia={form.provincia}
            localidad={form.localidad}
            codigoPostal={form.codigo_postal}
            onPaisChange={set('pais')}
            onProvinciaChange={set('provincia')}
            onLocalidadChange={set('localidad')}
            onCodigoPostalChange={set('codigo_postal')}
            disabled={loading || ubicacionBloqueada}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Guardando...' : 'Continuar al pago'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Inscripción</p>
                <p className="font-semibold text-foreground">{evento.nombre}</p>
              </div>
              {montoLabel && <p className="text-xl font-bold text-foreground">{montoLabel}</p>}
            </div>
          </div>

          {comprobanteEnRevision && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Ya recibimos un comprobante para esta inscripción. Un centralizador lo está verificando.</p>
            </div>
          )}

          {!hayMedioDePago && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                El pago online no está disponible en este momento. Un centralizador se va a comunicar con vos para
                coordinarlo.
              </p>
            </div>
          )}

          {mpDisponible && !comprobanteEnRevision && (
            <div className="space-y-3 rounded-xl border border-border p-5">
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

          {datosPago && !comprobanteEnRevision && (
            <form onSubmit={handleSubmitComprobante} className="space-y-3 rounded-xl border border-border p-5">
              <p className="text-sm font-medium text-foreground">Pagar por transferencia</p>

              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
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
                  <p className="whitespace-pre-wrap border-t border-border pt-2 text-xs text-muted-foreground">
                    {datosPago.instrucciones}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="comprobante">
                  Comprobante <span className="text-destructive">*</span>{' '}
                  <span className="text-xs text-muted-foreground">(PDF o imagen, máx. 10 MB)</span>
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" variant="ghost" onClick={() => setPaso(1)} disabled={loading}>
            Volver a mis datos
          </Button>
        </div>
      )}
    </div>
  )
}

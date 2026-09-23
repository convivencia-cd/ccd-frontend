"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Check, Loader2, Mail, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SeguimientoActionsProps {
  participanteId: string
  estadoContacto: string
  medioContacto: string | null
  notasSeguimiento: string | null
  /** Email de la persona: sin él no se puede mandar el link de pago. */
  email: string | null
}

const ESTADOS_CONTACTO = [
  { value: "no_contactado", label: "No contactado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
]

const MEDIOS_CONTACTO = [
  { value: "", label: "— Medio —" },
  { value: "telefono", label: "Teléfono" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "personal", label: "Personal" },
  { value: "otro", label: "Otro" },
]

type Resultado = { tono: "ok" | "aviso" | "error"; texto: string }

export function SeguimientoActions({
  participanteId,
  estadoContacto,
  medioContacto,
  notasSeguimiento,
  email,
}: SeguimientoActionsProps) {
  const router = useRouter()
  const [estado, setEstado] = useState(estadoContacto ?? "no_contactado")
  const [medio, setMedio] = useState(medioContacto ?? "")
  const [notas, setNotas] = useState(notasSeguimiento ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const dirty =
    estado !== (estadoContacto ?? "no_contactado") ||
    medio !== (medioContacto ?? "") ||
    notas !== (notasSeguimiento ?? "")

  const yaConfirmado = (estadoContacto ?? "no_contactado") === "confirmado"
  // Confirmar dispara un mail; sin dirección no hay nada que mandar.
  const confirmarSinEmail = estado === "confirmado" && !email

  async function guardar(reenviar: boolean) {
    const setBusy = reenviar ? setIsResending : setIsSaving
    setBusy(true)
    setResultado(null)

    try {
      const res = await fetch(`/api/interesados/${participanteId}/seguimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_contacto: reenviar ? "confirmado" : estado,
          medio_contacto: medio || null,
          notas_seguimiento: notas.trim() || null,
          reenviar,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResultado({ tono: "error", texto: data.error ?? "No se pudo guardar." })
        return
      }

      if (data.emailEnviado) {
        setResultado({
          tono: "ok",
          texto: data.conLinkDePago
            ? `Link de pago enviado a ${data.email}`
            : `Confirmación enviada a ${data.email}`,
        })
      } else if (data.motivo) {
        setResultado({ tono: "aviso", texto: `Guardado. No se envió el mail: ${data.motivo}.` })
      } else {
        setResultado({ tono: "ok", texto: "Guardado" })
      }

      router.refresh()
    } catch {
      setResultado({ tono: "error", texto: "Error de conexión. Intentá de nuevo." })
    } finally {
      setBusy(false)
    }
  }

  const busy = isSaving || isResending

  return (
    <div className="flex w-full flex-col gap-2 lg:w-64">
      <select
        value={estado}
        onChange={(e) => {
          setEstado(e.target.value)
          setResultado(null)
        }}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      >
        {ESTADOS_CONTACTO.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === "confirmado" && !email}>
            {o.label}
            {o.value === "confirmado" && !email ? " (sin email)" : ""}
          </option>
        ))}
      </select>

      <select
        value={medio}
        onChange={(e) => {
          setMedio(e.target.value)
          setResultado(null)
        }}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      >
        {MEDIOS_CONTACTO.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <textarea
        value={notas}
        onChange={(e) => {
          setNotas(e.target.value)
          setResultado(null)
        }}
        rows={2}
        placeholder="Nota de seguimiento..."
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      />

      {estado === "confirmado" && !yaConfirmado && email && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Mail className="mt-0.5 h-3 w-3 shrink-0" />
          Al guardar se le envía el link de pago a {email}
        </p>
      )}

      {confirmarSinEmail && (
        <p className="text-xs text-destructive">Esta persona no tiene email cargado.</p>
      )}

      <Button
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => guardar(false)}
        disabled={busy || !dirty || confirmarSinEmail}
      >
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Guardar
      </Button>

      {yaConfirmado && email && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => guardar(true)}
          disabled={busy}
        >
          {isResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Reenviar link de pago
        </Button>
      )}

      {resultado && (
        <p
          className={`text-xs ${
            resultado.tono === "error"
              ? "text-destructive"
              : resultado.tono === "aviso"
                ? "text-amber-600"
                : "text-green-600"
          }`}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  )
}

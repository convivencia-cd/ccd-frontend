"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { formatDateAR } from "@/lib/utils"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { createClient } from "@/lib/supabase/client"

interface Evento {
  id: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  precio: number | null
  cupo_maximo: number
}

export default function InscripcionRetiroPage() {
  const router = useRouter()
  const params = useParams()
  const eventoId = params.id as string

  const [evento, setEvento] = useState<Evento | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [notas, setNotas] = useState("")

  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles_usuario")
          .select("persona_id")
          .eq("id", user.id)
          .single()

        if (perfil?.persona_id) {
          setPersonaId(perfil.persona_id)
        }
      }

      const { data: eventoData } = await supabase
        .from("eventos")
        .select("id, nombre, fecha_inicio, fecha_fin, precio, cupo_maximo")
        .eq("id", eventoId)
        .eq("tipo", "retiro")
        .single()

      if (eventoData) setEvento(eventoData)
      setIsLoading(false)
    }
    loadData()
  }, [eventoId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/auth/login?redirect=/retiros/${eventoId}/inscripcion`)
      return
    }

    if (!personaId) {
      setError("Tu cuenta no está vinculada a una persona. Contactá al administrador.")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/eventos/${eventoId}/interes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas: notas || null }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "No se pudo registrar el interés.")
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el interés.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!evento) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Retiro no encontrado</h1>
            <Link href="/retiros" className="mt-4 inline-block text-primary hover:underline">
              Volver a retiros
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md border-border text-center">
            <CardHeader>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="mt-4 text-2xl text-foreground">¡Inscripción Exitosa!</CardTitle>
              <CardDescription>Tu solicitud ha sido recibida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Hemos recibido tu inscripción para <strong>{evento.nombre}</strong>.
                Recibirás confirmación una vez que sea procesada.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/inscripciones">
                  <Button className="w-full">Ver mis Inscripciones</Button>
                </Link>
                <Link href="/retiros">
                  <Button variant="outline" className="w-full bg-transparent">Ver más Retiros</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-linear-to-b from-primary/5 to-background py-8">
          <div className="container mx-auto px-4">
            <Link href={`/retiros/${eventoId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver al retiro
            </Link>
          </div>
        </section>

        <section className="py-8">
          <div className="container mx-auto max-w-2xl px-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">Formulario de Inscripción</CardTitle>
                <CardDescription>Inscripción para: {evento.nombre}</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                  {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="notas" className="text-sm font-medium text-foreground">
                      Notas adicionales
                    </label>
                    <textarea
                      id="notas"
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      placeholder="Alguna información adicional que quieras compartir..."
                      disabled={isSubmitting}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground min-h-20"
                    />
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <h4 className="font-medium text-foreground">Resumen</h4>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>Retiro: {evento.nombre}</p>
                      <p>
                        Fecha: {formatDateAR(evento.fecha_inicio)} — {formatDateAR(evento.fecha_fin)}
                      </p>
                      <p className="text-base font-semibold text-foreground">
                        Total: {evento.precio ? `$${Number(evento.precio).toFixed(2)}` : "Gratis"}
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Confirmar Inscripción"
                    )}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

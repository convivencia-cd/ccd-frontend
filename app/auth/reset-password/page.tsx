"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import type { EmailOtpType } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type Estado = "verificando" | "listo" | "invalido" | "exito"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [estado, setEstado] = useState<Estado>("verificando")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelado = false

    // Camino principal: el link que mandamos por Resend trae `token_hash`
    // (ver `app/api/auth/forgot-password/route.ts`) y se canjea por una sesión acá.
    const tokenHash = searchParams.get("token_hash")
    const type = (searchParams.get("type") ?? "recovery") as EmailOtpType

    if (tokenHash) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }: { error: unknown }) => {
        if (cancelado) return
        if (error) {
          setEstado("invalido")
          return
        }
        // Sacamos el token de la URL para que no quede en el historial ni se
        // reintente al recargar (ya está consumido).
        window.history.replaceState(null, "", window.location.pathname)
        setEstado("listo")
      })
      return () => {
        cancelado = true
      }
    }

    // Camino alternativo: links generados por el propio Supabase, que dejan la sesión
    // en el fragmento `#access_token` y disparan PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setEstado("listo")
      }
    })

    // Si ya hay sesión activa (por ejemplo, el hash se procesó antes de montar),
    // habilitamos el formulario igual.
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (cancelado) return
      if (data.session) setEstado("listo")
      else setTimeout(() => !cancelado && setEstado(s => (s === "verificando" ? "invalido" : s)), 3000)
    })

    return () => {
      cancelado = true
      subscription.unsubscribe()
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      // Supabase rechaza repetir la contraseña actual.
      const misma = error.code === 'same_password' || /different from the old/i.test(error.message)
      setError(
        misma
          ? "La contraseña nueva tiene que ser distinta de la actual."
          : "No se pudo actualizar la contraseña. El link puede haber expirado."
      )
      setIsLoading(false)
      return
    }

    // Si la persona todavía arrastraba la contraseña temporal, ya la cambió acá:
    // sin esto el middleware la mandaría igual a /auth/cambiar-password-inicial
    // a cambiarla por segunda vez (ver `lib/supabase/proxy.ts`).
    if (user) {
      await supabase
        .from("personas")
        .update({ debe_cambiar_password: false })
        .eq("auth_user_id", user.id)
    }

    // La sesión abierta por el link de recuperación no debe quedar viva: que vuelva
    // a entrar con la contraseña nueva.
    await supabase.auth.signOut()

    setEstado("exito")
    setTimeout(() => {
      router.push("/auth/login")
    }, 2500)
  }

  return (
    <Card className="w-full max-w-md border-border">
      <CardHeader className="text-center">
        <Link href="/" className="mx-auto mb-4 flex flex-col items-center gap-2">
          <Image
            src="/logoccd.jpeg"
            alt="Convivencia con Dios"
            width={64}
            height={64}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold text-foreground">
            Convivencia con Dios
          </span>
        </Link>
        <CardTitle className="text-2xl text-foreground">Nueva contraseña</CardTitle>
        <CardDescription>
          Ingresá tu nueva contraseña para acceder a tu cuenta.
        </CardDescription>
      </CardHeader>

      {estado === "exito" ? (
        <CardContent>
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            ¡Contraseña actualizada correctamente! Redirigiendo al inicio de sesión...
          </div>
        </CardContent>
      ) : estado === "verificando" ? (
        <CardContent>
          <div className="flex items-center gap-3 rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Verificando el link de recuperación...
          </div>
        </CardContent>
      ) : estado === "invalido" ? (
        <CardContent className="space-y-4">
          <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Este link ya no es válido: puede haber vencido o haberse usado antes. Los links
            de recuperación sirven una sola vez.
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">Pedir un link nuevo</Link>
          </Button>
          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repetí la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar contraseña"
              )}
            </Button>
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Volver al inicio de sesión
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-md border-border">
            <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </CardContent>
          </Card>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}

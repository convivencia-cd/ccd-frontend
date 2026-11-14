"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ShieldAlert } from "lucide-react"
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

export default function CambiarPasswordInicialPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    if (!user) {
      setError("No se pudo verificar tu sesión. Volvé a iniciar sesión.")
      setIsLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      // Supabase rechaza repetir la contraseña actual (la temporal).
      const misma = updateError.code === 'same_password' || /different from the old/i.test(updateError.message)
      setError(
        misma
          ? "La contraseña nueva tiene que ser distinta de la temporal con la que entraste."
          : "No se pudo actualizar la contraseña. Intentá de nuevo."
      )
      setIsLoading(false)
      return
    }

    const { error: flagError } = await supabase
      .from("personas")
      .update({ debe_cambiar_password: false })
      .eq("auth_user_id", user.id)

    if (flagError) {
      setError("La contraseña se actualizó, pero hubo un problema al continuar. Recargá la página.")
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push("/dashboard")
      router.refresh()
    }, 1200)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex flex-col items-center gap-2">
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
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl text-foreground">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Cambiá tu contraseña
          </CardTitle>
          <CardDescription>
            Por seguridad, antes de continuar tenés que elegir una contraseña nueva —
            la que usaste para entrar es temporal.
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent>
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              ¡Contraseña actualizada! Entrando a la plataforma...
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
            <CardFooter>
              <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                {isLoading ? "Actualizando..." : "Actualizar contraseña y continuar"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

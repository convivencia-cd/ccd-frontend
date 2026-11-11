import { CalendarDays } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserContext } from "@/lib/auth/context"
import { createClient } from "@/lib/supabase/server"
import { cargarEventosCalendario } from "@/lib/eventos/calendario"
import { addDias, addMeses, hoyAR, primerDiaDelMes, ultimoDiaDelMes } from "@/lib/eventos/calendario-shared"
import { CalendarioEventos } from "@/components/calendario/calendario-eventos"

function Encabezado() {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-foreground">
        <CalendarDays className="h-5 w-5 text-primary" />
        Calendario de Retiros
      </CardTitle>
      <CardDescription>
        Convivencias, retiros y talleres de la comunidad. Los resaltados son en los que tenés un rol.
      </CardDescription>
    </CardHeader>
  )
}

// Calendario del Panel de Inicio (lo ven todos los usuarios, internos y
// Participantes). Navegar fuera de la ventana cargada lleva a /calendario.
export async function CalendarioInicio({ ctx }: { ctx: UserContext }) {
  const hoy = hoyAR()
  const mes = hoy.slice(0, 7)
  const rango = {
    desde: addDias(primerDiaDelMes(addMeses(mes, -2)), -7),
    hasta: addDias(ultimoDiaDelMes(addMeses(mes, 12)), 7),
  }
  const supabase = await createClient()
  const eventos = await cargarEventosCalendario(supabase, ctx, rango)

  return (
    <Card className="border-border bg-card">
      <Encabezado />
      <CardContent>
        <CalendarioEventos eventos={eventos} hoy={hoy} mesInicial={mes} rango={rango} variante="inicio" />
      </CardContent>
    </Card>
  )
}

export function CalendarioInicioSkeleton() {
  return (
    <Card className="border-border bg-card" aria-busy="true">
      <Encabezado />
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-56 motion-reduce:animate-none" />
        <Skeleton className="h-80 w-full motion-reduce:animate-none" />
      </CardContent>
    </Card>
  )
}

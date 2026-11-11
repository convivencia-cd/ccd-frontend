export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { CalendarDays } from "lucide-react"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { createClient } from "@/lib/supabase/server"
import { cargarEventosCalendario } from "@/lib/eventos/calendario"
import {
  addDias,
  addMeses,
  esMesValido,
  hoyAR,
  primerDiaDelMes,
  ultimoDiaDelMes,
} from "@/lib/eventos/calendario-shared"
import { CalendarioEventos } from "@/components/calendario/calendario-eventos"

// Calendario de Retiros (vista extensa). Lo ve todo usuario de la plataforma;
// qué eventos aparecen depende de sus permisos (mismo criterio que /eventos)
// más los eventos donde tiene un rol.
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; vista?: string; tramite?: string }>
}) {
  const ctx = await getUserContext()
  if (!ctx) redirect("/auth/login")

  const params = await searchParams
  const hoy = hoyAR()
  const mes = esMesValido(params.mes) ? params.mes : hoy.slice(0, 7)
  const vista = params.vista === "agenda" ? "agenda" : "mes"
  const puedeVerEnTramite = canPerform(ctx, "event.view_all_estados")
  const incluyeEnTramite = puedeVerEnTramite && params.tramite === "1"

  // Se trae una ventana amplia alrededor del mes pedido para navegar sin
  // recargar; la semana de margen cubre los días de meses vecinos de la grilla.
  const rango = {
    desde: addDias(primerDiaDelMes(addMeses(mes, -6)), -7),
    hasta: addDias(ultimoDiaDelMes(addMeses(mes, 12)), 7),
  }

  const supabase = await createClient()
  const eventos = await cargarEventosCalendario(supabase, ctx, {
    ...rango,
    incluirEnTramite: incluyeEnTramite,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <CalendarDays className="h-8 w-8 text-primary" />
          Calendario de Retiros
        </h1>
        <p className="mt-2 text-muted-foreground">
          Todas las convivencias, retiros y talleres de la comunidad, con tu rol en cada uno.
        </p>
      </div>

      <CalendarioEventos
        key={`${mes}-${incluyeEnTramite}`}
        eventos={eventos}
        hoy={hoy}
        mesInicial={mes}
        rango={rango}
        variante="completo"
        vistaInicial={vista}
        puedeVerEnTramite={puedeVerEnTramite}
        incluyeEnTramite={incluyeEnTramite}
      />
    </div>
  )
}

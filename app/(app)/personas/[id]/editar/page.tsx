export const dynamic = 'force-dynamic'

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { EditPersonaForm } from "./_components/edit-persona-form"

export default async function EditPersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext()
  if (!ctx) redirect('/auth/login')
  if (!canPerform(ctx, 'person.update')) redirect('/personas')
  const canEditSocioActivo = canPerform(ctx, 'person.edit_socio_activo')

  const { id } = await params
  const supabase = await createClient()

  const [
    { data: persona },
    { data: modosActuales },
    { data: historialModos },
    { data: asignacionesActivas },
    { data: historialAsignaciones },
    { data: ministerios },
    { data: organizaciones },
    { data: personaOrgs },
    { data: todasPersonas },
    { data: acompañamientoActual },
    { data: acompanados },
  ] = await Promise.all([
    supabase.from("personas").select("*").eq("id", id).single(),
    supabase
      .from("persona_modos")
      .select("id, modo, fecha_inicio")
      .eq("persona_id", id)
      .is("fecha_fin", null),
    supabase
      .from("persona_modos")
      .select("id, modo, fecha_inicio, fecha_fin, motivo_fin, documento_url")
      .eq("persona_id", id)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("asignaciones_ministerio")
      .select("id, fecha_inicio, estado, ministerio:ministerios!ministerio_id(nombre, tipo, nivel), organizacion:organizaciones!organizacion_id(nombre, tipo)")
      .eq("persona_id", id)
      .is("fecha_fin", null),
    supabase
      .from("asignaciones_ministerio")
      .select("id, fecha_inicio, fecha_fin, estado, ministerio:ministerios!ministerio_id(nombre), organizacion:organizaciones!organizacion_id(nombre)")
      .eq("persona_id", id)
      .order("fecha_inicio", { ascending: false }),
    supabase.from("ministerios").select("id, nombre, tipo, nivel").eq("activo", true).order("tipo").order("nombre"),
    supabase.from("organizaciones").select("id, nombre, tipo, parent_id").is("fecha_baja", null).order("nombre"),
    supabase
      .from("persona_organizacion")
      .select("id, tipo_relacion, organizacion_id, organizacion:organizaciones!organizacion_id(nombre)")
      .eq("persona_id", id)
      .is("fecha_fin", null),
    supabase
      .from("personas")
      .select("id, nombre, apellido, apodo")
      .is("fecha_baja", null)
      .neq("id", id)
      .order("apellido"),
    supabase
      .from("persona_acompanamiento")
      .select("id, fecha_inicio, acompanante_id, acompanante_libre, acompanante:personas!acompanante_id(id, nombre, apellido, apodo)")
      .eq("persona_id", id)
      .is("fecha_fin", null)
      .maybeSingle(),
    // "Acompaño a": personas que eligieron a esta persona como su acompañante.
    supabase
      .from("persona_acompanamiento")
      .select("id, persona:personas!persona_id(id, nombre, apellido, apodo)")
      .eq("acompanante_id", id)
      .is("fecha_fin", null),
  ])

  if (!persona) notFound()

  // Cecistas activos para el selector de acompañante (paginado: Supabase
  // corta la respuesta por defecto en 1000 filas y hay más que eso).
  const cecistas: { id: string; nombre: string; apellido: string; apodo: string | null }[] = []
  {
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data: page } = await supabase
        .from("personas")
        .select("id, nombre, apellido, apodo")
        .eq("tipo_persona", "cecista")
        .is("fecha_baja", null)
        .neq("id", id)
        .order("apellido")
        .range(from, from + pageSize - 1)
      if (!page || page.length === 0) break
      cecistas.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }
  }

  const confraternidadOrg = personaOrgs?.find(o => o.tipo_relacion === 'confraternidad') as { id: string; organizacion_id: string; organizacion: { nombre: string } } | undefined
  const fraternidadOrg = personaOrgs?.find(o => o.tipo_relacion === 'fraternidad') as { id: string; organizacion_id: string; organizacion: { nombre: string } } | undefined

  return (
    <EditPersonaForm
      persona={persona}
      modoActual={modosActuales?.find(row => row.modo !== 'asesor') ?? modosActuales?.[0] ?? null}
      historialModos={historialModos ?? []}
      asignacionesActivas={asignacionesActivas ?? []}
      historialAsignaciones={historialAsignaciones ?? []}
      ministerios={ministerios ?? []}
      organizaciones={organizaciones ?? []}
      confraternidadActualId={confraternidadOrg?.organizacion_id ?? null}
      fraternidadActualId={fraternidadOrg?.organizacion_id ?? null}
      personaOrgConfraternidadId={confraternidadOrg?.id ?? null}
      personaOrgFraternidadId={fraternidadOrg?.id ?? null}
      todasPersonas={todasPersonas ?? []}
      acompañamientoActual={(acompañamientoActual as any) ?? null}
      cecistas={cecistas}
      acompanados={(acompanados as any) ?? []}
      canEditSocioActivo={canEditSocioActivo}
    />
  )
}

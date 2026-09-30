export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit2, Paperclip } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getUserContext, canPerform } from "@/lib/auth/context"
import { formatDateAR } from "@/lib/utils"
import { PersonaAvatar } from "./_components/persona-avatar"
import { VotosEditor } from "./_components/votos-editor"
import { apellidoNombreConApodo } from "@/lib/personas/nombre"

function formatDate(date: string | null) {
  return formatDateAR(date)
}

const estadoVidaLabel: Record<string, string> = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  viudo: "Viudo/a",
  separado: "Separado/a",
  consagrado: "Consagrado/a",
}

const nivelEstudiosLabel: Record<string, string> = {
  primario: "Primario",
  secundario: "Secundario",
  terciario: "Terciario",
  universitario: "Universitario",
  posgrado_doctorado: "Posgrado / Doctorado",
}

const tipoPersonaLabel: Record<string, string> = {
  cecista: "Cecista",
  no_cecista: "No Cecista",
  otro: "Otro",
  interesado: "Interesado/a",
  inscripto: "Inscripto/a",
  convivente: "Convivente",
}

// Etiquetas de votos del cecista — deben coincidir con VOTO_TIPOS de settings/page.tsx
const votoLabel: Record<string, string> = {
  tender_union_dios: "Tender a la unión con Dios",
  caridad_fraterna: "Caridad fraterna",
  irradiacion: "Irradiación",
  castidad: "Castidad",
  pobreza: "Pobreza",
  obediencia: "Obediencia",
  tender_union_dios_matrimonios: "Tender a la unión con Dios (matrimonios)",
  otros_familiares: "Solo familiares — otros votos",
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-sm">{value || "—"}</dd>
    </div>
  )
}

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (
    !ctx ||
    (!canPerform(ctx, "person.create") && !canPerform(ctx, "person.update"))
  ) {
    redirect("/personas")
  }

  const [
    { data: persona, error },
    { data: modos },
    { data: asignaciones },
    { data: personaOrgs },
    { data: historialAcompanamiento },
    { data: acompanaA },
    { data: votos },
    { data: participacionesConvivente },
  ] = await Promise.all([
    supabase
      .from("personas")
      .select(
        "id, nombre, apellido, apodo, email, email_ccd, telefono, tipo_documento, documento, fecha_nacimiento, direccion, direccion_nro, localidad, codigo_postal, provincia, pais, notas, estado, created_at, acepta_comunicaciones, estado_eclesial, estado_vida, diocesis, tipo_persona, parroquia, socio_asociacion, referente_comunidad, cecista_dedicado, intercesor_dies_natalis, nombre_usuario, nivel_estudios, anio_ingreso, acompanante_id, fecha_ingreso_comunidad, foto_url, es_convivente",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("persona_modos")
      .select("modo, fecha_inicio, fecha_fin, estado, motivo_fin, documento_url, notas")
      .eq("persona_id", id)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("asignaciones_ministerio")
      .select(
        "id, fecha_inicio, fecha_fin, estado, ministerio:ministerios!ministerio_id(id, nombre), organizacion:organizaciones!organizacion_id(id, nombre), documento_url, notas",
      )
      .eq("persona_id", id)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("persona_organizacion")
      .select("tipo_relacion, organizacion:organizaciones!organizacion_id(id, nombre)")
      .eq("persona_id", id)
      .is("fecha_fin", null),
    supabase
      .from("persona_acompanamiento")
      .select("id, fecha_inicio, fecha_fin, notas, acompanante_libre, acompanante:personas!acompanante_id(id, nombre, apellido, apodo)")
      .eq("persona_id", id)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("persona_acompanamiento")
      .select("persona_id, persona:personas!persona_id(id, nombre, apellido, apodo)")
      .eq("acompanante_id", id)
      .is("fecha_fin", null),
    supabase
      .from("persona_votos")
      .select("tipo_voto, anio, perpetuo, temporal_cant_anios")
      .eq("persona_id", id),
    supabase
      .from("evento_participantes")
      .select("id, estado_participacion, fecha_asistencia, evento:eventos!evento_id(id, nombre, fecha_inicio)")
      .eq("persona_id", id)
      .eq("rol_en_evento", "convivente"),
  ])

  if (error || !persona) notFound()

  const canUpdate = ctx ? canPerform(ctx, "person.update") : false
  const canEditVotos = ctx ? canPerform(ctx, "votos.edit") : false
  const confraternidadOrg = (personaOrgs as any[])?.find((o) => o.tipo_relacion === "confraternidad")?.organizacion
  const fraternidadOrg = (personaOrgs as any[])?.find((o) => o.tipo_relacion === "fraternidad")?.organizacion

  // Convivencias en las que fue convivente: las que tienen asistencia tomada
  // (mismo criterio que el trigger de 082 que pone el tilde es_convivente).
  const convivencias = ((participacionesConvivente ?? []) as unknown as {
    id: string
    estado_participacion: string
    fecha_asistencia: string | null
    evento: { id: string; nombre: string; fecha_inicio: string | null } | null
  }[])
    .filter(
      (p) =>
        p.fecha_asistencia ||
        p.estado_participacion === "en_curso" ||
        p.estado_participacion === "completado",
    )
    .sort((a, b) => (b.evento?.fecha_inicio ?? "").localeCompare(a.evento?.fecha_inicio ?? ""))

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/personas"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Personas
        </Link>
        {canUpdate && (
          <Link href={`/personas/${id}/editar`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
          </Link>
        )}
      </div>

      {/* Nombre y estado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {apellidoNombreConApodo(persona)}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                persona.estado === "activo"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {persona.estado}
            </span>
          </div>
        </div>
        <PersonaAvatar
          personaId={persona.id}
          fotoUrl={(persona as any).foto_url ?? null}
          initials={`${persona.nombre.charAt(0)}${persona.apellido.charAt(0)}`}
          canUpdate={canUpdate}
        />
      </div>

      {/* Datos Personales */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Teléfono" value={persona.telefono} />
            <Field label="Fecha de nacimiento" value={formatDate(persona.fecha_nacimiento)} />
            <Field label="Mail Personal" value={persona.email} />
            <Field label="Mail CcD" value={persona.email_ccd} />
            <Field label="Apodo / Sobrenombre" value={persona.apodo} />
            <Field label="Nombre de usuario" value={persona.nombre_usuario} />
            <Field
              label="Documento"
              value={persona.tipo_documento ? `${persona.tipo_documento.toUpperCase()} ${persona.documento ?? ""}`.trim() : null}
            />
            <div className="col-span-2">
              <Field
                label="Dirección"
                value={[persona.direccion, persona.direccion_nro].filter(Boolean).join(" ") || null}
              />
            </div>
            <Field label="Ciudad" value={persona.localidad} />
            <Field label="CP" value={persona.codigo_postal} />
            <Field label="Diócesis" value={persona.diocesis} />
            <Field label="Provincia" value={persona.provincia} />
            <Field label="País" value={persona.pais} />
            <Field label="Estado eclesiástico" value={persona.estado_eclesial} />
            <Field label="Parroquia" value={persona.parroquia} />
            <Field
              label="Estado de vida"
              value={persona.estado_vida ? estadoVidaLabel[persona.estado_vida] ?? persona.estado_vida : null}
            />
            <Field
              label="Nivel de estudios"
              value={persona.nivel_estudios ? nivelEstudiosLabel[persona.nivel_estudios] ?? persona.nivel_estudios : null}
            />
            <Field label="Año de ingreso" value={persona.anio_ingreso ? String(persona.anio_ingreso) : null} />
            <Field label="Fecha de registro" value={formatDate(persona.created_at)} />
            <Field
              label="Comunicaciones"
              value={persona.acepta_comunicaciones ? "Acepta" : "No acepta"}
            />
            <div className="col-span-2">
              <dt className="text-muted-foreground text-sm">Notas</dt>
              <dd className="text-foreground text-sm whitespace-pre-wrap">{persona.notas || "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Acompañamiento */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Acompañamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const active = (historialAcompanamiento ?? []).find((r: any) => !r.fecha_fin)
            return (
              <div>
                <dt className="text-muted-foreground text-sm">Acompañante actual</dt>
                <dd className="text-foreground text-sm mt-0.5">
                  {active ? (
                    <>
                      {(active as any).acompanante ? (
                        <Link href={`/personas/${(active as any).acompanante.id}`} className="text-primary hover:underline">
                          {apellidoNombreConApodo((active as any).acompanante)}
                        </Link>
                      ) : (
                        <span>{(active as any).acompanante_libre ?? "—"}</span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        desde {formatDate((active as any).fecha_inicio)}
                      </span>
                    </>
                  ) : "—"}
                </dd>
              </div>
            )
          })()}

          {(acompanaA ?? []).length > 0 && (
            <div>
              <dt className="text-muted-foreground text-sm">Acompaña a</dt>
              <dd className="text-foreground text-sm flex flex-col gap-0.5 mt-0.5">
                {(acompanaA as any[]).map((r) => (
                  <Link key={r.persona_id} href={`/personas/${r.persona_id}`} className="text-primary hover:underline">
                    {r.persona ? apellidoNombreConApodo(r.persona) : "—"}
                  </Link>
                ))}
              </dd>
            </div>
          )}

          {(historialAcompanamiento ?? []).length > 1 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Historial</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Acompañante</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Desde</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Hasta</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {(historialAcompanamiento as any[]).map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/50 last:border-0 ${
                        !r.fecha_fin ? "bg-green-50 dark:bg-green-900/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-4">
                        {r.acompanante ? (
                          <Link href={`/personas/${r.acompanante.id}`} className="text-primary hover:underline">
                            {apellidoNombreConApodo(r.acompanante)}
                          </Link>
                        ) : (
                          r.acompanante_libre ?? "—"
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.fecha_inicio)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {r.fecha_fin ? (
                          formatDate(r.fecha_fin)
                        ) : (
                          <span className="text-green-700 dark:text-green-400 font-medium">actual</span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">{r.notas || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relación con CcD */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Relación con CcD
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field
              label="Categoría"
              value={
                persona.tipo_persona
                  ? (tipoPersonaLabel[persona.tipo_persona] ?? persona.tipo_persona)
                  : null
              }
            />
            <Field
              label="Convivente"
              value={(persona as any).es_convivente ? "Sí" : "No"}
            />
            <Field
              label="Fecha de ingreso a la comunidad"
              value={formatDate((persona as any).fecha_ingreso_comunidad)}
            />
            {(persona.socio_asociacion || persona.referente_comunidad || persona.cecista_dedicado) && (
              <div className="col-span-2">
                <dt className="text-muted-foreground text-sm mb-1">Características</dt>
                <dd className="flex gap-2 flex-wrap">
                  {persona.referente_comunidad && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Referente de Comunidad</span>
                  )}
                  {persona.socio_asociacion && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Socio Activo</span>
                  )}
                  {persona.cecista_dedicado && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Dedicado</span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground text-sm">Confraternidad</dt>
              <dd className="text-foreground text-sm">
                {confraternidadOrg ? (
                  <Link href={`/organizaciones/${confraternidadOrg.id}`} className="text-primary hover:underline">
                    {confraternidadOrg.nombre}
                  </Link>
                ) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Fraternidad</dt>
              <dd className="text-foreground text-sm">
                {fraternidadOrg ? (
                  <Link href={`/organizaciones/${fraternidadOrg.id}`} className="text-primary hover:underline">
                    {fraternidadOrg.nombre}
                  </Link>
                ) : "—"}
              </dd>
            </div>
            {persona.intercesor_dies_natalis && (
              <Field
                label="Intercesor Dies Natalis"
                value={formatDate(persona.intercesor_dies_natalis)}
              />
            )}
          </dl>
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Modo de Participación</p>
            {(modos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin historial de modos registrado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Modo</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Desde</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Hasta</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Notas</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Adjunto</th>
                  </tr>
                </thead>
                <tbody>
                  {(modos ?? []).map((m: any, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/50 last:border-0 ${
                        !m.fecha_fin ? "bg-green-50 dark:bg-green-900/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 text-foreground capitalize">{m.modo}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(m.fecha_inicio)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {m.fecha_fin ? (
                          formatDate(m.fecha_fin)
                        ) : (
                          <span className="text-green-700 dark:text-green-400 font-medium">actual</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground capitalize">{m.estado ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground max-w-50">
                        {m.notas ? (
                          <span className="whitespace-pre-wrap">{m.notas}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2">
                        {m.documento_url ? (
                          <a
                            href={m.documento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Paperclip className="h-3 w-3" />
                            Ver
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Convivencias como convivente</p>
            {convivencias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {(persona as any).es_convivente
                  ? "Hizo su convivencia antes de que existiera la plataforma."
                  : "Todavía no participó de ninguna convivencia."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Evento</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {convivencias.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-foreground">
                        {c.evento ? (
                          <Link href={`/eventos/${c.evento.id}`} className="text-primary hover:underline">
                            {c.evento.nombre}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(c.evento?.fecha_inicio ?? null)}</td>
                      <td className="py-2 text-muted-foreground">
                        {c.fecha_asistencia ? formatDate(c.fecha_asistencia) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Votos — editable para Referentes/Responsables de Dedicados (votos.edit) */}
      {persona.tipo_persona === "cecista" && canEditVotos && (
        <VotosEditor personaId={persona.id} initialVotos={(votos ?? []) as any} />
      )}

      {/* Votos (solo lectura — cecistas con votos cargados, sin permiso de edición) */}
      {persona.tipo_persona === "cecista" &&
        !canEditVotos &&
        (() => {
          const votosConDatos = (votos ?? []).filter(
            (v: any) => v.anio || v.perpetuo || v.temporal_cant_anios,
          )
          if (votosConDatos.length === 0) return null
          return (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Votos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Voto</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Año</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votosConDatos.map((v: any, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-4 text-foreground">
                          {votoLabel[v.tipo_voto] ?? v.tipo_voto}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{v.anio || "—"}</td>
                        <td className="py-2 text-muted-foreground">
                          {v.perpetuo
                            ? "Perpetuo"
                            : v.temporal_cant_anios
                              ? `Temporal · ${v.temporal_cant_anios} ${v.temporal_cant_anios === 1 ? "año" : "años"}`
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )
        })()}

      {/* Asignaciones de Rol */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Asignaciones de Rol
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(asignaciones ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin asignaciones de rol registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Rol</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Organización</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Desde</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Hasta</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Notas</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Adjunto</th>
                </tr>
              </thead>
              <tbody>
                {(asignaciones as any[]).map((a, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/50 last:border-0 ${
                      !a.fecha_fin ? "bg-green-50 dark:bg-green-900/10" : ""
                    }`}
                  >
                    <td className="py-2 pr-4 text-foreground">
                      {a.ministerio ? (
                        <Link href={`/ministerios/catalogo/${a.ministerio.id}`} className="text-primary hover:underline">
                          {a.ministerio.nombre}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {a.organizacion ? (
                        <Link href={`/organizaciones/${a.organizacion.id}`} className="text-primary hover:underline">
                          {a.organizacion.nombre}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDate(a.fecha_inicio)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {a.fecha_fin ? (
                        formatDate(a.fecha_fin)
                      ) : (
                        <span className="text-green-700 dark:text-green-400 font-medium">actual</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground max-w-50">
                      {a.notas ? (
                        <span className="whitespace-pre-wrap">{a.notas}</span>
                      ) : "—"}
                    </td>
                    <td className="py-2">
                      {a.documento_url ? (
                        <a
                          href={a.documento_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          Ver
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

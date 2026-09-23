"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LocationFields } from "@/components/location-fields"
import { Combobox } from "@/components/ui/combobox"
import FlyerUploadPanel from "../_components/flyer-upload-panel"

type OrgOption = { id: string; nombre: string; tipo: string }
type FechaRow = { id?: string; fecha_inicio: string; fecha_fin: string }

export default function EditarEventoForm({
  isAdmin = false,
}: {
  isAdmin?: boolean
}) {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [organizaciones, setOrganizaciones] = useState<OrgOption[]>([])
  const [casasRetiro, setCasasRetiro] = useState<OrgOption[]>([])
  const [fechasEjecucion, setFechasEjecucion] = useState<FechaRow[]>([])
  const [flyerUrls, setFlyerUrls] = useState<{ horizontal: string | null; cuadrado: string | null }>({ horizontal: null, cuadrado: null })
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "convivencia",
    fecha_solicitud: "",
    fecha_inicio: "",
    fecha_fin: "",
    organizacion_id: "",
    casa_retiro_id: "",
    cupo_maximo: "30",
    precio: "",
    pension: "",
    audiencia: "cerrado",
    modalidad: "presencial",
    estado: "borrador",
    descripcion: "",
    link_pago_mercadopago: "",
    ciudad: "",
    codigo_postal: "",
    diocesis: "",
    provincia_evento: "",
    pais_evento: "Argentina",
  })

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase
        .from("eventos")
        .select(
          "id, nombre, tipo, fecha_solicitud, fecha_inicio, fecha_fin, organizacion_id, casa_retiro_id, cupo_maximo, precio, pension, audiencia, modalidad, estado, descripcion, link_pago_mercadopago, ciudad, codigo_postal, diocesis, provincia_evento, pais_evento, flyer_horizontal_url, flyer_cuadrado_url",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("organizaciones")
        .select("id, nombre, tipo")
        .is("fecha_baja", null)
        .neq("tipo", "casa_retiro")
        .order("nombre"),
      supabase
        .from("evento_fechas")
        .select("id, fecha_inicio, fecha_fin")
        .eq("evento_id", id)
        .order("fecha_inicio"),
      supabase
        .from("casas_retiro")
        .select("id, nombre")
        .is("fecha_baja", null)
        .eq("estado", "activa")
        .order("nombre"),
    ]).then(
      ([
        { data: evento, error: eventoError },
        { data: orgs },
        { data: fechas },
        { data: casas },
      ]) => {
        if (eventoError || !evento) {
          setError("No se encontró el evento")
          setLoadingData(false)
          return
        }
        setFormData({
          nombre: evento.nombre ?? "",
          tipo: evento.tipo ?? "convivencia",
          fecha_solicitud: evento.fecha_solicitud ?? "",
          fecha_inicio: evento.fecha_inicio ?? "",
          fecha_fin: evento.fecha_fin ?? "",
          organizacion_id: evento.organizacion_id ?? "",
          casa_retiro_id: evento.casa_retiro_id ?? "",
          cupo_maximo: evento.cupo_maximo?.toString() ?? "30",
          precio: evento.precio?.toString() ?? "",
          pension: evento.pension?.toString() ?? "",
          audiencia: evento.audiencia ?? "cerrado",
          modalidad: evento.modalidad ?? "presencial",
          estado: evento.estado ?? "borrador",
          descripcion: evento.descripcion ?? "",
          link_pago_mercadopago: (evento as Record<string, unknown>).link_pago_mercadopago as string ?? "",
          ciudad: evento.ciudad ?? "",
          codigo_postal: evento.codigo_postal ?? "",
          diocesis: evento.diocesis ?? "",
          provincia_evento: evento.provincia_evento ?? "",
          pais_evento: evento.pais_evento ?? "Argentina",
        })
        setFlyerUrls({
          horizontal: (evento as Record<string, unknown>).flyer_horizontal_url as string | null ?? null,
          cuadrado: (evento as Record<string, unknown>).flyer_cuadrado_url as string | null ?? null,
        })
        if (orgs) {
          setOrganizaciones(orgs)
        }
        if (casas) {
          setCasasRetiro(casas)
        }
        setFechasEjecucion(
          fechas && fechas.length > 0
            ? fechas.map((f) => ({
                id: f.id,
                fecha_inicio: f.fecha_inicio,
                fecha_fin: f.fecha_fin,
              }))
            : [{ fecha_inicio: "", fecha_fin: "" }],
        )
        setLoadingData(false)
      },
    )
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Validate fechas de ejecución are within the proposed range
      const fechasCompletas = fechasEjecucion.filter(
        (f) => f.fecha_inicio && f.fecha_fin,
      )
      for (const f of fechasCompletas) {
        if (formData.fecha_inicio && f.fecha_inicio < formData.fecha_inicio) {
          setError(
            "Las fechas de ejecución no pueden comenzar antes de la fecha de inicio propuesta.",
          )
          setLoading(false)
          return
        }
        if (formData.fecha_fin && f.fecha_fin > formData.fecha_fin) {
          setError(
            "Las fechas de ejecución no pueden terminar después de la fecha de fin propuesta.",
          )
          setLoading(false)
          return
        }
      }

      const supabase = createClient()

      const updateData: Record<string, unknown> = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        audiencia: formData.audiencia,
        modalidad: formData.modalidad,
        estado: formData.estado,
        organizacion_id: formData.organizacion_id || null,
        casa_retiro_id: formData.casa_retiro_id || null,
        cupo_maximo: formData.cupo_maximo
          ? parseInt(formData.cupo_maximo)
          : null,
        precio: formData.precio ? parseFloat(formData.precio) : null,
        pension: formData.pension ? parseFloat(formData.pension) : null,
        descripcion: formData.descripcion || null,
        link_pago_mercadopago: formData.link_pago_mercadopago.trim() || null,
        ciudad: formData.ciudad || null,
        codigo_postal: formData.codigo_postal || null,
        diocesis: formData.diocesis || null,
        provincia_evento: formData.provincia_evento || null,
        pais_evento: formData.pais_evento || "Argentina",
      }

      const { error: updateError } = await supabase
        .from("eventos")
        .update(updateData)
        .eq("id", id)

      if (updateError) throw updateError

      // Sync evento_fechas
      const validas = fechasEjecucion.filter(
        (f) => f.fecha_inicio && f.fecha_fin,
      )
      const nuevas = validas.filter((f) => !f.id)
      const existentes = validas.filter((f) => !!f.id)

      // Delete rows that were removed (existing ids not in current list)
      const idsActuales = existentes.map((f) => f.id!)
      const { data: prevFechas } = await supabase
        .from("evento_fechas")
        .select("id")
        .eq("evento_id", id)
      const idsEliminar = (prevFechas ?? [])
        .map((f) => f.id)
        .filter((fid) => !idsActuales.includes(fid))
      if (idsEliminar.length > 0) {
        await supabase.from("evento_fechas").delete().in("id", idsEliminar)
      }

      // Upsert existing rows
      for (const f of existentes) {
        await supabase
          .from("evento_fechas")
          .update({ fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin })
          .eq("id", f.id!)
      }

      // Insert new rows
      if (nuevas.length > 0) {
        await supabase
          .from("evento_fechas")
          .insert(
            nuevas.map((f) => ({
              evento_id: id,
              fecha_inicio: f.fecha_inicio,
              fecha_fin: f.fecha_fin,
            })),
          )
      }

      router.push("/eventos")
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar el evento"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Cargando evento...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/eventos"
        className="inline-flex items-center gap-2 text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Eventos
      </Link>

      <Card className="border-border bg-card max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">Editar Evento</CardTitle>
          <CardDescription>Modifica los datos del evento</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Convivencia San José 2026"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>

            {/* Tipo y Estado */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="convivencia">Convivencia</option>
                  <option value="retiro">Retiro</option>
                  <option value="taller">Taller</option>
                  <option value="encuentro">Encuentro</option>
                </select>
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="solicitud">Pend. Disc. Confra/Delegado</option>
                    <option value="discernimiento_confra">
                      Pend. Disc. Equipo Timón
                    </option>
                    <option value="discernimiento_eqt">
                      Disc. Equipo Timón
                    </option>
                    <option value="pendiente_datos_noticias">
                      Pendiente Datos Noticias
                    </option>
                    <option value="aprobado">Aprobado</option>
                    <option value="pendiente_aprobacion_final">
                      Pend. Aprobación Final EqT
                    </option>
                    <option value="publicado">Publicado</option>
                    <option value="en_curso">En Curso</option>
                    <option value="suspendido">Suspendido</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground capitalize">
                    {formData.estado.replace("_", " ")}
                    <span className="ml-2 text-xs">
                      (gestionado por el flujo de aprobación)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Fecha solicitud — automática, no editable */}
            <div className="space-y-2">
              <Label>Fecha de Solicitud</Label>
              <div className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {formData.fecha_solicitud
                  ? new Date(formData.fecha_solicitud + "T00:00:00").toLocaleDateString("es-AR")
                  : "—"}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de Inicio *</Label>
                <Input
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha de Fin *</Label>
                <Input
                  id="fecha_fin"
                  name="fecha_fin"
                  type="date"
                  value={formData.fecha_fin}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Fechas de ejecución */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fechas reales de ejecución</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 bg-transparent h-7 text-xs"
                  disabled={
                    fechasEjecucion.length >= 3 ||
                    !fechasEjecucion[fechasEjecucion.length - 1].fecha_inicio ||
                    !fechasEjecucion[fechasEjecucion.length - 1].fecha_fin
                  }
                  onClick={() =>
                    setFechasEjecucion((prev) => [
                      ...prev,
                      { fecha_inicio: "", fecha_fin: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" />
                  Agregar período
                </Button>
              </div>
              {fechasEjecucion.map((fecha, idx) => (
                <div key={idx} className="grid gap-3 md:grid-cols-2 items-end">
                  <div className="space-y-2">
                    <Label
                      htmlFor={`fe_inicio_${idx}`}
                      className="text-xs text-muted-foreground"
                    >
                      Fecha Desde {idx + 1}
                    </Label>
                    <Input
                      id={`fe_inicio_${idx}`}
                      type="date"
                      value={fecha.fecha_inicio}
                      min={formData.fecha_inicio || undefined}
                      max={formData.fecha_fin || undefined}
                      onChange={(e) =>
                        setFechasEjecucion((prev) =>
                          prev.map((f, i) =>
                            i === idx
                              ? { ...f, fecha_inicio: e.target.value }
                              : f,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`fe_fin_${idx}`}
                      className="text-xs text-muted-foreground"
                    >
                      Fecha Hasta {idx + 1}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`fe_fin_${idx}`}
                        type="date"
                        value={fecha.fecha_fin}
                        min={
                          fecha.fecha_inicio ||
                          formData.fecha_inicio ||
                          undefined
                        }
                        max={formData.fecha_fin || undefined}
                        onChange={(e) =>
                          setFechasEjecucion((prev) =>
                            prev.map((f, i) =>
                              i === idx
                                ? { ...f, fecha_fin: e.target.value }
                                : f,
                            ),
                          )
                        }
                      />
                      {fechasEjecucion.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setFechasEjecucion((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Organización */}
            <div className="space-y-2">
              <Label htmlFor="organizacion_id">Organización</Label>
              <Combobox
                id="organizacion_id"
                value={formData.organizacion_id}
                onSelect={(val) => setFormData((prev) => ({ ...prev, organizacion_id: val }))}
                options={organizaciones.map((org) => ({ label: `${org.nombre} (${org.tipo})`, value: org.id }))}
                placeholder="Sin organización"
                searchPlaceholder="Buscar organización..."
                emptyText="No se encontraron organizaciones."
              />
            </div>

            {/* Casa de Retiro */}
            <div className="space-y-2">
              <Label htmlFor="casa_retiro_id">Casa de Retiro</Label>
              <Combobox
                id="casa_retiro_id"
                value={formData.casa_retiro_id}
                onSelect={(val) => setFormData((prev) => ({ ...prev, casa_retiro_id: val }))}
                options={casasRetiro.map((c) => ({ label: c.nombre, value: c.id }))}
                placeholder="Sin casa de retiro"
                searchPlaceholder="Buscar casa de retiro..."
                emptyText="No se encontraron casas de retiro."
              />
            </div>

            {/* Cupo y Precios */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cupo_maximo">Cupo Máximo</Label>
                <Input
                  id="cupo_maximo"
                  name="cupo_maximo"
                  type="number"
                  min="1"
                  value={formData.cupo_maximo}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio">Valor de Inscripción</Label>
                <Input
                  id="precio"
                  name="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.precio}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pension">Valor de Pensión</Label>
                <Input
                  id="pension"
                  name="pension"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.pension}
                  onChange={handleChange}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              La landing pública del evento solo cobra el precio de inscripción. La pensión se registra y valida desde Pagos.
            </p>

            {/* Audiencia y Modalidad */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="audiencia">Audiencia</Label>
                <select
                  id="audiencia"
                  name="audiencia"
                  value={formData.audiencia}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="cerrado">Cerrado</option>
                  <option value="abierto">Abierto</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modalidad">Modalidad</Label>
                <select
                  id="modalidad"
                  name="modalidad"
                  value={formData.modalidad}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="bimodal">Bimodal</option>
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                name="descripcion"
                placeholder="Descripción del evento..."
                value={formData.descripcion}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm min-h-20"
              />
            </div>

            {/* Link de pago Mercado Pago — OCULTO: quedó obsoleto/en desuso. El cobro va por la
                cuenta de Mercado Pago conectada de la organización, no por un link manual.
                El campo link_pago_mercadopago se sigue leyendo/guardando para no romper datos
                existentes, pero ya no se edita desde la UI. */}
            {/* <div className="space-y-2">
              <Label htmlFor="link_pago_mercadopago">Link de Pago Mercado Pago</Label>
              <Input
                id="link_pago_mercadopago"
                name="link_pago_mercadopago"
                type="url"
                placeholder="https://mpago.la/..."
                value={formData.link_pago_mercadopago}
                onChange={handleChange}
              />
              <p className="text-xs text-muted-foreground">
                Link para que los participantes realicen la preinscripción. Se mostrará en la página del evento.
              </p>
            </div> */}

            {/* Ubicación */}
            <LocationFields
              pais={formData.pais_evento}
              provincia={formData.provincia_evento}
              localidad={formData.ciudad}
              codigoPostal={formData.codigo_postal}
              diocesis={formData.diocesis}
              onPaisChange={(val) =>
                setFormData((prev) => ({ ...prev, pais_evento: val }))
              }
              onProvinciaChange={(val) =>
                setFormData((prev) => ({ ...prev, provincia_evento: val }))
              }
              onLocalidadChange={(val) =>
                setFormData((prev) => ({ ...prev, ciudad: val }))
              }
              onCodigoPostalChange={(val) =>
                setFormData((prev) => ({ ...prev, codigo_postal: val }))
              }
              onDiocesisChange={(val) =>
                setFormData((prev) => ({ ...prev, diocesis: val }))
              }
            />

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Link href="/eventos">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                >
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <FlyerUploadPanel
          eventoId={id}
          flyerHorizontalUrl={flyerUrls.horizontal}
          flyerCuadradoUrl={flyerUrls.cuadrado}
        />
      )}
    </div>
  )
}

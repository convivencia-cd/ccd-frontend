"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { ArrowLeft, Eye, EyeOff, Paperclip, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LocationFields } from "@/components/location-fields"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { PersonaCombobox } from "@/components/persona-combobox"
import { cn } from "@/lib/utils"

interface Organizacion {
  id: string
  nombre: string
  tipo: string
}

interface Ministerio {
  id: string
  nombre: string
  tipo: string
}

interface Evento {
  id: string
  nombre: string
  tipo: string
}

const NIVELES_ESTUDIOS = [
  { value: "primario", label: "Primario" },
  { value: "secundario", label: "Secundario" },
  { value: "terciario", label: "Terciario" },
  { value: "universitario", label: "Universitario" },
  { value: "posgrado_doctorado", label: "Posgrado / Doctorado" },
]

const TIPOS_PERSONA = [
  { value: "cecista", label: "Cecista" },
  { value: "no_cecista", label: "No Cecista" },
  { value: "otro", label: "Otro" },
]

export default function NewPersonaPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [ministerios, setMinisterios] = useState<Ministerio[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [crearAcceso, setCrearAcceso] = useState(false)
  const [passwordInicial, setPasswordInicial] = useState("")
  const [confirmarPassword, setConfirmarPassword] = useState("")
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [incluirAsignacion, setIncluirAsignacion] = useState(false)
  // Solo Enlaces/Delegados/Responsables/Tesoreros/Timonel pueden tildar
  // "Socio Activo" — ver app/api/personas/me/socio-activo/route.ts
  const [canEditSocioActivo, setCanEditSocioActivo] = useState(false)
  const [asignacion, setAsignacion] = useState({
    ministerio_id: "",
    organizacion_id: "",
    evento_id: "",
    fecha_inicio: new Date().toISOString().split("T")[0],
    notas: "",
  })

  const [formData, setFormData] = useState({
    nombre_usuario: "",
    nombre: "",
    apellido: "",
    email: "",
    email_ccd: "",
    telefono: "",
    tipo_documento: "",
    documento: "",
    fecha_nacimiento: "",
    direccion: "",
    direccion_nro: "",
    localidad: "",
    codigo_postal: "",
    provincia: "",
    pais: "Argentina",
    acepta_comunicaciones: true,
    confraternidad_id: "",
    fraternidad_id: "",
    modo_inicial: "",
    estado_eclesial: "laico",
    estado_vida: "",
    diocesis: "",
    tipo_persona: "",
    parroquia: "",
    socio_asociacion: false,
    referente_comunidad: false,
    cecista_dedicado: false,
    intercesor_dies_natalis: "",
    nivel_estudios: "",
    anio_ingreso: "",
    acompanante_id: "",
  })

  const [modoAdjunto, setModoAdjunto] = useState<File | null>(null)

  useEffect(() => {
    const load = async () => {
      const [
        { data: orgsData },
        { data: ministeriosData },
        { data: eventosData },
      ] = await Promise.all([
        supabase
          .from("organizaciones")
          .select("id, nombre, tipo")
          .eq("estado", "activa")
          .order("nombre"),
        supabase
          .from("ministerios")
          .select("id, nombre, tipo")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("eventos").select("id, nombre, tipo").order("nombre"),
      ])
      if (orgsData) setOrganizaciones(orgsData)
      if (ministeriosData) setMinisterios(ministeriosData)
      if (eventosData) setEventos(eventosData)
    }
    load()
    fetch('/api/personas/me/socio-activo')
      .then(res => res.json())
      .then(json => setCanEditSocioActivo(!!json.canEdit))
      .catch(() => setCanEditSocioActivo(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!formData.documento)
        throw new Error("El número de documento es requerido")
      if (crearAcceso && !formData.nombre_usuario)
        throw new Error(
          "El nombre de usuario es requerido para crear el acceso al sistema",
        )
      if (crearAcceso && passwordInicial.length < 8)
        throw new Error(
          "La contraseña inicial debe tener al menos 8 caracteres",
        )
      if (crearAcceso && passwordInicial !== confirmarPassword)
        throw new Error("Las contraseñas no coinciden")
      if (incluirAsignacion && !asignacion.ministerio_id)
        throw new Error("Seleccioná un ministerio para la asignación")

      let documentoUrlModo: string | null = null
      if (formData.modo_inicial && modoAdjunto) {
        const ext = modoAdjunto.name.split(".").pop()
        const path = `modos/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("asignaciones-adjuntos")
          .upload(path, modoAdjunto)
        if (uploadError) throw new Error("Error al subir el adjunto: " + uploadError.message)
        const { data: urlData } = supabase.storage.from("asignaciones-adjuntos").getPublicUrl(path)
        documentoUrlModo = urlData.publicUrl
      }

      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          documento_url_modo: documentoUrlModo,
        }),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json()
        throw new Error(apiError ?? "Error al crear la persona")
      }

      const { id: personaId } = await res.json()

      // Create org relationships for cecista
      const today = new Date().toISOString().split("T")[0]
      if (formData.tipo_persona === "cecista") {
        const orgInserts = []
        if (formData.confraternidad_id) {
          orgInserts.push({
            persona_id: personaId,
            organizacion_id: formData.confraternidad_id,
            tipo_relacion: "confraternidad",
            fecha_inicio: today,
          })
        }
        if (formData.fraternidad_id) {
          orgInserts.push({
            persona_id: personaId,
            organizacion_id: formData.fraternidad_id,
            tipo_relacion: "fraternidad",
            fecha_inicio: today,
          })
        }
        if (orgInserts.length > 0) {
          await supabase.from("persona_organizacion").insert(orgInserts)
        }
      }

      // Create system access if requested
      if (crearAcceso && formData.nombre_usuario) {
        const inviteRes = await fetch("/api/personas/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre_usuario: formData.nombre_usuario,
            persona_id: personaId,
            password: passwordInicial,
          }),
        })
        if (!inviteRes.ok) {
          const { error: inviteError } = await inviteRes.json()
          throw new Error(
            `Persona creada, pero no se pudo crear el acceso: ${inviteError}`,
          )
        }
      }

      // Create ministry assignment if requested
      if (crearAcceso && incluirAsignacion && asignacion.ministerio_id) {
        const { error: asigError } = await supabase
          .from("asignaciones_ministerio")
          .insert({
            persona_id: personaId,
            ministerio_id: asignacion.ministerio_id,
            organizacion_id: asignacion.organizacion_id || null,
            evento_id: asignacion.evento_id || null,
            fecha_inicio: asignacion.fecha_inicio,
            notas: asignacion.notas || null,
            estado: "activo",
          })
        if (asigError)
          throw new Error(
            `Persona creada, pero no se pudo guardar la asignación: ${asigError.message}`,
          )
      }

      router.push("/personas")
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al crear la persona"
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
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const confraternidadOptions = useMemo<ComboboxOption[]>(
    () =>
      organizaciones
        .filter((o) => o.tipo === "confraternidad")
        .map((o) => ({ label: o.nombre, value: o.id })),
    [organizaciones],
  )
  const fraternidadOptions = useMemo<ComboboxOption[]>(
    () =>
      organizaciones
        .filter((o) => o.tipo === "fraternidad")
        .map((o) => ({ label: o.nombre, value: o.id })),
    [organizaciones],
  )
  const organizacionOptions = useMemo<ComboboxOption[]>(
    () => organizaciones.map((o) => ({ label: o.nombre, value: o.id })),
    [organizaciones],
  )
  const ministerioOptions = useMemo<ComboboxOption[]>(
    () => ministerios.map((m) => ({ label: `${m.nombre} — ${m.tipo}`, value: m.id })),
    [ministerios],
  )
  const eventoOptions = useMemo<ComboboxOption[]>(
    () => eventos.map((ev) => ({ label: `${ev.nombre} (${ev.tipo})`, value: ev.id })),
    [eventos],
  )

  return (
    <div className="space-y-6">
      <Link
        href="/personas"
        className="inline-flex items-center gap-2 text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Personas
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Nueva Persona
        </h1>
        <p className="mt-1 text-muted-foreground">
          Completa el formulario para registrar una nueva persona en el sistema
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Datos Personales */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Datos Personales</CardTitle>
            <CardDescription>Información básica de la persona</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  placeholder="Juan"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  name="apellido"
                  placeholder="García"
                  value={formData.apellido}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  placeholder="+54 9 11 1234 5678"
                  value={formData.telefono}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Mail Personal</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="juan@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_ccd">Mail CcD</Label>
                <Input
                  id="email_ccd"
                  name="email_ccd"
                  type="email"
                  placeholder="juan@ccd.org"
                  value={formData.email_ccd}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo_documento">Tipo de Documento</Label>
                <select
                  id="tipo_documento"
                  name="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="">Seleccionar...</option>
                  <option value="dni">DNI</option>
                  <option value="pasaporte">Pasaporte</option>
                  <option value="cedula">Cédula</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documento">Nro Documento *</Label>
                <Input
                  id="documento"
                  name="documento"
                  placeholder="12345678"
                  value={formData.documento}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección Calle</Label>
                <Input
                  id="direccion"
                  name="direccion"
                  placeholder="Calle Principal"
                  value={formData.direccion}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2 w-28">
                <Label htmlFor="direccion_nro">Dirección Nro</Label>
                <Input
                  id="direccion_nro"
                  name="direccion_nro"
                  placeholder="123"
                  value={formData.direccion_nro}
                  onChange={handleChange}
                />
              </div>
            </div>

            <LocationFields
              pais={formData.pais}
              provincia={formData.provincia}
              localidad={formData.localidad}
              codigoPostal={formData.codigo_postal}
              diocesis={formData.diocesis}
              onPaisChange={(val) =>
                setFormData((prev) => ({ ...prev, pais: val }))
              }
              onProvinciaChange={(val) =>
                setFormData((prev) => ({ ...prev, provincia: val }))
              }
              onLocalidadChange={(val) =>
                setFormData((prev) => ({ ...prev, localidad: val }))
              }
              onCodigoPostalChange={(val) =>
                setFormData((prev) => ({ ...prev, codigo_postal: val }))
              }
              onDiocesisChange={(val) =>
                setFormData((prev) => ({ ...prev, diocesis: val }))
              }
              paisLabel="País de residencia"
              provinciaLabel="Provincia/Estado"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estado_eclesial">Estado Eclesiástico</Label>
                <select
                  id="estado_eclesial"
                  name="estado_eclesial"
                  value={formData.estado_eclesial}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="laico">Laico</option>
                  <option value="religioso">Religioso/a</option>
                  <option value="diacono">Diácono</option>
                  <option value="sacerdote">Sacerdote</option>
                  <option value="obispo">Obispo</option>
                  <option value="cardenal">Cardenal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parroquia">Parroquia</Label>
                <Input
                  id="parroquia"
                  name="parroquia"
                  placeholder="Ej: Parroquia San José"
                  value={formData.parroquia}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado_vida">Estado de Vida</Label>
              <select
                id="estado_vida"
                name="estado_vida"
                value={formData.estado_vida}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
              >
                <option value="">Sin especificar</option>
                <option value="soltero">Soltero/a</option>
                <option value="casado">Casado/a</option>
                <option value="viudo">Viudo/a</option>
                <option value="separado">Separado/a</option>
                <option value="consagrado">Consagrado/a</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nivel_estudios">Máx. Nivel de Estudios</Label>
                <select
                  id="nivel_estudios"
                  name="nivel_estudios"
                  value={formData.nivel_estudios}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="">Sin especificar</option>
                  {NIVELES_ESTUDIOS.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="anio_ingreso">Año de Ingreso</Label>
                <Input
                  id="anio_ingreso"
                  name="anio_ingreso"
                  type="number"
                  min="1950"
                  max={new Date().getFullYear()}
                  placeholder="Ej: 2010"
                  value={formData.anio_ingreso}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acompanante_id">Acompañante</Label>
              <PersonaCombobox
                id="acompanante_id"
                value={formData.acompanante_id}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, acompanante_id: val }))
                }
                placeholder="Sin acompañante"
              />
            </div>
          </CardContent>
        </Card>

        {/* Relación con CcD */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Relación con CcD</CardTitle>
            <CardDescription>
              Tipo de vínculo con la comunidad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo_persona">Categoría</Label>
                <select
                  id="tipo_persona"
                  name="tipo_persona"
                  value={formData.tipo_persona}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="">Sin especificar</option>
                  {TIPOS_PERSONA.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-4 md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="referente_comunidad"
                    name="referente_comunidad"
                    type="checkbox"
                    checked={formData.referente_comunidad}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="referente_comunidad">
                    Referente de Comunidad
                  </Label>
                </div>
                <div className={cn('space-y-1', !canEditSocioActivo && 'rounded-md bg-muted p-3')}>
                  <div className="flex items-center gap-2">
                    <input
                      id="socio_asociacion"
                      name="socio_asociacion"
                      type="checkbox"
                      checked={formData.socio_asociacion}
                      onChange={handleChange}
                      disabled={!canEditSocioActivo}
                      className="h-4 w-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <Label htmlFor="socio_asociacion" className={cn(!canEditSocioActivo && 'text-muted-foreground')}>
                      Socio Activo
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {formData.tipo_persona === "cecista" && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    id="cecista_dedicado"
                    name="cecista_dedicado"
                    type="checkbox"
                    checked={formData.cecista_dedicado}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="cecista_dedicado">Dedicado</Label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="confraternidad_id">Confraternidad</Label>
                    <Combobox
                      id="confraternidad_id"
                      value={formData.confraternidad_id}
                      onSelect={(val) =>
                        setFormData((prev) => ({ ...prev, confraternidad_id: val }))
                      }
                      options={confraternidadOptions}
                      placeholder="Sin confraternidad"
                      searchPlaceholder="Buscar confraternidad..."
                      emptyText="No se encontraron confraternidades."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fraternidad_id">Fraternidad</Label>
                    <Combobox
                      id="fraternidad_id"
                      value={formData.fraternidad_id}
                      onSelect={(val) =>
                        setFormData((prev) => ({ ...prev, fraternidad_id: val }))
                      }
                      options={fraternidadOptions}
                      placeholder="Sin fraternidad"
                      searchPlaceholder="Buscar fraternidad..."
                      emptyText="No se encontraron fraternidades."
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="modo_inicial">Modo de Participación</Label>
              <select
                id="modo_inicial"
                name="modo_inicial"
                value={formData.modo_inicial}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
              >
                <option value="">Sin asignar</option>
                <option value="colaborador">Colaborador</option>
                <option value="servidor">Servidor</option>
                <option value="asesor">Asesor</option>
                <option value="familiar">Familiar</option>
                <option value="orante">Orante</option>
                <option value="intercesor">Intercesor</option>
              </select>
            </div>

            {formData.modo_inicial === "intercesor" && (
              <div className="space-y-2">
                <Label htmlFor="intercesor_dies_natalis">
                  Intercesor Dies Natalis
                </Label>
                <Input
                  id="intercesor_dies_natalis"
                  name="intercesor_dies_natalis"
                  type="date"
                  value={formData.intercesor_dies_natalis}
                  onChange={handleChange}
                  className="w-48"
                />
              </div>
            )}

            {formData.modo_inicial && (
              <div className="space-y-2">
                <Label>Adjunto (opcional)</Label>
                {modoAdjunto ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{modoAdjunto.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(modoAdjunto.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModoAdjunto(null)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="modo_adjunto"
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted/70 hover:text-foreground"
                  >
                    <Paperclip className="h-5 w-5" />
                    <span>Hacé clic para seleccionar</span>
                    <span className="text-xs">PDF, Word o imagen — máx. 10 MB</span>
                    <input
                      id="modo_adjunto"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(e) => setModoAdjunto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="acepta_comunicaciones"
                name="acepta_comunicaciones"
                type="checkbox"
                checked={formData.acepta_comunicaciones}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="acepta_comunicaciones">
                Acepta recibir comunicaciones
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Acceso al Sistema */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Acceso al Sistema</CardTitle>
            <CardDescription>
              Definí el usuario y una contraseña inicial para ingresar al
              sistema. La persona deberá cambiarla en su primer acceso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="crear_acceso"
                type="checkbox"
                checked={crearAcceso}
                onChange={(e) => {
                  setCrearAcceso(e.target.checked)
                  if (!e.target.checked) {
                    setPasswordInicial("")
                    setConfirmarPassword("")
                    setMostrarPassword(false)
                    setIncluirAsignacion(false)
                  }
                }}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="crear_acceso">Crear acceso al sistema</Label>
            </div>

            {crearAcceso && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nombre_usuario">Nombre de Usuario *</Label>
                  <Input
                    id="nombre_usuario"
                    name="nombre_usuario"
                    type="text"
                    placeholder="ej: juan.garcia"
                    value={formData.nombre_usuario}
                    onChange={handleChange}
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9._-]+"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo letras minúsculas, números, puntos y guiones bajos.
                    3–30 caracteres.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password_inicial">
                      Contraseña inicial *
                    </Label>
                    <div className="relative">
                      <Input
                        id="password_inicial"
                        type={mostrarPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={passwordInicial}
                        onChange={(e) => setPasswordInicial(e.target.value)}
                        minLength={8}
                        required
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword((actual) => !actual)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          mostrarPassword
                            ? "Ocultar contraseñas"
                            : "Mostrar contraseñas"
                        }
                      >
                        {mostrarPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Debe tener al menos 8 caracteres.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmar_password">
                      Confirmar contraseña *
                    </Label>
                    <Input
                      id="confirmar_password"
                      type={mostrarPassword ? "text" : "password"}
                      placeholder="Repetí la contraseña"
                      value={confirmarPassword}
                      onChange={(e) => setConfirmarPassword(e.target.value)}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="incluir_asignacion"
                      type="checkbox"
                      checked={incluirAsignacion}
                      onChange={(e) => setIncluirAsignacion(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="incluir_asignacion">
                      Agregar asignación de Rol
                    </Label>
                  </div>

                  {incluirAsignacion && (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="asig_ministerio_id">Rol *</Label>
                          <Combobox
                            id="asig_ministerio_id"
                            value={asignacion.ministerio_id}
                            onSelect={(val) =>
                              setAsignacion((a) => ({
                                ...a,
                                ministerio_id: val,
                              }))
                            }
                            options={ministerioOptions}
                            placeholder="Seleccionar rol..."
                            searchPlaceholder="Buscar rol..."
                            emptyText="No se encontraron roles."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="asig_organizacion_id">
                            Organización
                          </Label>
                          <Combobox
                            id="asig_organizacion_id"
                            value={asignacion.organizacion_id}
                            onSelect={(val) =>
                              setAsignacion((a) => ({
                                ...a,
                                organizacion_id: val,
                              }))
                            }
                            options={organizacionOptions}
                            placeholder="Global (sin restricción)"
                            searchPlaceholder="Buscar organización..."
                            emptyText="No se encontraron organizaciones."
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="asig_evento_id">
                          Retiro (opcional)
                        </Label>
                        <Combobox
                          id="asig_evento_id"
                          value={asignacion.evento_id}
                          onSelect={(val) =>
                            setAsignacion((a) => ({
                              ...a,
                              evento_id: val,
                            }))
                          }
                          options={eventoOptions}
                          placeholder="Sin retiro específico"
                          searchPlaceholder="Buscar retiro..."
                          emptyText="No se encontraron retiros."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="asig_fecha_inicio">
                          Fecha de inicio
                        </Label>
                        <Input
                          id="asig_fecha_inicio"
                          type="date"
                          value={asignacion.fecha_inicio}
                          onChange={(e) =>
                            setAsignacion((a) => ({
                              ...a,
                              fecha_inicio: e.target.value,
                            }))
                          }
                          className="w-48"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="asig_notas">Notas (opcional)</Label>
                        <textarea
                          id="asig_notas"
                          rows={3}
                          placeholder="Observaciones sobre esta asignación..."
                          value={asignacion.notas}
                          onChange={(e) =>
                            setAsignacion((a) => ({
                              ...a,
                              notas: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Crear Persona"}
          </Button>
          <Link href="/personas">
            <Button type="button" variant="outline" className="bg-transparent">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

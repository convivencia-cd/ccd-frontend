"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { formatDateAR } from "@/lib/utils"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import MercadoPagoPanel from "./_components/mercadopago-panel"
import { DiocesisCombobox } from "@/components/diocesis-field"
import { Combobox } from "@/components/ui/combobox"

type OrgOption = { id: string; nombre: string; tipo: string }
type OrgDependiente = { id: string; nombre: string; tipo: string }
type Asignacion = {
  id: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  persona: { nombre: string; apellido: string } | null
  ministerio: { nombre: string } | null
  evento: { nombre: string } | null
}

const tipoLabel: Record<string, string> = {
  comunidad: "Comunidad",
  confraternidad: "Confraternidad",
  fraternidad: "Fraternidad",
  // casa_retiro: 'Casa de Retiro',
  // eqt: 'EQT',
  otra: "Otra",
}

export default function EditarOrganizacionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [orgsParent, setOrgsParent] = useState<OrgOption[]>([])
  const [orgsDependientes, setOrgsDependientes] = useState<OrgDependiente[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "fraternidad",
    codigo: "",
    parent_id: "",
    estado: "activa",
    mail_org: "",
    sede_fisica: false,
    direccion_calle: "",
    direccion_nro: "",
    ciudad: "",
    cp: "",
    diocesis: "",
    localidad: "",
    provincia: "",
    pais: "Argentina",
    notas: "",
    telefono_1: "",
    telefono_2: "",
    pago_alias: "",
    pago_cbu: "",
    pago_titular: "",
    pago_banco: "",
    pago_instrucciones: "",
  })

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase
        .from("organizaciones")
        .select(
          "id, nombre, tipo, codigo, parent_id, estado, mail_org, sede_fisica, direccion_calle, direccion_nro, ciudad, cp, diocesis, localidad, provincia, pais, notas, telefono_1, telefono_2, pago_alias, pago_cbu, pago_titular, pago_banco, pago_instrucciones",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("organizaciones")
        .select("id, nombre, tipo")
        .is("fecha_baja", null)
        .neq("id", id)
        .order("nombre"),
      supabase
        .from("organizaciones")
        .select("id, nombre, tipo")
        .eq("parent_id", id)
        .is("fecha_baja", null)
        .order("nombre"),
      supabase
        .from("asignaciones_ministerio")
        .select(
          "id, estado, fecha_inicio, fecha_fin, persona:personas!persona_id(nombre, apellido), ministerio:ministerios!ministerio_id(nombre), evento:eventos!evento_id(nombre)",
        )
        .eq("organizacion_id", id)
        .eq("estado", "activo")
        .order("fecha_inicio"),
    ]).then(
      ([
        { data: org, error: orgError },
        { data: parents },
        { data: dependientes },
        { data: asig },
      ]) => {
        if (orgError || !org) {
          setError("No se encontró la organización")
          setLoadingData(false)
          return
        }
        setFormData({
          nombre: org.nombre ?? "",
          tipo: org.tipo ?? "fraternidad",
          codigo: org.codigo ?? "",
          parent_id: org.parent_id ?? "",
          estado: org.estado ?? "activa",
          mail_org: org.mail_org ?? "",
          sede_fisica: org.sede_fisica ?? false,
          direccion_calle: org.direccion_calle ?? "",
          direccion_nro: org.direccion_nro ?? "",
          ciudad: org.ciudad ?? "",
          cp: org.cp ?? "",
          diocesis: org.diocesis ?? "",
          localidad: org.localidad ?? "",
          provincia: org.provincia ?? "",
          pais: org.pais ?? "Argentina",
          notas: org.notas ?? "",
          telefono_1: org.telefono_1 ?? "",
          telefono_2: org.telefono_2 ?? "",
          pago_alias: org.pago_alias ?? "",
          pago_cbu: org.pago_cbu ?? "",
          pago_titular: org.pago_titular ?? "",
          pago_banco: org.pago_banco ?? "",
          pago_instrucciones: org.pago_instrucciones ?? "",
        })
        if (parents) setOrgsParent(parents as OrgOption[])
        if (dependientes) setOrgsDependientes(dependientes as OrgDependiente[])
        if (asig) setAsignaciones(asig as unknown as Asignacion[])
        setLoadingData(false)
      },
    )
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/organizaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json()
        throw new Error(apiError ?? "Error al actualizar la organización")
      }

      router.push(`/organizaciones/${id}`)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al actualizar la organización"
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
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Cargando organización...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/organizaciones/${id}`}
        className="inline-flex items-center gap-2 text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la Confraternidad / Fraternidad
      </Link>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Editar Confraternidad / Fraternidad</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Nombre + Código */}
            <div className="grid grid-cols-[1fr_160px] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">
                  Nombre{" "}
                  <span className="text-muted-foreground text-xs">
                    (50 caracteres)
                  </span>
                </Label>
                <Input
                  id="nombre"
                  name="nombre"
                  placeholder="Fraternidad San José"
                  maxLength={50}
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo">
                  Código Interno{" "}
                  <span className="text-muted-foreground text-xs">
                    3 letras + 3 nros
                  </span>
                </Label>
                <Input
                  id="codigo"
                  name="codigo"
                  placeholder="FRA001"
                  value={formData.codigo}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo *</Label>
              <select
                id="tipo"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
              >
                {Object.entries(tipoLabel).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>

            {/* Org. Padre */}
            <div className="space-y-1.5">
              <Label htmlFor="parent_id">Confraternidad / Fraternidad Padre</Label>
              <Combobox
                id="parent_id"
                value={formData.parent_id}
                onSelect={(val) => setFormData((prev) => ({ ...prev, parent_id: val }))}
                options={orgsParent.map((org) => ({ label: `${org.nombre} (${tipoLabel[org.tipo] ?? org.tipo})`, value: org.id }))}
                placeholder="Seleccionar..."
                searchPlaceholder="Buscar organización..."
                emptyText="No se encontraron organizaciones."
              />
            </div>

            {/* Estado + Mail */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mail_org">Mail</Label>
                <Input
                  id="mail_org"
                  name="mail_org"
                  type="email"
                  placeholder="fraternidad@ejemplo.org"
                  value={formData.mail_org}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Sede Física */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sede_fisica"
                name="sede_fisica"
                checked={formData.sede_fisica}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="sede_fisica" className="cursor-pointer">
                Sede Física
              </Label>
            </div>

            {/* Dirección (condicional) */}
            {formData.sede_fisica && (
              <div className="space-y-4 rounded-md border border-border p-4">
                <div className="grid grid-cols-[1fr_120px] gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="direccion_calle">Dirección Calle</Label>
                    <Input
                      id="direccion_calle"
                      name="direccion_calle"
                      placeholder="Av. San Martín"
                      value={formData.direccion_calle}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="direccion_nro">Dirección Nro</Label>
                    <Input
                      id="direccion_nro"
                      name="direccion_nro"
                      placeholder="1234"
                      value={formData.direccion_nro}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      name="ciudad"
                      placeholder="Corrientes"
                      value={formData.ciudad}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp">CP</Label>
                    <Input
                      id="cp"
                      name="cp"
                      placeholder="3400"
                      value={formData.cp}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="diocesis">Diócesis</Label>
                  <DiocesisCombobox
                    value={formData.diocesis}
                    onChange={(val) => setFormData((prev) => ({ ...prev, diocesis: val }))}
                    pais={formData.pais}
                    provincia={formData.provincia}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="provincia">Provincia</Label>
                    <Input
                      id="provincia"
                      name="provincia"
                      placeholder="Corrientes"
                      value={formData.provincia}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pais">País</Label>
                    <Input
                      id="pais"
                      name="pais"
                      placeholder="Argentina"
                      value={formData.pais}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Localidad / Provincia / País (si no hay sede física) */}
            {!formData.sede_fisica && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="localidad">Localidad</Label>
                  <Input
                    id="localidad"
                    name="localidad"
                    placeholder="Corrientes"
                    value={formData.localidad}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    name="provincia"
                    placeholder="Corrientes"
                    value={formData.provincia}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pais">País</Label>
                  <Input
                    id="pais"
                    name="pais"
                    placeholder="Argentina"
                    value={formData.pais}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="notas">Notas</Label>
              <textarea
                id="notas"
                name="notas"
                placeholder="Información adicional..."
                value={formData.notas}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm min-h-20"
              />
            </div>

            {/* Datos para transferencias */}
            <div className="space-y-4 rounded-md border border-border p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Datos para transferencias</p>
                <p className="text-xs text-muted-foreground">
                  Se muestran a los interesados para que paguen la seña de inscripción de los retiros de esta confraternidad / fraternidad.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pago_alias">Alias</Label>
                  <Input
                    id="pago_alias"
                    name="pago_alias"
                    placeholder="convivencia.sanjose"
                    value={formData.pago_alias}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pago_cbu">CBU / CVU</Label>
                  <Input
                    id="pago_cbu"
                    name="pago_cbu"
                    placeholder="0000003100000000000000"
                    value={formData.pago_cbu}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pago_titular">Titular</Label>
                  <Input
                    id="pago_titular"
                    name="pago_titular"
                    placeholder="Asociación Civil ..."
                    value={formData.pago_titular}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pago_banco">Banco</Label>
                  <Input
                    id="pago_banco"
                    name="pago_banco"
                    placeholder="Banco Nación"
                    value={formData.pago_banco}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pago_instrucciones">Instrucciones adicionales</Label>
                <textarea
                  id="pago_instrucciones"
                  name="pago_instrucciones"
                  placeholder="Ej: enviar el comprobante por WhatsApp al ..."
                  value={formData.pago_instrucciones}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm min-h-20"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Link href={`/organizaciones/${id}`}>
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

      <MercadoPagoPanel organizacionId={id} />

      {/* Organizaciones Dependientes */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Confraternidades o Fraternidades Relacionadas (Org. Dependientes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orgsDependientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin confraternidades / fraternidades dependientes
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">
                    Nombre
                  </th>
                </tr>
              </thead>
              <tbody>
                {orgsDependientes.map((dep) => (
                  <tr
                    key={dep.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2">
                      <Link
                        href={`/organizaciones/${dep.id}`}
                        className="text-primary hover:underline"
                      >
                        {dep.nombre}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Roles y Ministerios */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Roles y Ministerios de la Confraternidad / Fraternidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asignaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin asignaciones activas
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Persona
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Rol
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Retiro
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Inicio
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Fin
                  </th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((asig) => (
                  <tr
                    key={asig.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 px-3 font-medium">
                      {asig.persona
                        ? `${asig.persona.apellido}, ${asig.persona.nombre}`
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {asig.ministerio?.nombre ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {asig.evento?.nombre ?? "—"}
                    </td>
                    <td className="py-2 px-3 capitalize">{asig.estado}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {asig.fecha_inicio
                        ? formatDateAR(asig.fecha_inicio)
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {asig.fecha_fin ? formatDateAR(asig.fecha_fin) : "—"}
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

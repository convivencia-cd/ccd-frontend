"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Combobox } from "@/components/ui/combobox"

type OrgOption = { id: string; nombre: string; tipo: string }

export default function NewRetiroAdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizaciones, setOrganizaciones] = useState<OrgOption[]>([])
  const [casasRetiro, setCasasRetiro] = useState<OrgOption[]>([])

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    cupo_maximo: "",
    precio: "",
    organizacion_id: "",
    casa_retiro_id: "",
    estado: "borrador",
    audiencia: "cerrado",
    modalidad: "presencial",
    notas: "",
  })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("organizaciones")
      .select("id, nombre, tipo")
      .is("fecha_baja", null)
      .order("nombre")
      .then(({ data }) => {
        if (data) {
          setOrganizaciones(data.filter(o => o.tipo !== "casa_retiro"))
          setCasasRetiro(data.filter(o => o.tipo === "casa_retiro"))
        }
      })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    const insertData: Record<string, unknown> = {
      nombre: formData.nombre,
      tipo: "retiro",
      fecha_inicio: formData.fecha_inicio,
      fecha_fin: formData.fecha_fin,
      estado: formData.estado,
      audiencia: formData.audiencia,
      modalidad: formData.modalidad,
    }
    if (formData.descripcion) insertData.descripcion = formData.descripcion
    if (formData.cupo_maximo) insertData.cupo_maximo = parseInt(formData.cupo_maximo)
    if (formData.precio) insertData.precio = parseFloat(formData.precio)
    if (formData.organizacion_id) insertData.organizacion_id = formData.organizacion_id
    if (formData.casa_retiro_id) insertData.casa_retiro_id = formData.casa_retiro_id
    if (formData.notas) insertData.notas = formData.notas

    const { error: insertError } = await supabase.from("eventos").insert(insertData)

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    router.push("/admin/retiros")
    router.refresh()
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href="/admin/retiros" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a Retiros
        </Link>
      </div>

      <Card className="mx-auto max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Crear Nuevo Retiro</CardTitle>
          <CardDescription>Completa la información del retiro</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Retiro *</Label>
              <Input
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                name="descripcion"
                rows={4}
                value={formData.descripcion}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de Inicio *</Label>
                <Input
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cupo_maximo">Cupo Máximo</Label>
                <Input
                  id="cupo_maximo"
                  name="cupo_maximo"
                  type="number"
                  min="1"
                  value={formData.cupo_maximo}
                  onChange={handleChange}
                  disabled={isLoading}
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
                  value={formData.precio}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizacion_id">Organización</Label>
              <Combobox
                id="organizacion_id"
                value={formData.organizacion_id}
                onSelect={val => setFormData(prev => ({ ...prev, organizacion_id: val }))}
                disabled={isLoading}
                options={organizaciones.map(o => ({ label: `${o.nombre} (${o.tipo})`, value: o.id }))}
                placeholder="Sin organización"
                searchPlaceholder="Buscar organización..."
                emptyText="No se encontraron organizaciones."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="casa_retiro_id">Casa de Retiro</Label>
              <Combobox
                id="casa_retiro_id"
                value={formData.casa_retiro_id}
                onSelect={val => setFormData(prev => ({ ...prev, casa_retiro_id: val }))}
                disabled={isLoading}
                options={casasRetiro.map(c => ({ label: c.nombre, value: c.id }))}
                placeholder="Sin casa de retiro"
                searchPlaceholder="Buscar casa de retiro..."
                emptyText="No se encontraron casas de retiro."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="borrador">Borrador</option>
                  <option value="solicitado">Solicitado</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="publicado">Publicado</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audiencia">Audiencia</Label>
                <select
                  id="audiencia"
                  name="audiencia"
                  value={formData.audiencia}
                  onChange={handleChange}
                  disabled={isLoading}
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
                  disabled={isLoading}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="bimodal">Bimodal</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear Retiro"
                )}
              </Button>
              <Link href="/admin/retiros">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

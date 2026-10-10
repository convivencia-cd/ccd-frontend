"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Briefcase, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

interface Permiso {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  categoria: string
}

const categoriaLabel: Record<string, string> = {
  personas: "Personas",
  organizaciones: "Organizaciones",
  eventos: "Retiros",
  tipos_eventos: "Tipos de Retiros",
  roles: "Roles",
  sistema: "Sistema",
}

export default function NuevoMinisterioPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: "",
    codigo_interno: "",
    tipo: "pastoral",
    nivel: "fraternidad",
    requiere_acta: false,
  })
  const [tipoPersonalizado, setTipoPersonalizado] = useState("")

  // Permisos disponibles cargados al montar
  const [permisosPorCategoria, setPermisosPorCategoria] = useState<
    Record<string, Permiso[]>
  >({})
  const [totalPermisos, setTotalPermisos] = useState(0)
  const [loadingPermisos, setLoadingPermisos] = useState(true)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("permisos")
        .select("id, clave, nombre, descripcion, categoria")
        .eq("activo", true)
        .order("categoria")
        .order("nombre")

      const byCategoria: Record<string, Permiso[]> = {}
      for (const p of data ?? []) {
        if (!byCategoria[p.categoria]) byCategoria[p.categoria] = []
        byCategoria[p.categoria].push(p)
      }
      setPermisosPorCategoria(byCategoria)
      setTotalPermisos((data ?? []).length)
      setLoadingPermisos(false)
    }
    load()
  }, [])

  const togglePermiso = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCategoria = useCallback(
    (categoria: string) => {
      const ids = (permisosPorCategoria[categoria] ?? []).map((p) => p.id)
      setSeleccionados((prev) => {
        const allSelected = ids.every((id) => prev.has(id))
        const next = new Set(prev)
        if (allSelected) ids.forEach((id) => next.delete(id))
        else ids.forEach((id) => next.add(id))
        return next
      })
    },
    [permisosPorCategoria],
  )

  const nivelAcceso =
    totalPermisos === 0
      ? 0
      : Math.round((seleccionados.size / totalPermisos) * 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError("El nombre es obligatorio")
      setLoading(false)
      return
    }

    const tipoFinal =
      form.tipo === "otro"
        ? tipoPersonalizado.trim().toLowerCase().replace(/\s+/g, "_")
        : form.tipo

    if (!tipoFinal) {
      setError("Especificá el tipo de rol")
      setLoading(false)
      return
    }

    const codigoInterno = form.codigo_interno.trim() || null
    if (codigoInterno && !/^[A-Za-z0-9_-]+$/.test(codigoInterno)) {
      setError("El código interno solo puede contener letras, números, guiones y guiones bajos")
      setLoading(false)
      return
    }

    // 1. Crear el ministerio
    const { data, error: err } = await supabase
      .from("ministerios")
      .insert({
        nombre,
        codigo_interno: codigoInterno,
        tipo: tipoFinal,
        nivel: form.nivel,
        nivel_acceso: nivelAcceso,
        requiere_acta: form.requiere_acta,
        activo: true,
      })
      .select("id")
      .single()

    if (err) {
      setError(
        err.message.includes("unique")
          ? "Ya existe un rol con ese nombre"
          : "Error al crear el rol: " + err.message,
      )
      setLoading(false)
      return
    }

    // 2. Insertar permisos seleccionados
    if (seleccionados.size > 0) {
      const rows = [...seleccionados].map((permiso_id) => ({
        ministerio_id: data.id,
        permiso_id,
      }))
      await supabase.from("ministerio_permisos").insert(rows)
    }

    router.push(`/ministerios/catalogo/${data.id}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/ministerios/catalogo"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Listado de Roles
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-8 w-8 text-primary" />
          Nuevo Rol
        </h1>
        <p className="mt-2 text-muted-foreground">
          Define los datos y permisos del rol. Todo se guarda al hacer clic en
          Crear.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fila superior: datos básicos en horizontal */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Datos del Rol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-6 items-start">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  required
                  placeholder="ej: Coordinador de Zona"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                />
              </div>

              {/* Código Interno */}
              <div className="space-y-2">
                <Label htmlFor="codigo_interno">Código Interno *</Label>
                <Input
                  id="codigo_interno"
                  required
                  placeholder="ej: COORD-ZONA"
                  value={form.codigo_interno}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codigo_interno: e.target.value }))
                  }
                  pattern="[A-Za-z0-9_\-]+"
                />
                <p className="text-xs text-muted-foreground">Alfanumérico. Inmutable al guardar.</p>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Rol *</Label>
                <select
                  id="tipo"
                  required
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="conduccion">Conducción</option>
                  <option value="pastoral">Pastoral</option>
                  <option value="servicio">De Servicio</option>
                  <option value="sistema">Sistema (acceso técnico)</option>
                  <option value="otro">Otro</option>
                </select>
                {form.tipo === "otro" && (
                  <Input
                    placeholder="ej: Formación"
                    value={tipoPersonalizado}
                    onChange={(e) => setTipoPersonalizado(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Nivel */}
              <div className="space-y-2">
                <Label htmlFor="nivel">Nivel organizacional *</Label>
                <select
                  id="nivel"
                  required
                  value={form.nivel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nivel: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="comunidad">Comunidad</option>
                  <option value="confraternidad">Confraternidad</option>
                  <option value="fraternidad">Fraternidad</option>
                  <option value="evento">Retiro</option>
                </select>
              </div>

              {/* Acta + nivel de acceso + botones */}
              <div className="space-y-4 lg:min-w-50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requiere_acta"
                    checked={form.requiere_acta}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        requiere_acta: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <Label htmlFor="requiere_acta" className="cursor-pointer">
                    Requiere acta de asignación
                  </Label>
                </div>

                <div className="space-y-1 pt-1 border-t border-border">
                  <Label className="text-xs">Nivel de acceso al sistema</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${nivelAcceso}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums w-8 text-right">
                      {nivelAcceso}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se calcula automáticamente según los permisos seleccionados
                  </p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creando..." : "Crear Rol"}
                  </Button>
                  <Link href="/ministerios/catalogo">
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sección inferior: permisos a ancho completo */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Permisos del Rol</CardTitle>
            <CardDescription>
              Seleccioná los permisos que tendrá este rol. El nivel de acceso
              se calcula automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPermisos ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando permisos...</span>
              </div>
            ) : Object.keys(permisosPorCategoria).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay permisos definidos. Ejecuta la migración 005.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.keys(permisosPorCategoria).map((categoria) => {
                  const ids = permisosPorCategoria[categoria].map((p) => p.id)
                  const selectedCount = ids.filter((id) =>
                    seleccionados.has(id),
                  ).length
                  const allSelected = selectedCount === ids.length
                  const someSelected = selectedCount > 0 && !allSelected
                  return (
                    <div key={categoria}>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id={`cat-${categoria}`}
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected
                          }}
                          onChange={() => toggleCategoria(categoria)}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                        <label
                          htmlFor={`cat-${categoria}`}
                          className="text-sm font-semibold text-foreground uppercase tracking-wide cursor-pointer"
                        >
                          {categoriaLabel[categoria] ?? categoria}
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pl-6">
                        {permisosPorCategoria[categoria].map((permiso) => {
                          const isActive = seleccionados.has(permiso.id)
                          return (
                            <div
                              key={permiso.id}
                              className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => togglePermiso(permiso.id)}
                            >
                              <input
                                type="checkbox"
                                id={`perm-${permiso.id}`}
                                checked={isActive}
                                onChange={() => togglePermiso(permiso.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-border accent-primary cursor-pointer mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <label
                                  htmlFor={`perm-${permiso.id}`}
                                  className="text-sm font-medium text-foreground cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {permiso.nombre}
                                </label>
                                {permiso.descripcion && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {permiso.descripcion}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                                  {permiso.clave}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

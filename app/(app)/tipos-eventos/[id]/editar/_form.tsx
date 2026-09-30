'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tag, ArrowLeft, Users, FileText, Plus, Trash2, UsersRound } from 'lucide-react'

interface Ministerio {
  id: string
  nombre: string
}

interface Pregunta {
  id: string
  texto: string
}

export default function EditarTipoEventoForm() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'convivencia',
    alcance: 'interno',
    requiere_discernimiento_confra: false,
    requiere_discernimiento_eqt: false,
    requisitos: '',
    activo: true,
  })
  const [rolesOpciones, setRolesOpciones] = useState<Ministerio[]>([])
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<string>>(new Set())
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [nombresGrupos, setNombresGrupos] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/tipos-eventos/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setFormData({
            nombre: data.nombre ?? '',
            categoria: data.categoria ?? 'convivencia',
            alcance: data.alcance ?? 'interno',
            requiere_discernimiento_confra: data.requiere_discernimiento_confra ?? false,
            requiere_discernimiento_eqt: data.requiere_discernimiento_eqt ?? false,
            requisitos: data.requisitos ?? '',
            activo: data.activo ?? true,
          })
          setPreguntas(Array.isArray(data.preguntas_informe) ? data.preguntas_informe : [])
          setNombresGrupos(
            Array.isArray(data.nombres_grupos) ? data.nombres_grupos.map((n: unknown) => String(n)) : []
          )
        }
        setLoadingData(false)
      })
      .catch(() => {
        setError('No se pudo cargar el tipo de evento')
        setLoadingData(false)
      })

    fetch(`/api/tipos-eventos/${id}/roles-solicitantes`)
      .then(res => res.json())
      .then(data => {
        setRolesOpciones(data.opciones ?? [])
        setRolesSeleccionados(new Set(data.seleccionados ?? []))
        setLoadingRoles(false)
      })
      .catch(() => setLoadingRoles(false))
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const addPregunta = () => setPreguntas(prev => [...prev, { id: crypto.randomUUID(), texto: '' }])
  const updatePregunta = (pid: string, texto: string) =>
    setPreguntas(prev => prev.map(p => (p.id === pid ? { ...p, texto } : p)))
  const removePregunta = (pid: string) => setPreguntas(prev => prev.filter(p => p.id !== pid))

  const addNombreGrupo = () => setNombresGrupos(prev => [...prev, ''])
  const updateNombreGrupo = (i: number, nombre: string) =>
    setNombresGrupos(prev => prev.map((n, idx) => (idx === i ? nombre : n)))
  const removeNombreGrupo = (i: number) => setNombresGrupos(prev => prev.filter((_, idx) => idx !== i))

  const toggleRol = (ministerioId: string) => {
    setRolesSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(ministerioId)) next.delete(ministerioId)
      else next.add(ministerioId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const [resForm, resRoles] = await Promise.all([
        fetch(`/api/tipos-eventos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            preguntas_informe: preguntas.filter(p => p.texto.trim()),
            nombres_grupos: nombresGrupos.map(n => n.trim()).filter(Boolean),
          }),
        }),
        fetch(`/api/tipos-eventos/${id}/roles-solicitantes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ministerio_ids: Array.from(rolesSeleccionados) }),
        }),
      ])

      if (!resForm.ok) {
        const { error: apiError } = await resForm.json()
        throw new Error(apiError ?? 'Error al guardar')
      }
      if (!resRoles.ok) {
        const { error: apiError } = await resRoles.json()
        throw new Error(apiError ?? 'Error al guardar roles')
      }

      router.push('/tipos-eventos')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tipos-eventos">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
        <Tag className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Editar Tipo de Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Datos del tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {error && (
                <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="nombre">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Convivencia con Dios"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="categoria">
                    Categoría <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="categoria"
                    name="categoria"
                    required
                    value={formData.categoria}
                    onChange={handleChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="convivencia">Convivencia</option>
                    <option value="retiro">Retiro</option>
                    <option value="taller">Taller</option>
                    <option value="encuentro">Encuentro</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="alcance">
                    Alcance <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="alcance"
                    name="alcance"
                    required
                    value={formData.alcance}
                    onChange={handleChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="interno">Interno</option>
                    <option value="abierto">Abierto</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Estado</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formData.activo}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Activo (disponible para elegir al crear eventos)</span>
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Discernimiento requerido</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="requiere_discernimiento_confra"
                    checked={formData.requiere_discernimiento_confra}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Requiere discernimiento Confraternidad</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="requiere_discernimiento_eqt"
                    checked={formData.requiere_discernimiento_eqt}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Requiere discernimiento Equipo Timón</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="requisitos">
                  Requisitos a considerar
                </label>
                <textarea
                  id="requisitos"
                  name="requisitos"
                  rows={4}
                  value={formData.requisitos}
                  onChange={handleChange}
                  placeholder="Descripción de requisitos o condiciones especiales..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Roles que pueden solicitar este tipo</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Solo los roles con el permiso "Solicitar eventos" están disponibles aquí.
            </p>
          </CardHeader>
          <CardContent>
            {loadingRoles ? (
              <p className="text-sm text-muted-foreground py-2">Cargando roles...</p>
            ) : rolesOpciones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay roles con el permiso "Solicitar eventos" configurado.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rolesOpciones.map((rol) => (
                  <label
                    key={rol.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={rolesSeleccionados.has(rol.id)}
                      onChange={() => toggleRol(rol.id)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <span className="text-sm font-medium">{rol.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Preguntas del Informe del Coordinador</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              El coordinador responderá estas preguntas al cerrar cada evento de este tipo.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {preguntas.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay preguntas definidas todavía.</p>
              )}
              {preguntas.map((p, i) => (
                <div key={p.id} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <textarea
                    rows={2}
                    value={p.texto}
                    onChange={e => updatePregunta(p.id, e.target.value)}
                    placeholder="Escribí la pregunta..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePregunta(p.id)}
                    className="mt-2 text-destructive hover:opacity-70"
                    title="Eliminar pregunta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addPregunta} className="gap-1">
                <Plus className="h-4 w-4" /> Agregar pregunta
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Nombres de Grupo</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              De esta lista se eligen los nombres al armar los grupos de cada evento de este tipo (ej.: Jerusalem).
              Dentro de un mismo evento cada nombre se usa una sola vez.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nombresGrupos.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay nombres de grupo definidos todavía.</p>
              )}
              {nombresGrupos.map((nombre, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                  <input
                    value={nombre}
                    onChange={e => updateNombreGrupo(i, e.target.value)}
                    placeholder="Jerusalem"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeNombreGrupo(i)}
                    className="text-destructive hover:opacity-70"
                    title="Eliminar nombre"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addNombreGrupo} className="gap-1">
                <Plus className="h-4 w-4" /> Agregar nombre
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="max-w-2xl flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          <Button asChild variant="outline">
            <Link href="/tipos-eventos">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}

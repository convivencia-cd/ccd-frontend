'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { UserCheck, ArrowLeft, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { PersonaCombobox, fetchPersonas, type PersonaOption } from '@/components/persona-combobox'
import { Combobox } from '@/components/ui/combobox'

interface Ministerio {
  id: string
  nombre: string
  tipo: string
  nivel_acceso: number
}

interface Org {
  id: string
  nombre: string
}

interface Evento {
  id: string
  nombre: string
  tipo: string
}

const tipoEventoLabel: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro corto',
  taller: 'Taller',
}

const tipoLabel: Record<string, string> = {
  conduccion: 'Conducción',
  pastoral: 'Pastoral',
  servicio: 'Servicio',
  sistema: 'Sistema',
}

const BUCKET = 'asignaciones-adjuntos'

export default function EditarAsignacionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [ministerios, setMinisterios] = useState<Ministerio[]>([])
  const [organizaciones, setOrganizaciones] = useState<Org[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    persona_id: '',
    ministerio_id: '',
    organizacion_id: '',
    evento_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'activo',
    motivo_fin: '',
    notas: '',
  })
  const [documentoUrlActual, setDocumentoUrlActual] = useState<string | null>(null)
  const [adjunto, setAdjunto] = useState<File | null>(null)

  useEffect(() => {
    const load = async () => {
      const [personasData, { data: ministeriosData }, { data: orgsData }, { data: eventosData }, { data: asignacionData }] =
        await Promise.all([
          fetchPersonas(),
          supabase.from('ministerios').select('id, nombre, tipo, nivel_acceso').eq('activo', true).order('tipo').order('nombre'),
          supabase.from('organizaciones').select('id, nombre').is('fecha_baja', null).order('nombre'),
          supabase.from('eventos').select('id, nombre, tipo').order('nombre'),
          supabase
            .from('asignaciones_ministerio')
            .select(
              'id, persona_id, ministerio_id, organizacion_id, evento_id, fecha_inicio, fecha_fin, estado, motivo_fin, notas, documento_url',
            )
            .eq('id', id)
            .single(),
        ])

      setPersonas(personasData)
      setMinisterios(ministeriosData ?? [])
      setOrganizaciones(orgsData ?? [])
      setEventos(eventosData ?? [])

      if (!asignacionData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setForm({
        persona_id: asignacionData.persona_id ?? '',
        ministerio_id: asignacionData.ministerio_id ?? '',
        organizacion_id: asignacionData.organizacion_id ?? '',
        evento_id: asignacionData.evento_id ?? '',
        fecha_inicio: asignacionData.fecha_inicio ?? '',
        fecha_fin: asignacionData.fecha_fin ?? '',
        estado: asignacionData.estado ?? 'activo',
        motivo_fin: asignacionData.motivo_fin ?? '',
        notas: asignacionData.notas ?? '',
      })
      setDocumentoUrlActual(asignacionData.documento_url ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!form.persona_id || !form.ministerio_id) {
      setError('Debes seleccionar una persona y un rol')
      setSaving(false)
      return
    }

    if (form.estado === 'inactivo' && !form.fecha_fin) {
      setError('Debes indicar una fecha de fin cuando el estado es inactivo')
      setSaving(false)
      return
    }

    let documentoUrl = documentoUrlActual
    if (adjunto) {
      const ext = adjunto.name.split('.').pop()
      const path = `${form.persona_id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, adjunto)
      if (uploadError) {
        setError('Error al subir el adjunto: ' + uploadError.message)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      documentoUrl = urlData.publicUrl
    }

    const { error: err } = await supabase
      .from('asignaciones_ministerio')
      .update({
        persona_id: form.persona_id,
        ministerio_id: form.ministerio_id,
        organizacion_id: form.organizacion_id || null,
        evento_id: form.evento_id || null,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        estado: form.estado,
        motivo_fin: form.motivo_fin || null,
        notas: form.notas || null,
        documento_url: documentoUrl,
      })
      .eq('id', id)

    if (err) {
      setError('Error al guardar: ' + err.message)
      setSaving(false)
      return
    }

    router.push('/ministerios/asignaciones')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Asignación no encontrada.</p>
        <Link href="/ministerios/asignaciones">
          <Button variant="outline">Volver</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ministerios/asignaciones" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Volver a Asignaciones
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <UserCheck className="h-8 w-8 text-primary" />
          Editar Asignación
        </h1>
      </div>

      <Card className="border-border bg-card max-w-4xl">
        <CardHeader>
          <CardTitle className="text-foreground">Datos de la Asignación</CardTitle>
          <CardDescription>Modifica cualquier campo de la asignación para el historial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuardar} className="space-y-5">
            {/* Fila 1: Persona + Rol en Ministerio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="persona_id">Persona *</Label>
                <PersonaCombobox
                  id="persona_id"
                  value={form.persona_id}
                  personas={personas}
                  onChange={(personaId) => setForm((f) => ({ ...f, persona_id: personaId }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ministerio_id">Rol *</Label>
                <Combobox
                  id="ministerio_id"
                  value={form.ministerio_id}
                  onSelect={(val) => setForm((f) => ({ ...f, ministerio_id: val }))}
                  options={ministerios.map((m) => ({
                    label: `${m.nombre} — ${tipoLabel[m.tipo] ?? m.tipo}${m.nivel_acceso > 0 ? ` (nivel ${m.nivel_acceso})` : ''}`,
                    value: m.id,
                  }))}
                  placeholder="Selecciona un rol..."
                  searchPlaceholder="Buscar rol..."
                  emptyText="No se encontraron roles."
                />
              </div>
            </div>

            {/* Fila 2: Organización + Evento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organizacion_id">Organización (opcional)</Label>
                <Combobox
                  id="organizacion_id"
                  value={form.organizacion_id}
                  onSelect={(val) => setForm((f) => ({ ...f, organizacion_id: val }))}
                  options={organizaciones.map((o) => ({ label: o.nombre, value: o.id }))}
                  placeholder="Global (sin restricción)"
                  searchPlaceholder="Buscar organización..."
                  emptyText="No se encontraron organizaciones."
                />
                <p className="text-xs text-muted-foreground">Vacío = acceso global</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evento_id">Retiro (opcional)</Label>
                <Combobox
                  id="evento_id"
                  value={form.evento_id}
                  onSelect={(val) => setForm((f) => ({ ...f, evento_id: val }))}
                  options={eventos.map((ev) => ({
                    label: `${ev.nombre} (${tipoEventoLabel[ev.tipo] ?? ev.tipo})`,
                    value: ev.id,
                  }))}
                  placeholder="Sin retiro específico"
                  searchPlaceholder="Buscar retiro..."
                  emptyText="No se encontraron retiros."
                />
              </div>
            </div>

            {/* Fila 3: Estado + Motivo de fin */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estado">Estado *</Label>
                <select
                  id="estado"
                  required
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo_fin">Motivo de fin (opcional)</Label>
                <select
                  id="motivo_fin"
                  value={form.motivo_fin}
                  onChange={(e) => setForm((f) => ({ ...f, motivo_fin: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Sin motivo especificado</option>
                  <option value="renuncia">Renuncia</option>
                  <option value="fin_ciclo">Fin de ciclo</option>
                  <option value="fin_convivencia">Fin de convivencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Fila 4: Fecha inicio + Fecha fin */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de inicio *</Label>
                <Input
                  id="fecha_inicio"
                  type="date"
                  required
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_fin">
                  Fecha de fin {form.estado === 'inactivo' ? '*' : '(dejar vacío si sigue activo)'}
                </Label>
                <Input
                  id="fecha_fin"
                  type="date"
                  required={form.estado === 'inactivo'}
                  value={form.fecha_fin}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                />
              </div>
            </div>

            {/* Fila 5: Adjunto + Notas */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label>Adjunto (opcional)</Label>
                {adjunto ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{adjunto.name}</p>
                      <p className="text-xs text-muted-foreground">{(adjunto.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjunto(null)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    {documentoUrlActual && (
                      <a
                        href={documentoUrlActual}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                      >
                        <Paperclip className="h-3 w-3" />
                        Ver adjunto actual
                      </a>
                    )}
                    <label
                      htmlFor="adjunto"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted/70 hover:text-foreground"
                    >
                      <Paperclip className="h-5 w-5" />
                      <span>{documentoUrlActual ? 'Hacé clic para reemplazarlo' : 'Hacé clic para seleccionar'}</span>
                      <span className="text-xs">PDF, Word o imagen — máx. 10 MB</span>
                      <input
                        id="adjunto"
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="sr-only"
                        onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea
                  id="notas"
                  placeholder="Observaciones sobre esta asignación..."
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Link href="/ministerios/asignaciones">
                <Button variant="outline" type="button">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

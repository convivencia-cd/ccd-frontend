'use client'

export const dynamic = 'force-dynamic'


import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PersonaCombobox } from '@/components/persona-combobox'
import { Combobox } from '@/components/ui/combobox'
import { ROLES_EVENTO_LABEL } from '@/lib/eventos/equipo'

type EventoOption = { id: string; nombre: string; fecha_inicio: string }

export default function NewInscripcionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [eventos, setEventos] = useState<EventoOption[]>([])
  const router = useRouter()
  const [formData, setFormData] = useState({
    persona_id: '',
    evento_id: '',
    rol_en_evento: 'convivente',
    estado_participacion: 'interesado',
    tipo_participante: 'no_cecista',
    notas: '',
  })

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data } = await supabase
        .from('eventos')
        .select('id, nombre, fecha_inicio')
        .in('estado', ['publicado', 'aprobado'])
        .order('fecha_inicio', { ascending: false })
      if (data) setEventos(data)
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.persona_id) {
      setError('Debes seleccionar una persona')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const insertData: Record<string, unknown> = {
        persona_id: formData.persona_id,
        evento_id: formData.evento_id,
        rol_en_evento: formData.rol_en_evento,
        estado_participacion: formData.estado_participacion,
        tipo_participante: formData.tipo_participante,
      }
      if (formData.notas) insertData.notas = formData.notas

      const { error: inscError } = await supabase.from('evento_participantes').insert(insertData)
      if (inscError) throw inscError

      router.push('/inscripciones')
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e.code === '23505') {
        setError('Esta persona ya está inscripta en ese evento.')
      } else {
        setError(e.message ?? 'Error al crear la inscripción')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="space-y-6">
      <Link href="/inscripciones" className="inline-flex items-center gap-2 text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Volver a Inscripciones
      </Link>

      <Card className="border-border bg-card max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">Crear Nueva Inscripción</CardTitle>
          <CardDescription>Registra una nueva inscripción a un evento</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Persona */}
            <div className="space-y-2">
              <Label htmlFor="persona_id">Persona *</Label>
              <PersonaCombobox
                id="persona_id"
                value={formData.persona_id}
                onChange={personaId => setFormData(prev => ({ ...prev, persona_id: personaId }))}
                placeholder="Seleccionar persona..."
              />
            </div>

            {/* Evento */}
            <div className="space-y-2">
              <Label htmlFor="evento_id">Evento *</Label>
              <Combobox
                id="evento_id"
                value={formData.evento_id}
                onSelect={val => setFormData(prev => ({ ...prev, evento_id: val }))}
                options={eventos.map(ev => ({ label: `${ev.nombre} (${ev.fecha_inicio})`, value: ev.id }))}
                placeholder="Seleccionar evento..."
                searchPlaceholder="Buscar evento..."
                emptyText="No se encontraron eventos."
              />
            </div>

            {/* Rol y Estado */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rol_en_evento">Rol en el Evento</Label>
                <select
                  id="rol_en_evento"
                  name="rol_en_evento"
                  value={formData.rol_en_evento}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  {Object.entries(ROLES_EVENTO_LABEL).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado_participacion">Estado</Label>
                <select
                  id="estado_participacion"
                  name="estado_participacion"
                  value={formData.estado_participacion}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                >
                  <option value="interesado">Interesado</option>
                  <option value="inscripto">Inscripto</option>
                  <option value="lista_espera">Lista de Espera</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Tipo de participante */}
            <div className="space-y-2">
              <Label htmlFor="tipo_participante">Tipo de participante</Label>
              <select
                id="tipo_participante"
                name="tipo_participante"
                value={formData.tipo_participante}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
              >
                <option value="no_cecista">No cecista (primera vez)</option>
                <option value="cecista">Cecista</option>
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-2">
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

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Crear Inscripción'}
              </Button>
              <Link href="/inscripciones">
                <Button type="button" variant="outline" className="bg-transparent">
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

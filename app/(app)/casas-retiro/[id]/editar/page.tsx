'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DiocesisCombobox } from "@/components/diocesis-field"
import { PersonaCombobox } from '@/components/persona-combobox'

type OrgOption = { id: string; nombre: string; tipo: string }

const AMENITY_LABELS: Record<string, string> = {
  estacionamiento: 'Estacionamiento',
  rampa_discapacitados: 'Rampa para discapacitados',
  capilla: 'Capilla',
  comedor_amplio: 'Comedor amplio',
  salon: 'Salón',
  banos_en_habit: 'Baños en habitación',
  tiene_escaleras: 'Escaleras',
  tiene_ascensor: 'Ascensor',
}

type FormData = {
  nombre: string
  codigo_interno: string
  tipo_propiedad: string
  estado: string
  contacto_persona_id: string
  telefono: string
  mail: string
  aforo: string
  direccion_calle: string
  direccion_nro: string
  ciudad: string
  cp: string
  diocesis: string
  provincia: string
  pais: string
  latitud: string
  longitud: string
  link_maps: string
  estacionamiento: boolean
  rampa_discapacitados: boolean
  capilla: boolean
  comedor_amplio: boolean
  salon: boolean
  banos_en_habit: boolean
  tiene_escaleras: boolean
  tiene_ascensor: boolean
  cant_hab_x2: string
  cant_hab_x3: string
  cant_hab_x4: string
  cant_banos: string
  notas: string
  organizaciones_cercanas: string[]
}

export default function EditarCasaRetiroPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loadingData, setLoadingData] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  // Cambiar el estado es dar de baja/reactivar: permiso casas_retiro.delete.
  const [puedeDarDeBaja, setPuedeDarDeBaja] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    codigo_interno: '',
    tipo_propiedad: 'terceros',
    estado: 'activa',
    contacto_persona_id: '',
    telefono: '',
    mail: '',
    aforo: '',
    direccion_calle: '',
    direccion_nro: '',
    ciudad: '',
    cp: '',
    diocesis: '',
    provincia: '',
    pais: 'Argentina',
    estacionamiento: false,
    rampa_discapacitados: false,
    capilla: false,
    comedor_amplio: false,
    salon: false,
    banos_en_habit: false,
    tiene_escaleras: false,
    tiene_ascensor: false,
    latitud: '',
    longitud: '',
    link_maps: '',
    cant_hab_x2: '',
    cant_hab_x3: '',
    cant_hab_x4: '',
    cant_banos: '',
    notas: '',
    organizaciones_cercanas: [],
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/casas-retiro/${id}`).then(r => r.json()),
      supabase.from('organizaciones').select('id, nombre, tipo').is('fecha_baja', null).order('nombre'),
    ]).then(([casaData, { data: orgData }]) => {
      setFormData({
        nombre: casaData.nombre ?? '',
        codigo_interno: casaData.codigo_interno ?? '',
        tipo_propiedad: casaData.tipo_propiedad ?? 'terceros',
        estado: casaData.estado ?? 'activa',
        contacto_persona_id: casaData.contacto_persona_id ?? '',
        telefono: casaData.telefono ?? '',
        mail: casaData.mail ?? '',
        aforo: casaData.aforo != null ? String(casaData.aforo) : '',
        direccion_calle: casaData.direccion_calle ?? '',
        direccion_nro: casaData.direccion_nro ?? '',
        ciudad: casaData.ciudad ?? '',
        cp: casaData.cp ?? '',
        diocesis: casaData.diocesis ?? '',
        provincia: casaData.provincia ?? '',
        pais: casaData.pais ?? 'Argentina',
        estacionamiento: casaData.estacionamiento ?? false,
        rampa_discapacitados: casaData.rampa_discapacitados ?? false,
        capilla: casaData.capilla ?? false,
        comedor_amplio: casaData.comedor_amplio ?? false,
        salon: casaData.salon ?? false,
        banos_en_habit: casaData.banos_en_habit ?? false,
        tiene_escaleras: casaData.tiene_escaleras ?? false,
        tiene_ascensor: casaData.tiene_ascensor ?? false,
        latitud: casaData.latitud != null ? String(casaData.latitud) : '',
        longitud: casaData.longitud != null ? String(casaData.longitud) : '',
        link_maps: casaData.link_maps ?? '',
        cant_hab_x2: casaData.cant_hab_x2 != null ? String(casaData.cant_hab_x2) : '',
        cant_hab_x3: casaData.cant_hab_x3 != null ? String(casaData.cant_hab_x3) : '',
        cant_hab_x4: casaData.cant_hab_x4 != null ? String(casaData.cant_hab_x4) : '',
        cant_banos: casaData.cant_banos != null ? String(casaData.cant_banos) : '',
        notas: casaData.notas ?? '',
        organizaciones_cercanas: casaData.organizaciones_cercanas ?? [],
      })
      setPuedeDarDeBaja(!!casaData.puede_dar_de_baja)
      if (orgData) setOrgs(orgData)
      setLoadingData(false)
    })
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const toggleOrg = (orgId: string) => {
    setFormData(prev => ({
      ...prev,
      organizaciones_cercanas: prev.organizaciones_cercanas.includes(orgId)
        ? prev.organizaciones_cercanas.filter(id => id !== orgId)
        : [...prev.organizaciones_cercanas, orgId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/casas-retiro/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json()
        throw new Error(apiError ?? 'Error al actualizar la casa de retiro')
      }

      router.push(`/casas-retiro/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la casa de retiro')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/casas-retiro/${id}`} className="inline-flex items-center gap-2 text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Volver al detalle
      </Link>

      <Card className="border-border bg-card max-w-4xl">
        <CardHeader>
          <CardTitle className="text-foreground">Editar Casa de Retiro</CardTitle>
          <CardDescription>Actualizá los datos de la casa de retiro</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Identificación */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                Identificación
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_interno">Código interno</Label>
                  <Input
                    id="codigo_interno"
                    name="codigo_interno"
                    value={formData.codigo_interno}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo_propiedad">Tipo de propiedad</Label>
                  <select
                    id="tipo_propiedad"
                    name="tipo_propiedad"
                    value={formData.tipo_propiedad}
                    onChange={handleChange}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                  >
                    <option value="propia">Propia</option>
                    <option value="terceros">De terceros</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    disabled={!puedeDarDeBaja}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm disabled:opacity-60"
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                  </select>
                  {!puedeDarDeBaja && (
                    <p className="text-xs text-muted-foreground">
                      No tenés permiso para dar de baja o reactivar casas de retiro.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                Contacto
              </h3>
              <div className="space-y-2">
                <Label htmlFor="contacto_persona_id">Persona de contacto</Label>
                <PersonaCombobox
                  id="contacto_persona_id"
                  value={formData.contacto_persona_id}
                  onChange={val => setFormData(prev => ({ ...prev, contacto_persona_id: val }))}
                  placeholder="Sin persona de contacto"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail">Mail</Label>
                  <Input id="mail" name="mail" type="email" value={formData.mail} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                Ubicación
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="direccion_calle">Dirección</Label>
                  <Input id="direccion_calle" name="direccion_calle" value={formData.direccion_calle} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion_nro">Número</Label>
                  <Input id="direccion_nro" name="direccion_nro" value={formData.direccion_nro} onChange={handleChange} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" name="ciudad" value={formData.ciudad} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp">Código postal</Label>
                  <Input id="cp" name="cp" value={formData.cp} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aforo">Aforo</Label>
                  <Input id="aforo" name="aforo" type="number" min="0" value={formData.aforo} onChange={handleChange} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="diocesis">Diócesis</Label>
                  <DiocesisCombobox
                    value={formData.diocesis}
                    onChange={(val) => setFormData((prev) => ({ ...prev, diocesis: val }))}
                    pais={formData.pais}
                    provincia={formData.provincia}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input id="provincia" name="provincia" value={formData.provincia} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pais">País</Label>
                  <Input id="pais" name="pais" value={formData.pais} onChange={handleChange} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitud">Latitud GPS</Label>
                  <Input id="latitud" name="latitud" placeholder="-27.4806" value={formData.latitud} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitud">Longitud GPS</Label>
                  <Input id="longitud" name="longitud" placeholder="-58.8341" value={formData.longitud} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_maps">Link de Google Maps</Label>
                <Input id="link_maps" name="link_maps" placeholder="https://maps.google.com/..." value={formData.link_maps} onChange={handleChange} />
              </div>
            </div>

            {/* Habitaciones */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                Habitaciones
              </h3>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="cant_hab_x2">Hab. dobles</Label>
                  <Input id="cant_hab_x2" name="cant_hab_x2" type="number" min="0" value={formData.cant_hab_x2} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cant_hab_x3">Hab. triples</Label>
                  <Input id="cant_hab_x3" name="cant_hab_x3" type="number" min="0" value={formData.cant_hab_x3} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cant_hab_x4">Hab. cuádruples</Label>
                  <Input id="cant_hab_x4" name="cant_hab_x4" type="number" min="0" value={formData.cant_hab_x4} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cant_banos">Baños</Label>
                  <Input id="cant_banos" name="cant_banos" type="number" min="0" value={formData.cant_banos} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Servicios */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                Servicios
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(AMENITY_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name={key}
                      checked={formData[key as keyof FormData] as boolean}
                      onChange={handleCheckboxChange}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Organizaciones cercanas */}
            {orgs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                  Organizaciones Cercanas
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3 space-y-2">
                  {orgs.map(org => (
                    <label key={org.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.organizaciones_cercanas.includes(org.id)}
                        onChange={() => toggleOrg(org.id)}
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                      <span className="text-sm text-foreground">{org.nombre}</span>
                      <span className="text-xs text-muted-foreground">({org.tipo})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <textarea
                id="notas"
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm min-h-20"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
              <Link href={`/casas-retiro/${id}`}>
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

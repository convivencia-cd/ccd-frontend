'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Ministerio {
  id: string
  nombre: string
  codigo_interno: string | null
  tipo: string
  nivel: string
  nivel_acceso: number
  activo: boolean
  requiere_acta?: boolean
}

interface Props {
  ministerio: Ministerio
  nivelCalculado: number
  asignacionesActivas: number
}

export function EditMinisterioForm({ ministerio, nivelCalculado, asignacionesActivas }: Props) {
  const [nivel, setNivel] = useState(nivelCalculado)
  const [nombre, setNombre] = useState(ministerio.nombre)
  const [codigoInterno, setCodigoInterno] = useState('')
  const [tipo, setTipo] = useState(ministerio.tipo)
  const [nivelOrg, setNivelOrg] = useState(ministerio.nivel)
  const [requiereActa, setRequiereActa] = useState(ministerio.requiere_acta ?? false)
  const [activo, setActivo] = useState(ministerio.activo)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Keep nivel in sync with PermisosMatrix changes
  if (nivel !== nivelCalculado) {
    setNivel(nivelCalculado)
  }

  const isReadOnly = ministerio.tipo === 'sistema'
  const isDirty =
    nombre !== ministerio.nombre ||
    tipo !== ministerio.tipo ||
    nivelOrg !== ministerio.nivel ||
    requiereActa !== (ministerio.requiere_acta ?? false) ||
    (!ministerio.codigo_interno && codigoInterno.trim() !== '')

  async function handleSave() {
    if (!isDirty) return
    const codigo = codigoInterno.trim()
    if (!ministerio.codigo_interno && codigo && !/^[A-Za-z0-9_-]+$/.test(codigo)) {
      setSaveError('El código interno solo puede contener letras, números, guiones y guiones bajos')
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    const supabase = createClient()
    const updates: Record<string, unknown> = { nombre: nombre.trim(), tipo, nivel: nivelOrg, requiere_acta: requiereActa }
    if (!ministerio.codigo_interno && codigo) updates.codigo_interno = codigo
    const { error: err } = await supabase
      .from('ministerios')
      .update(updates)
      .eq('id', ministerio.id)
    setSaving(false)
    if (err) {
      setSaveError(err.code === '23505' ? 'Ya existe un rol con ese código interno' : err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleDeactivate() {
    setDeactivating(true)
    setDeactivateError(null)
    if (asignacionesActivas > 0) {
      setDeactivateError(`No se puede desactivar: tiene ${asignacionesActivas} asignación${asignacionesActivas !== 1 ? 'es' : ''} activa${asignacionesActivas !== 1 ? 's' : ''}.`)
      setDeactivating(false)
      return
    }
    const supabase = createClient()
    const { error: err } = await supabase
      .from('ministerios')
      .update({ activo: false })
      .eq('id', ministerio.id)
    setDeactivating(false)
    if (err) {
      setDeactivateError(err.message)
    } else {
      setActivo(false)
    }
  }

  return (
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
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={isReadOnly}
              placeholder="ej: Coordinador de Zona"
            />
          </div>

          {/* Código Interno */}
          <div className="space-y-2">
            <Label htmlFor="codigo_interno">Código Interno</Label>
            {ministerio.codigo_interno ? (
              <>
                <Input value={ministerio.codigo_interno} disabled className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Inmutable una vez asignado</p>
              </>
            ) : (
              <>
                <Input
                  id="codigo_interno"
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                  placeholder="ej: COORD-ZONA"
                  pattern="[A-Za-z0-9_\-]+"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Alfanumérico. Inmutable al guardar.</p>
              </>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Rol *</Label>
            {isReadOnly ? (
              <Input value={tipo} disabled className="text-sm" />
            ) : (
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="conduccion">Conducción</option>
                <option value="pastoral">Pastoral</option>
                <option value="servicio">De Servicio</option>
                <option value="sistema">Sistema (acceso técnico)</option>
                <option value="otro">Otro</option>
              </select>
            )}
          </div>

          {/* Nivel organizacional */}
          <div className="space-y-2">
            <Label htmlFor="nivel-org">Nivel organizacional *</Label>
            {isReadOnly ? (
              <Input value={nivelOrg} disabled className="text-sm capitalize" />
            ) : (
              <select
                id="nivel-org"
                value={nivelOrg}
                onChange={(e) => setNivelOrg(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="comunidad">Comunidad</option>
                <option value="confraternidad">Confraternidad</option>
                <option value="fraternidad">Fraternidad</option>
                <option value="evento">Retiro</option>
              </select>
            )}
          </div>

          {/* Acta + nivel de acceso + botones */}
          <div className="space-y-4 lg:min-w-50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiere_acta"
                checked={requiereActa}
                onChange={(e) => setRequiereActa(e.target.checked)}
                disabled={isReadOnly}
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
                    style={{ width: `${nivel}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums w-8 text-right">
                  {nivel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Se calcula automáticamente según los permisos seleccionados
              </p>
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            {deactivateError && <p className="text-sm text-destructive">{deactivateError}</p>}

            {!isReadOnly && (
              <div className="flex gap-3 pt-1">
                <Button onClick={handleSave} disabled={!isDirty || saving}>
                  {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  {saved ? 'Guardado' : 'Guardar cambios'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  disabled={!activo || deactivating}
                  onClick={handleDeactivate}
                >
                  {deactivating
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                  {activo ? 'Desactivar' : 'Inactivo'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

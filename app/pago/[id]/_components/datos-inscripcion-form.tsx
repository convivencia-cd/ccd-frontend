'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LocationFields, PAISES } from '@/components/location-fields'
import { Combobox } from '@/components/ui/combobox'
import { DiocesisCombobox, type DiocesisRow } from '@/components/diocesis-field'
import {
  CAMPOS_PERSONA_INSCRIPCION,
  COMO_SE_ENTERO,
  ESTADOS_CIVILES,
  ESTADOS_ECLESIALES,
  ESTADO_ECLESIAL_RANGOS,
  LABELS_CAMPO_PERSONA,
  NIVELES_ESTUDIOS,
  RESTRICCIONES_ALIMENTARIAS,
  SEXOS,
  campoPersonaCompleto,
  type EventoRealizado,
  type InscripcionDatos,
} from '@/lib/eventos/inscripcion-datos'

export type PersonaDatos = {
  id: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  tipo_documento: string | null
  documento: string | null
  fecha_nacimiento: string | null
  direccion: string | null
  direccion_nro: string | null
  localidad: string | null
  codigo_postal: string | null
  provincia: string | null
  pais: string | null
  apodo: string | null
  sexo: string | null
  estado_vida: string | null
  nacionalidad: string | null
  nivel_estudios: string | null
  ocupacion: string | null
  estado_eclesial: string | null
  estado_eclesial_rango: string | null
  institucion_religiosa: string | null
  diocesis: string | null
  formacion_religiosa: string | null
  participacion_grupos_iglesia: string | null
  accion_social: string | null
}

interface Props {
  participanteId: string
  persona: PersonaDatos
  /** Respuestas ya guardadas de esta inscripción (si la persona reabre el link). */
  inscripcionInicial: InscripcionDatos | null
  /** Checklist de convivencias/retiros/talleres, igual al del perfil del cecista. */
  tiposRealizables: { id: string; nombre: string }[]
  /** Lo que la persona ya tiene cargado en su historial. */
  eventosRealizados: EventoRealizado[]
  /** Catálogo de diócesis, cargado en el servidor (sin sesión la RLS no deja leerlo). */
  diocesis: DiocesisRow[]
  onGuardado: () => void
}

const TIPOS_DOCUMENTO = [
  { value: 'dni', label: 'DNI' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'otro', label: 'Otro' },
]

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/** Marca de campo obligatorio, mismo estilo que el modal de "Me interesa". */
function Req() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {' '}
      *
    </span>
  )
}

/** Un dato ya cargado se muestra, pero no se puede pisar desde el link. */
function yaCargado(valor: string | null | undefined) {
  return !!valor && valor.trim() !== ''
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-5">
      <legend className="px-1 text-sm font-semibold text-foreground">{titulo}</legend>
      {children}
    </fieldset>
  )
}

/**
 * Respuesta Sí/No guardada como texto: con "Sí" se guarda el detalle, con "No"
 * queda null. Si la inscripción ya se guardó alguna vez, null es un "No".
 */
function siNoInicial(inicial: InscripcionDatos | null, texto: string | null | undefined): '' | 'si' | 'no' {
  if (!inicial) return ''
  return texto ? 'si' : 'no'
}

/** Pregunta de Sí/No que, con "Sí", pide el detalle. */
function PreguntaSiNo({
  id,
  pregunta,
  valor,
  onValor,
  detalle,
  onDetalle,
  placeholder,
  disabled,
  ayuda,
}: {
  id: string
  pregunta: string
  valor: string
  onValor: (v: string) => void
  detalle: string
  onDetalle: (v: string) => void
  placeholder: string
  disabled: boolean
  ayuda?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {pregunta}
        <Req />
      </Label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onValor(e.target.value)}
        required
        disabled={disabled}
        className={selectClass}
      >
        <option value="">— Seleccionar —</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
      {valor === 'si' && (
        <Textarea
          aria-label={pregunta}
          value={detalle}
          onChange={(e) => onDetalle(e.target.value)}
          placeholder={placeholder}
          required
          disabled={disabled}
        />
      )}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  )
}

export function DatosInscripcionForm({
  participanteId,
  persona,
  inscripcionInicial,
  tiposRealizables,
  eventosRealizados,
  diocesis,
  onGuardado,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    telefono: persona.telefono ?? '',
    tipo_documento: persona.tipo_documento ?? 'dni',
    documento: persona.documento ?? '',
    fecha_nacimiento: persona.fecha_nacimiento ?? '',
    direccion: persona.direccion ?? '',
    direccion_nro: persona.direccion_nro ?? '',
    pais: persona.pais ?? 'Argentina',
    provincia: persona.provincia ?? '',
    localidad: persona.localidad ?? '',
    codigo_postal: persona.codigo_postal ?? '',
    apodo: persona.apodo ?? '',
    sexo: persona.sexo ?? '',
    // "Sin especificar" cuenta como vacío: el estado civil es obligatorio.
    estado_vida: persona.estado_vida === 'sin_especificar' ? '' : (persona.estado_vida ?? ''),
    nacionalidad: persona.nacionalidad ?? '',
    nivel_estudios: persona.nivel_estudios ?? '',
    ocupacion: persona.ocupacion ?? '',
    estado_eclesial: persona.estado_eclesial ?? 'laico',
    estado_eclesial_rango: persona.estado_eclesial_rango ?? '',
    institucion_religiosa: persona.institucion_religiosa ?? '',
    diocesis: persona.diocesis ?? '',
    formacion_religiosa: persona.formacion_religiosa ?? '',
    participacion_grupos_iglesia: persona.participacion_grupos_iglesia ?? '',
    accion_social: persona.accion_social ?? '',
  })

  const [insc, setInsc] = useState({
    viene_acompanado: siNoInicial(inscripcionInicial, inscripcionInicial?.acompanante),
    acompanante: inscripcionInicial?.acompanante ?? '',
    tiene_dificultad_horario: siNoInicial(inscripcionInicial, inscripcionInicial?.dificultad_horario),
    dificultad_horario: inscripcionInicial?.dificultad_horario ?? '',
    tiene_salud_observaciones: siNoInicial(inscripcionInicial, inscripcionInicial?.salud_observaciones),
    como_se_entero: inscripcionInicial?.como_se_entero ?? '',
    como_se_entero_otro: inscripcionInicial?.como_se_entero_otro ?? '',
    familia_hizo_convivencias:
      inscripcionInicial?.familia_hizo_convivencias == null
        ? ''
        : inscripcionInicial.familia_hizo_convivencias
          ? 'si'
          : 'no',
    familia_quien: inscripcionInicial?.familia_quien ?? '',
    dieta_detalle: inscripcionInicial?.dieta_detalle ?? '',
    salud_observaciones: inscripcionInicial?.salud_observaciones ?? '',
  })
  const [restricciones, setRestricciones] = useState<string[]>(inscripcionInicial?.restricciones_alimentarias ?? [])
  // Checklist de realizados: { [tipo_evento_id]: año (texto) }. Lo que ya estaba
  // en el historial de la persona viene marcado y no se puede desmarcar desde acá.
  const [realizados, setRealizados] = useState<Record<string, string>>(() =>
    Object.fromEntries(eventosRealizados.map((e) => [e.tipo_evento_id, e.anio != null ? String(e.anio) : '']))
  )
  const yaRealizado = (tipoId: string) => eventosRealizados.some((e) => e.tipo_evento_id === tipoId)
  const anioYaCargado = (tipoId: string) =>
    eventosRealizados.some((e) => e.tipo_evento_id === tipoId && e.anio != null)

  const set = (campo: keyof typeof form) => (valor: string) => setForm((prev) => ({ ...prev, [campo]: valor }))
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  const handleInsc = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInsc((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  const setInscCampo = (campo: keyof typeof insc) => (valor: string) =>
    setInsc((prev) => ({ ...prev, [campo]: valor }))

  // El país arranca en "Argentina" aunque la ficha lo tenga vacío, así que la
  // ubicación se bloquea solo si ya había una provincia cargada.
  const ubicacionBloqueada = yaCargado(persona.provincia) && yaCargado(persona.localidad)
  // El estado civil "sin especificar" de la ficha cuenta como vacío.
  const estadoVidaCargado = yaCargado(persona.estado_vida) && persona.estado_vida !== 'sin_especificar'
  // estado_eclesial siempre trae 'laico' por defecto: solo se bloquea si la
  // comunidad ya le definió otro.
  const estadoEclesialBloqueado = yaCargado(persona.estado_eclesial) && persona.estado_eclesial !== 'laico'

  function toggleRestriccion(valor: string) {
    setRestricciones((prev) => {
      if (valor === 'ninguna') return prev.includes('ninguna') ? [] : ['ninguna']
      const sinNinguna = prev.filter((v) => v !== 'ninguna')
      return sinNinguna.includes(valor) ? sinNinguna.filter((v) => v !== valor) : [...sinNinguna, valor]
    })
  }

  function toggleRealizado(tipoId: string) {
    setRealizados((prev) => {
      if (tipoId in prev) {
        const { [tipoId]: _quitado, ...resto } = prev
        return resto
      }
      return { ...prev, [tipoId]: '' }
    })
  }

  const tieneRestriccion = restricciones.some((v) => v !== 'ninguna')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Todo es obligatorio (card #42). Los inputs nativos llevan `required`; acá
    // se revisa lo que el navegador no puede: comboboxes, checklist y ubicación.
    const faltan: string[] = CAMPOS_PERSONA_INSCRIPCION.filter((c) => !campoPersonaCompleto(c, form[c])).map(
      (c) => LABELS_CAMPO_PERSONA[c]
    )
    if (!estadoEclesialBloqueado && form.estado_eclesial !== 'laico') {
      if (form.estado_eclesial === 'clerigo' && !form.estado_eclesial_rango) faltan.push('Rango')
      if (!form.institucion_religiosa.trim()) faltan.push('Institución / Congregación')
    }
    if (Object.values(realizados).some((anio) => !anio.trim())) {
      faltan.push('el año de cada convivencia, retiro o taller que marcaste')
    }
    if (restricciones.length === 0) faltan.push('Restricciones alimentarias (o marcá "Ninguna")')
    if (tieneRestriccion && !insc.dieta_detalle.trim()) faltan.push('el detalle de tu dieta')
    if (faltan.length > 0) {
      setError(`Completá: ${faltan.join(', ')}.`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/public/inscripcion/${participanteId}/datos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          inscripcion: {
            ...insc,
            familia_hizo_convivencias:
              insc.familia_hizo_convivencias === '' ? null : insc.familia_hizo_convivencias === 'si',
            viene_acompanado: insc.viene_acompanado === '' ? null : insc.viene_acompanado === 'si',
            tiene_dificultad_horario:
              insc.tiene_dificultad_horario === '' ? null : insc.tiene_dificultad_horario === 'si',
            tiene_salud_observaciones:
              insc.tiene_salud_observaciones === '' ? null : insc.tiene_salud_observaciones === 'si',
            restricciones_alimentarias: restricciones,
          },
          eventos_realizados: Object.entries(realizados).map(([tipo_evento_id, anio]) => ({ tipo_evento_id, anio })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron guardar tus datos. Intentá de nuevo.')
      } else {
        onGuardado()
      }
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Estos son los datos que tenemos de vos. Completá los que falten para terminar la inscripción. Los campos
        marcados con <span className="text-destructive">*</span> son obligatorios.
      </p>

      <Seccion titulo="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={persona.nombre} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" value={persona.apellido} disabled />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="apodo">
              Sobrenombre
              <Req />
            </Label>
            <Input
              id="apodo"
              name="apodo"
              value={form.apodo}
              onChange={handleChange}
              placeholder="Para tu cartelito de identificación"
              required
              disabled={loading || yaCargado(persona.apodo)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sexo">
              Sexo
              <Req />
            </Label>
            <select
              id="sexo"
              name="sexo"
              value={form.sexo}
              onChange={handleChange}
              required
              disabled={loading || yaCargado(persona.sexo)}
              className={selectClass}
            >
              <option value="">— Seleccionar —</option>
              {SEXOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tipo_documento">
              Tipo de documento
              <Req />
            </Label>
            <select
              id="tipo_documento"
              name="tipo_documento"
              value={form.tipo_documento}
              onChange={handleChange}
              disabled={loading || yaCargado(persona.documento)}
              className={selectClass}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="documento">
              Número de documento
              <Req />
            </Label>
            <Input
              id="documento"
              name="documento"
              value={form.documento}
              onChange={handleChange}
              inputMode="numeric"
              required
              disabled={loading || yaCargado(persona.documento)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fecha_nacimiento">
              Fecha de nacimiento
              <Req />
            </Label>
            <Input
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              type="date"
              value={form.fecha_nacimiento}
              onChange={handleChange}
              required
              disabled={loading || yaCargado(persona.fecha_nacimiento)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="estado_vida">
              Estado civil
              <Req />
            </Label>
            <select
              id="estado_vida"
              name="estado_vida"
              value={form.estado_vida}
              onChange={handleChange}
              required
              disabled={loading || estadoVidaCargado}
              className={selectClass}
            >
              <option value="">— Seleccionar —</option>
              {ESTADOS_CIVILES.filter((o) => o.value !== 'sin_especificar').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>
              Nacionalidad
              <Req />
            </Label>
            <Combobox
              value={form.nacionalidad}
              onSelect={set('nacionalidad')}
              options={PAISES}
              placeholder="Seleccionar país..."
              searchPlaceholder="Buscar país..."
              emptyText="País no encontrado."
              disabled={loading || yaCargado(persona.nacionalidad)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ocupacion">
              Ocupación o profesión
              <Req />
            </Label>
            <Input
              id="ocupacion"
              name="ocupacion"
              value={form.ocupacion}
              onChange={handleChange}
              required
              disabled={loading || yaCargado(persona.ocupacion)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="nivel_estudios">
            Máximo nivel de estudios alcanzado
            <Req />
          </Label>
          <select
            id="nivel_estudios"
            name="nivel_estudios"
            value={form.nivel_estudios}
            onChange={handleChange}
            required
            disabled={loading || yaCargado(persona.nivel_estudios)}
            className={selectClass}
          >
            <option value="">— Seleccionar —</option>
            {NIVELES_ESTUDIOS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Seccion>

      <Seccion titulo="Contacto y domicilio">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={persona.email ?? ''} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="telefono">
              Teléfono celular
              <Req />
            </Label>
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Cód. país + cód. área + número"
              required
              disabled={loading || yaCargado(persona.telefono)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="direccion">
              Domicilio (calle)
              <Req />
            </Label>
            <Input
              id="direccion"
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              required
              disabled={loading || yaCargado(persona.direccion)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="direccion_nro">
              Número, piso, dto.
              <Req />
            </Label>
            <Input
              id="direccion_nro"
              name="direccion_nro"
              value={form.direccion_nro}
              onChange={handleChange}
              className="sm:w-36"
              required
              disabled={loading || yaCargado(persona.direccion_nro)}
            />
          </div>
        </div>

        <LocationFields
          pais={form.pais}
          provincia={form.provincia}
          localidad={form.localidad}
          codigoPostal={form.codigo_postal}
          onPaisChange={set('pais')}
          onProvinciaChange={set('provincia')}
          onLocalidadChange={set('localidad')}
          onCodigoPostalChange={set('codigo_postal')}
          disabled={loading || ubicacionBloqueada}
          required
        />
      </Seccion>

      <Seccion titulo="Vida de fe">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="estado_eclesial">
              Estado eclesial
              <Req />
            </Label>
            <select
              id="estado_eclesial"
              name="estado_eclesial"
              value={form.estado_eclesial}
              onChange={handleChange}
              disabled={loading || estadoEclesialBloqueado}
              className={selectClass}
            >
              {ESTADOS_ECLESIALES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="diocesis">
              Diócesis
              <Req />
            </Label>
            <DiocesisCombobox
              value={form.diocesis}
              onChange={set('diocesis')}
              pais={form.pais}
              provincia={form.provincia}
              catalogo={diocesis}
              disabled={loading || yaCargado(persona.diocesis)}
            />
          </div>
        </div>

        {/* Rango e institución: segundo nivel del estado eclesial, igual que el perfil. */}
        {!estadoEclesialBloqueado && form.estado_eclesial !== 'laico' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {form.estado_eclesial === 'clerigo' && (
              <div className="grid gap-1.5">
                <Label htmlFor="estado_eclesial_rango">
                  Rango
                  <Req />
                </Label>
                <select
                  id="estado_eclesial_rango"
                  name="estado_eclesial_rango"
                  value={form.estado_eclesial_rango}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={selectClass}
                >
                  <option value="">Seleccionar...</option>
                  {ESTADO_ECLESIAL_RANGOS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="institucion_religiosa">
                Institución / Congregación
                <Req />
              </Label>
              <Input
                id="institucion_religiosa"
                name="institucion_religiosa"
                value={form.institucion_religiosa}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="formacion_religiosa">
            Formación religiosa
            <Req />
          </Label>
          <Textarea
            id="formacion_religiosa"
            name="formacion_religiosa"
            value={form.formacion_religiosa}
            onChange={handleChange}
            placeholder="Cursos, seminarios, colegios católicos, etc. Si no tenés, poné “Ninguna”."
            required
            disabled={loading || yaCargado(persona.formacion_religiosa)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="participacion_grupos_iglesia">
            Participación en grupos de la Iglesia Católica
            <Req />
          </Label>
          <Textarea
            id="participacion_grupos_iglesia"
            name="participacion_grupos_iglesia"
            value={form.participacion_grupos_iglesia}
            onChange={handleChange}
            placeholder="Anterior o actual: ¿cuáles?, ¿cuánto tiempo?, ¿alguno de espiritualidad carismática? Si no participaste, poné “Ninguno”."
            required
            disabled={loading || yaCargado(persona.participacion_grupos_iglesia)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="accion_social">
            Otros grupos de acción social
            <Req />
          </Label>
          <Textarea
            id="accion_social"
            name="accion_social"
            value={form.accion_social}
            onChange={handleChange}
            placeholder="¿Cuáles?, ¿cuánto tiempo? Si no participaste, poné “Ninguno”."
            required
            disabled={loading || yaCargado(persona.accion_social)}
          />
        </div>

        {tiposRealizables.length > 0 && (
          <div className="grid gap-2">
            <Label>Convivencias, Retiros y Talleres realizados</Label>
            <p className="text-xs text-muted-foreground">Marcá las que hayas hecho e indicá el año. Si no hiciste ninguna, dejalas sin marcar.</p>
            <div className="space-y-2">
              {tiposRealizables.map((t) => {
                const marcado = t.id in realizados
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <input
                      id={`evt-${t.id}`}
                      type="checkbox"
                      checked={marcado}
                      onChange={() => toggleRealizado(t.id)}
                      disabled={loading || yaRealizado(t.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor={`evt-${t.id}`} className="flex-1">
                      {t.nombre}
                    </Label>
                    <Input
                      type="number"
                      aria-label={`Año de ${t.nombre}`}
                      min="1950"
                      max={new Date().getFullYear()}
                      placeholder="Año"
                      value={realizados[t.id] ?? ''}
                      onChange={(e) => setRealizados((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      required={marcado}
                      disabled={loading || !marcado || anioYaCargado(t.id)}
                      className="w-28"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Sobre esta convivencia">
        <div className="grid gap-1.5">
          <Label htmlFor="como_se_entero">
            ¿Cómo te enteraste de esta convivencia?
            <Req />
          </Label>
          <select
            id="como_se_entero"
            name="como_se_entero"
            value={insc.como_se_entero}
            onChange={handleInsc}
            required
            disabled={loading}
            className={selectClass}
          >
            <option value="">— Seleccionar —</option>
            {COMO_SE_ENTERO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {insc.como_se_entero === 'otro' && (
            <Input
              name="como_se_entero_otro"
              aria-label="¿Cómo te enteraste? (otro)"
              value={insc.como_se_entero_otro}
              onChange={handleInsc}
              placeholder="Contanos cómo"
              required
              disabled={loading}
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="familia_hizo_convivencias">
            ¿Alguien más de tu familia hizo convivencias?
            <Req />
          </Label>
          <select
            id="familia_hizo_convivencias"
            name="familia_hizo_convivencias"
            value={insc.familia_hizo_convivencias}
            onChange={handleInsc}
            required
            disabled={loading}
            className={selectClass}
          >
            <option value="">— Seleccionar —</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
          {insc.familia_hizo_convivencias === 'si' && (
            <Input
              name="familia_quien"
              aria-label="¿Quién de tu familia?"
              value={insc.familia_quien}
              onChange={handleInsc}
              placeholder="¿Quién? (parentesco, nombre y apellido)"
              required
              disabled={loading}
            />
          )}
        </div>

        <PreguntaSiNo
          id="viene_acompanado"
          pregunta="¿Asistirás con algún familiar, amigo o conocido?"
          valor={insc.viene_acompanado}
          onValor={setInscCampo('viene_acompanado')}
          detalle={insc.acompanante}
          onDetalle={setInscCampo('acompanante')}
          placeholder="¿Con quién? (parentesco, nombre y apellido)"
          disabled={loading}
        />

        <PreguntaSiNo
          id="tiene_dificultad_horario"
          pregunta="¿Se te presentará alguna dificultad en el horario de llegada o salida?"
          valor={insc.tiene_dificultad_horario}
          onValor={setInscCampo('tiene_dificultad_horario')}
          detalle={insc.dificultad_horario}
          onDetalle={setInscCampo('dificultad_horario')}
          placeholder="Describila brevemente"
          disabled={loading}
        />

        {/* Va antes de las restricciones alimentarias (pedido de Coti, card #42). */}
        <PreguntaSiNo
          id="tiene_salud_observaciones"
          pregunta="¿Hay algo importante que tengamos que saber?"
          valor={insc.tiene_salud_observaciones}
          onValor={setInscCampo('tiene_salud_observaciones')}
          detalle={insc.salud_observaciones}
          onDetalle={setInscCampo('salud_observaciones')}
          placeholder="Ej.: no podés subir escaleras, tomás medicación, cursás algún tratamiento, alergias, etc."
          disabled={loading}
          ayuda="Esta información la ven solo quienes organizan la convivencia."
        />

        <div className="grid gap-2">
          <Label>
            Restricciones alimentarias
            <Req />
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESTRICCIONES_ALIMENTARIAS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={restricciones.includes(o.value)}
                  onChange={() => toggleRestriccion(o.value)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-border"
                />
                {o.label}
              </label>
            ))}
          </div>
          {tieneRestriccion && (
            <Textarea
              name="dieta_detalle"
              aria-label="Detalle de la dieta"
              value={insc.dieta_detalle}
              onChange={handleInsc}
              placeholder="Especificá todo lo que tengamos que saber sobre tu dieta"
              required
              disabled={loading}
            />
          )}
        </div>
      </Seccion>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? 'Guardando...' : 'Continuar al pago'}
      </Button>
    </form>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Settings, Lock, Loader2, Eye, EyeOff, User, Home, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { translateSupabaseError } from '@/lib/errors/supabase'
import { LocationFields, PAISES } from '@/components/location-fields'
import { AvatarUpload } from '@/components/avatar-upload'
import { Combobox } from '@/components/ui/combobox'
import { MultiCombobox } from '@/components/ui/multi-combobox'
import { apellidoNombreConApodo, nombreCompletoConApodo } from '@/lib/personas/nombre'
import { EVENTOS_REALIZADOS_CATEGORIAS, nombreLegible, ordenarTiposEventos } from '@/lib/personas/eventos-realizados'

type FontSize = 'small' | 'medium' | 'large'

const FONT_SCALES: Record<FontSize, number> = {
  small: 1,
  medium: 1.125,
  large: 1.25,
}

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; preview: string }[] = [
  { value: 'small', label: 'Pequeño', preview: 'A' },
  { value: 'medium', label: 'Mediano', preview: 'A' },
  { value: 'large', label: 'Grande', preview: 'A' },
]

// Campos bloqueados en Configuración que el propio cecista no puede editar
// (ver tarjeta "Datos institucionales" y nota de Nombre/Apellido más abajo).
const CAMPOS_BLOQUEADOS = [
  'Nombre', 'Apellido', 'Categoría', 'Estado', 'Modo de participación', 'Usuario',
  'Código Interno', 'Mail CcD', 'Confraternidad', 'Fraternidad', 'Socio Activo', 'Otro',
]

const NIVELES_ESTUDIOS = [
  { value: 'primario', label: 'Primario' },
  { value: 'secundario', label: 'Secundario' },
  { value: 'terciario', label: 'Terciario' },
  { value: 'universitario', label: 'Universitario' },
  { value: 'posgrado_doctorado', label: 'Posgrado / Doctorado' },
]

// Estado Eclesiástico: 2 niveles (ver scripts/050_cecista_campos_completos.sql)
const ESTADO_ECLESIAL_TOP = [
  { value: 'laico', label: 'Laico/a' },
  { value: 'clerigo', label: 'Clérigo' },
  { value: 'consagrado', label: 'Consagrado/a' },
]
const ESTADO_ECLESIAL_RANGOS = [
  { value: 'obispo', label: 'Obispo' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'seminarista', label: 'Seminarista' },
  { value: 'diacono_permanente', label: 'Diácono permanente' },
]

const MODOS_LABEL: Record<string, string> = {
  colaborador: 'Colaborador',
  servidor: 'Servidor',
  asesor: 'Asesor',
  familiar: 'Familiar',
  orante: 'Orante',
  intercesor: 'Intercesor',
}

const TIPOS_PERSONA_LABEL: Record<string, string> = {
  interesado: 'Interesado/a',
  inscripto: 'Inscripto/a',
  convivente: 'Convivente',
  cecista: 'Cecista',
  otro: 'Otro',
}

// Tipos de dedicación (no excluyentes, cada una con año de inicio).
// Lista ampliable — ver scripts/039_cecista_perfil.sql.
const DEDICACION_VIVIENDO_COMO_SI = 'viviendo_como_dedicado'

const DEDICACION_TIPOS = [
  { value: 'dedicado', label: 'Dedicado/a' },
  { value: DEDICACION_VIVIENDO_COMO_SI, label: 'Viviendo como si el/los votos...' },
]

// Votos del cecista (mockup Pantalla Cecistas).
const VOTO_TIPOS = [
  { value: 'tender_union_dios', label: 'Tender a la unión con Dios' },
  { value: 'caridad_fraterna', label: 'Caridad fraterna' },
  { value: 'irradiacion', label: 'Irradiación' },
  { value: 'castidad', label: 'Castidad' },
  { value: 'pobreza', label: 'Pobreza' },
  { value: 'obediencia', label: 'Obediencia' },
  { value: 'tender_union_dios_matrimonios', label: 'Tender a la unión con Dios (matrimonios)' },
  { value: 'otros_familiares', label: 'Solo familiares — otros votos' },
]

type DedicacionState = { checked: boolean; anio: string; votos: string[] }
type VotoState = { anio: string; perpetuo: boolean; temporal: string }
type EventoRealizadoState = { checked: boolean; anio: string }
type CasaComunitaria = { id: string; nombre: string; codigo: string | null; tipo: string | null }
type TipoEvento = { id: string; nombre: string }
type AreaServicio = { id: string; nombre: string }
type AcompanamientoActual = { id: string; acompanante_id: string | null; acompanante_libre: string | null }
type AcompanadoRow = { id: string; persona: { nombre: string; apellido: string; apodo?: string | null } | null }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Persona = {
  id: string
  nombre: string
  apellido: string
  apodo: string | null
  email: string | null
  email_ccd: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  tipo_documento: string | null
  documento: string | null
  pais_documento: string | null
  direccion: string | null
  direccion_nro: string | null
  codigo_postal: string | null
  localidad: string | null
  provincia: string | null
  pais: string | null
  nacionalidad: string | null
  diocesis: string | null
  estado_eclesial: string | null
  estado_eclesial_rango: string | null
  institucion_religiosa: string | null
  parroquia: string | null
  estado_vida: string | null
  nivel_estudios: string | null
  titulo_estudios: string | null
  ocupacion: string | null
  anio_ingreso: number | null
  anio_ultimo_cambio_modo: number | null
  codigo_interno: string | null
  notas: string | null
  tipo_persona: string | null
  foto_url: string | null
  casa_comunitaria_id: string | null
  estado: string | null
  nombre_usuario: string | null
  socio_asociacion: boolean | null
  modo_participacion_ingreso: string | null
}

type EditForm = {
  nombre: string
  apellido: string
  apodo: string
  email: string
  email_ccd: string
  telefono: string
  fecha_nacimiento: string
  tipo_documento: string
  documento: string
  pais_documento: string
  direccion: string
  direccion_nro: string
  codigo_postal: string
  localidad: string
  provincia: string
  pais: string
  nacionalidad: string
  diocesis: string
  estado_eclesial: string
  estado_eclesial_rango: string
  institucion_religiosa: string
  parroquia: string
  estado_vida: string
  nivel_estudios: string
  titulo_estudios: string
  ocupacion: string
  anio_ingreso: string
  anio_ultimo_cambio_modo: string
  codigo_interno: string
  notas: string
  socio_asociacion: boolean
  modo_participacion_ingreso: string
}

type PersonaOpcion = { id: string; nombre: string; apellido: string; apodo?: string | null }

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
        <Check className="h-3.5 w-3.5" /> Guardado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" /> Error al guardar
    </span>
  )
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') ?? 'perfil'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [fontSize, setFontSize] = useState<FontSize>('small')

  // Password change dialog
  const [pwOpen, setPwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showPw, setShowPw] = useState({ actual: false, nueva: false, confirmar: false })

  // Reportar dato incorrecto (campos bloqueados de "Datos institucionales" / Nombre-Apellido)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionForm, setCorrectionForm] = useState({ campo: '', descripcion: '' })
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [correctionSuccess, setCorrectionSuccess] = useState(false)

  // Perfil tab state
  const [persona, setPersona] = useState<Persona | null>(null)
  const [modoActual, setModoActual] = useState<string | null>(null)
  const [confraternidadNombre, setConfraternidadNombre] = useState<string | null>(null)
  const [fraternidadNombre, setFraternidadNombre] = useState<string | null>(null)
  const [loadingPersona, setLoadingPersona] = useState(true)
  const [todasPersonas, setTodasPersonas] = useState<PersonaOpcion[]>([])
  const [editForm, setEditForm] = useState<EditForm>({
    nombre: '', apellido: '', apodo: '', email: '', email_ccd: '', telefono: '',
    fecha_nacimiento: '', tipo_documento: '', documento: '', pais_documento: '',
    direccion: '', direccion_nro: '', codigo_postal: '',
    localidad: '', provincia: '', pais: 'Argentina', nacionalidad: '', diocesis: '',
    estado_eclesial: 'laico', estado_eclesial_rango: '', institucion_religiosa: '',
    parroquia: '', estado_vida: '',
    nivel_estudios: '', titulo_estudios: '', ocupacion: '',
    anio_ingreso: '', anio_ultimo_cambio_modo: '', codigo_interno: '', notas: '',
    socio_asociacion: false, modo_participacion_ingreso: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  // Solo Enlaces/Delegados/Responsables/Tesoreros/Timonel pueden tildar
  // "Socio Activo" — ver app/api/personas/me/socio-activo/route.ts
  const [canEditSocioActivo, setCanEditSocioActivo] = useState(false)

  // Acompañamiento (histórico — ver persona_acompanamiento)
  const [currentAcomp, setCurrentAcomp] = useState<AcompanamientoActual | null>(null)
  const [acompananteId, setAcompananteId] = useState('')
  const [acompananteLibre, setAcompananteLibre] = useState('')
  const [acompananteLibreMode, setAcompananteLibreMode] = useState(false)
  const [acompanados, setAcompanados] = useState<AcompanadoRow[]>([])

  // Ministerios que ejerce (áreas de servicio autodeclaradas)
  const [areasServicio, setAreasServicio] = useState<AreaServicio[]>([])
  const [misAreasServicio, setMisAreasServicio] = useState<string[]>([])
  const [otrosComentario, setOtrosComentario] = useState('')

  // Secciones cecista
  const [casas, setCasas] = useState<CasaComunitaria[]>([])
  const [casaId, setCasaId] = useState('')
  const [dedicaciones, setDedicaciones] = useState<Record<string, DedicacionState>>({})
  const [votos, setVotos] = useState<Record<string, VotoState>>({})
  const [tiposEventos, setTiposEventos] = useState<TipoEvento[]>([])
  const [eventosRealizados, setEventosRealizados] = useState<Record<string, EventoRealizadoState>>({})

  // Autoguardado: timers de debounce por clave y flag de hidratación inicial
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const hydratedRef = useRef(false)

  const handlePasswordChange = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPwError(null)

    if (pwForm.nueva.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (pwForm.nueva !== pwForm.confirmar) {
      setPwError('Las contraseñas no coinciden.')
      return
    }

    setPwLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setPwError('No se pudo obtener el usuario actual.')
      setPwLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwForm.actual,
    })

    if (signInError) {
      setPwError('Contraseña actual incorrecta.')
      setPwLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: pwForm.nueva })
    setPwLoading(false)

    if (updateError) {
      setPwError(updateError.message)
      return
    }

    setPwSuccess(true)
    setPwForm({ actual: '', nueva: '', confirmar: '' })
    setTimeout(() => {
      setPwOpen(false)
      setPwSuccess(false)
    }, 1500)
  }

  const openCorrectionDialog = (campo: string) => {
    setCorrectionForm({ campo, descripcion: '' })
    setCorrectionError(null)
    setCorrectionSuccess(false)
    setCorrectionOpen(true)
  }

  const handleReportarCorreccion = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCorrectionError(null)

    if (!correctionForm.campo) {
      setCorrectionError('Elegí qué dato está mal.')
      return
    }
    if (!correctionForm.descripcion.trim()) {
      setCorrectionError('Contanos qué está mal para poder corregirlo.')
      return
    }

    setCorrectionLoading(true)
    const res = await fetch('/api/solicitudes-correccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(correctionForm),
    })
    setCorrectionLoading(false)

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }))
      setCorrectionError(error ?? 'No se pudo enviar la solicitud. Probá de nuevo.')
      return
    }

    setCorrectionSuccess(true)
    setTimeout(() => {
      setCorrectionOpen(false)
      setCorrectionSuccess(false)
    }, 1500)
  }

  useEffect(() => {
    const saved = localStorage.getItem('font-size-preference') as FontSize | null
    if (saved && saved in FONT_SCALES) setFontSize(saved)
  }, [])

  useEffect(() => {
    async function loadPersona() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingPersona(false)
        return
      }

      const { data } = await supabase
        .from('personas')
        .select('id, nombre, apellido, apodo, email, email_ccd, telefono, fecha_nacimiento, tipo_documento, documento, pais_documento, direccion, direccion_nro, codigo_postal, localidad, provincia, pais, nacionalidad, diocesis, estado_eclesial, estado_eclesial_rango, institucion_religiosa, parroquia, estado_vida, nivel_estudios, titulo_estudios, ocupacion, anio_ingreso, anio_ultimo_cambio_modo, codigo_interno, notas, tipo_persona, foto_url, casa_comunitaria_id, estado, nombre_usuario, socio_asociacion, modo_participacion_ingreso')
        .eq('auth_user_id', user.id)
        .single()

      if (data) {
        setPersona(data)
        setEditForm({
          nombre: data.nombre ?? '',
          apellido: data.apellido ?? '',
          apodo: data.apodo ?? '',
          email: data.email ?? '',
          email_ccd: data.email_ccd ?? '',
          telefono: data.telefono ?? '',
          fecha_nacimiento: data.fecha_nacimiento ?? '',
          tipo_documento: data.tipo_documento ?? '',
          documento: data.documento ?? '',
          pais_documento: data.pais_documento ?? '',
          direccion: data.direccion ?? '',
          direccion_nro: data.direccion_nro ?? '',
          codigo_postal: data.codigo_postal ?? '',
          localidad: data.localidad ?? '',
          provincia: data.provincia ?? '',
          pais: data.pais ?? 'Argentina',
          nacionalidad: data.nacionalidad ?? '',
          diocesis: data.diocesis ?? '',
          estado_eclesial: data.estado_eclesial ?? 'laico',
          estado_eclesial_rango: data.estado_eclesial_rango ?? '',
          institucion_religiosa: data.institucion_religiosa ?? '',
          parroquia: data.parroquia ?? '',
          estado_vida: data.estado_vida ?? '',
          nivel_estudios: data.nivel_estudios ?? '',
          titulo_estudios: data.titulo_estudios ?? '',
          ocupacion: data.ocupacion ?? '',
          anio_ingreso: data.anio_ingreso != null ? String(data.anio_ingreso) : '',
          anio_ultimo_cambio_modo: data.anio_ultimo_cambio_modo != null ? String(data.anio_ultimo_cambio_modo) : '',
          codigo_interno: data.codigo_interno ?? '',
          notas: data.notas ?? '',
          socio_asociacion: data.socio_asociacion ?? false,
          modo_participacion_ingreso: data.modo_participacion_ingreso ?? '',
        })

        fetch('/api/personas/me/socio-activo')
          .then(res => res.json())
          .then(json => setCanEditSocioActivo(!!json.canEdit))
          .catch(() => setCanEditSocioActivo(false))

        const { data: acompData } = await supabase
          .from('persona_acompanamiento')
          .select('id, acompanante_id, acompanante_libre')
          .eq('persona_id', data.id)
          .is('fecha_fin', null)
          .maybeSingle()
        setCurrentAcomp(acompData ?? null)
        setAcompananteId(acompData?.acompanante_id ?? '')
        setAcompananteLibre(acompData?.acompanante_libre ?? '')
        setAcompananteLibreMode(!!acompData?.acompanante_libre)

        // "Acompaño a": se completa solo con quienes me eligieron como su
        // acompañante (misma tabla, mirada del otro lado — no es editable).
        const { data: acompanadosData } = await supabase
          .from('persona_acompanamiento')
          .select('id, persona:personas!persona_id(nombre, apellido, apodo)')
          .eq('acompanante_id', data.id)
          .is('fecha_fin', null)
        setAcompanados((acompanadosData as unknown as AcompanadoRow[]) ?? [])

        const { data: modo } = await supabase
          .from('persona_modos')
          .select('modo')
          .eq('persona_id', data.id)
          .is('fecha_fin', null)
          .maybeSingle()

        setModoActual(modo?.modo ?? null)

        // Confraternidad / Fraternidad vigentes (persona_organizacion activa).
        // Solo lectura — se importan/gestionan desde la Administración de CcD.
        const { data: orgs } = await supabase
          .from('persona_organizacion')
          .select('tipo_relacion, organizacion:organizaciones!organizacion_id(nombre)')
          .eq('persona_id', data.id)
          .is('fecha_fin', null)
        const confra = (orgs as any[])?.find(o => o.tipo_relacion === 'confraternidad')?.organizacion
        const frat = (orgs as any[])?.find(o => o.tipo_relacion === 'fraternidad')?.organizacion
        setConfraternidadNombre(confra?.nombre ?? null)
        setFraternidadNombre(frat?.nombre ?? null)

        // Secciones cecista: casas disponibles, dedicaciones y votos
        setCasaId(data.casa_comunitaria_id ?? '')

        const { data: casasData } = await supabase
          .from('casas_comunitarias')
          .select('id, nombre, codigo, tipo')
          .eq('estado', 'activa')
          .is('fecha_baja', null)
          .order('nombre')
        setCasas(casasData ?? [])

        const { data: dedData } = await supabase
          .from('persona_dedicaciones')
          .select('tipo, anio_inicio, votos_como_si')
          .eq('persona_id', data.id)
        const dedMap: Record<string, DedicacionState> = {}
        for (const t of DEDICACION_TIPOS) dedMap[t.value] = { checked: false, anio: '', votos: [] }
        for (const d of dedData ?? []) {
          dedMap[d.tipo] = {
            checked: true,
            anio: d.anio_inicio != null ? String(d.anio_inicio) : '',
            votos: (d as any).votos_como_si ?? [],
          }
        }
        setDedicaciones(dedMap)

        const { data: votosData } = await supabase
          .from('persona_votos')
          .select('tipo_voto, anio, perpetuo, temporal_cant_anios')
          .eq('persona_id', data.id)
        const votoMap: Record<string, VotoState> = {}
        for (const t of VOTO_TIPOS) votoMap[t.value] = { anio: '', perpetuo: false, temporal: '' }
        for (const v of votosData ?? []) {
          votoMap[v.tipo_voto] = {
            anio: v.anio != null ? String(v.anio) : '',
            perpetuo: !!v.perpetuo,
            temporal: v.temporal_cant_anios != null ? String(v.temporal_cant_anios) : '',
          }
        }
        setVotos(votoMap)

        const { data: tiposData } = await supabase
          .from('tipos_eventos')
          .select('id, nombre')
          .in('categoria', EVENTOS_REALIZADOS_CATEGORIAS)
          .eq('activo', true)
          .order('nombre')
        const tiposOrdenados = ordenarTiposEventos(tiposData ?? [])
        setTiposEventos(tiposOrdenados)

        const { data: realizadosData } = await supabase
          .from('persona_eventos_realizados')
          .select('tipo_evento_id, anio')
          .eq('persona_id', data.id)
        const realizadosMap: Record<string, EventoRealizadoState> = {}
        for (const t of tiposOrdenados) realizadosMap[t.id] = { checked: false, anio: '' }
        for (const r of realizadosData ?? []) {
          realizadosMap[r.tipo_evento_id] = { checked: true, anio: r.anio != null ? String(r.anio) : '' }
        }
        setEventosRealizados(realizadosMap)

        // Ministerios que ejerce (áreas de servicio autodeclaradas)
        const { data: areasData } = await supabase
          .from('areas_servicio')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre')
        setAreasServicio(areasData ?? [])

        const { data: misAreasData } = await supabase
          .from('persona_areas_servicio')
          .select('area_servicio_id, comentario')
          .eq('persona_id', data.id)
        setMisAreasServicio((misAreasData ?? []).map((r: { area_servicio_id: string }) => r.area_servicio_id))
        const otrosId = (areasData ?? []).find((a: AreaServicio) => a.nombre === 'Otros')?.id
        setOtrosComentario((misAreasData ?? []).find((r: { area_servicio_id: string; comentario: string | null }) => r.area_servicio_id === otrosId)?.comentario ?? '')
      }

      // Cargar cecistas activos para el selector de acompañante (paginado: son
      // ~2000 y Supabase corta la respuesta por defecto en 1000 filas).
      const cecistas: PersonaOpcion[] = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data: page } = await supabase
          .from('personas')
          .select('id, nombre, apellido, apodo')
          .is('fecha_baja', null)
          .eq('estado', 'activo')
          .eq('tipo_persona', 'cecista')
          .order('apellido')
          .range(from, from + pageSize - 1)
        if (!page || page.length === 0) break
        cecistas.push(...page)
        if (page.length < pageSize) break
        from += pageSize
      }
      setTodasPersonas(cecistas)
      setLoadingPersona(false)
    }
    loadPersona()
  }, [])

  // Autoguardado de datos básicos: dispara un guardado debounced ante cambios
  // del formulario, una vez hidratado el perfil inicial.
  useEffect(() => {
    if (!hydratedRef.current || !persona) return
    debounceSave('perfil', () => { void saveProfile(false) }, 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm])

  // Marca el perfil como hidratado DESPUÉS del efecto de autoguardado, de modo
  // que la carga inicial (que también muta editForm) no dispare un guardado.
  useEffect(() => {
    if (persona) hydratedRef.current = true
  }, [persona])

  function applyFontSize(size: FontSize) {
    setFontSize(size)
    localStorage.setItem('font-size-preference', size)
    document.documentElement.style.setProperty('--font-scale', String(FONT_SCALES[size]))
  }

  // Debounce genérico por clave (autoguardado).
  function debounceSave(key: string, fn: () => void, ms = 800) {
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(fn, ms)
  }

  // Envuelve un guardado a Supabase y refleja el estado en el indicador.
  async function runSave(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setEditError(null)
    setSaveStatus('saving')
    const { error } = await fn()
    if (error) {
      setSaveStatus('error')
      setEditError(translateSupabaseError(error.message))
      return
    }
    setSaveStatus('saved')
    window.setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2000)
  }

  async function saveProfile(manual: boolean) {
    if (!persona) return
    if (manual) setEditLoading(true)
    const esClerigoConsagrado = editForm.estado_eclesial === 'clerigo' || editForm.estado_eclesial === 'consagrado'
    await runSave(() =>
      createClient()
        .from('personas')
        .update({
          // nombre, apellido y codigo_interno son solo lectura en la autogestión
          // (los gestiona la Administración de CcD) — no se incluyen en el update.
          apodo: editForm.apodo || null,
          email: editForm.email || null,
          telefono: editForm.telefono || null,
          fecha_nacimiento: editForm.fecha_nacimiento || null,
          tipo_documento: editForm.tipo_documento || null,
          documento: editForm.documento || null,
          pais_documento: editForm.pais_documento || null,
          direccion: editForm.direccion || null,
          direccion_nro: editForm.direccion_nro || null,
          codigo_postal: editForm.codigo_postal || null,
          localidad: editForm.localidad || null,
          provincia: editForm.provincia || null,
          pais: editForm.pais || null,
          nacionalidad: editForm.nacionalidad || null,
          diocesis: editForm.diocesis || null,
          estado_eclesial: editForm.estado_eclesial || 'laico',
          estado_eclesial_rango: editForm.estado_eclesial === 'clerigo' ? (editForm.estado_eclesial_rango || null) : null,
          institucion_religiosa: esClerigoConsagrado ? (editForm.institucion_religiosa || null) : null,
          parroquia: editForm.parroquia || null,
          estado_vida: editForm.estado_vida || null,
          nivel_estudios: editForm.nivel_estudios || null,
          titulo_estudios: (editForm.nivel_estudios === 'universitario' || editForm.nivel_estudios === 'terciario')
            ? (editForm.titulo_estudios || null) : null,
          ocupacion: editForm.ocupacion || null,
          anio_ingreso: editForm.anio_ingreso ? Number(editForm.anio_ingreso) : null,
          anio_ultimo_cambio_modo: editForm.anio_ultimo_cambio_modo ? Number(editForm.anio_ultimo_cambio_modo) : null,
          notas: editForm.notas || null,
          // socio_asociacion NO se guarda acá: tiene su propio endpoint con
          // chequeo de permiso server-side (ver toggleSocioActivo más abajo,
          // y app/api/personas/me/socio-activo/route.ts).
          modo_participacion_ingreso: editForm.modo_participacion_ingreso || null,
        })
        .eq('id', persona.id)
    )
    setPersona(prev =>
      prev
        ? {
            ...prev,
            nombre: editForm.nombre,
            apellido: editForm.apellido,
            email: editForm.email || null,
            telefono: editForm.telefono || null,
          }
        : prev
    )
    if (manual) setEditLoading(false)
  }

  function handleSaveProfile(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    void saveProfile(true)
  }

  // "Socio Activo" tiene su propio endpoint (permiso restringido a ministerios
  // de conducción/tesorería) en vez del guardado masivo de saveProfile.
  async function toggleSocioActivo(checked: boolean) {
    if (!canEditSocioActivo) return
    setEditForm(prev => ({ ...prev, socio_asociacion: checked }))
    await runSave(async () => {
      const res = await fetch('/api/personas/me/socio-activo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_asociacion: checked }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setEditForm(prev => ({ ...prev, socio_asociacion: !checked }))
        return { error: { message: body.error ?? 'No se pudo guardar' } }
      }
      return { error: null }
    })
  }

  function field(key: keyof EditForm, value: string) {
    setEditForm(prev => ({ ...prev, [key]: value }))
  }

  // ── Casa Comunitaria (relación 1→1) ──
  function persistCasa(value: string) {
    setCasaId(value)
    if (!persona) return
    void runSave(() =>
      createClient()
        .from('personas')
        .update({ casa_comunitaria_id: value || null })
        .eq('id', persona.id)
    )
  }

  // ── Dedicaciones (no excluyentes, año de inicio) ──
  function persistDedicacion(tipo: string, row: DedicacionState) {
    if (!persona) return
    void runSave(() =>
      createClient()
        .from('persona_dedicaciones')
        .upsert(
          {
            persona_id: persona.id,
            tipo,
            anio_inicio: row.anio ? Number(row.anio) : null,
            votos_como_si: tipo === DEDICACION_VIVIENDO_COMO_SI ? row.votos : [],
          },
          { onConflict: 'persona_id,tipo' }
        )
    )
  }

  function toggleDedicacion(tipo: string, checked: boolean) {
    const prevRow = dedicaciones[tipo] ?? { checked: false, anio: '', votos: [] }
    const row: DedicacionState = { ...prevRow, checked }
    setDedicaciones(prev => ({ ...prev, [tipo]: row }))
    if (!persona) return
    if (checked) {
      persistDedicacion(tipo, row)
    } else {
      void runSave(() =>
        createClient()
          .from('persona_dedicaciones')
          .delete()
          .eq('persona_id', persona.id)
          .eq('tipo', tipo)
      )
    }
  }

  function setDedicacionAnio(tipo: string, anio: string) {
    const row: DedicacionState = { ...(dedicaciones[tipo] ?? { checked: false, anio: '', votos: [] }), anio }
    setDedicaciones(prev => ({ ...prev, [tipo]: row }))
    if (!persona || !row.checked) return
    debounceSave(`ded-${tipo}`, () => persistDedicacion(tipo, row))
  }

  function setDedicacionVotos(tipo: string, votos: string[]) {
    const row: DedicacionState = { ...(dedicaciones[tipo] ?? { checked: false, anio: '', votos: [] }), votos }
    setDedicaciones(prev => ({ ...prev, [tipo]: row }))
    if (!persona || !row.checked) return
    persistDedicacion(tipo, row)
  }

  // ── Votos (temporales o perpetuos) ──
  function persistVoto(tipo: string, row: VotoState) {
    if (!persona) return
    const isEmpty = !row.anio && !row.perpetuo && !row.temporal
    if (isEmpty) {
      void runSave(() =>
        createClient()
          .from('persona_votos')
          .delete()
          .eq('persona_id', persona.id)
          .eq('tipo_voto', tipo)
      )
      return
    }
    void runSave(() =>
      createClient()
        .from('persona_votos')
        .upsert(
          {
            persona_id: persona.id,
            tipo_voto: tipo,
            anio: row.anio ? Number(row.anio) : null,
            perpetuo: row.perpetuo,
            temporal_cant_anios: row.perpetuo ? null : row.temporal ? Number(row.temporal) : null,
          },
          { onConflict: 'persona_id,tipo_voto' }
        )
    )
  }

  function changeVoto(tipo: string, patch: Partial<VotoState>, immediate: boolean) {
    const row: VotoState = { ...(votos[tipo] ?? { anio: '', perpetuo: false, temporal: '' }), ...patch }
    setVotos(prev => ({ ...prev, [tipo]: row }))
    if (immediate) persistVoto(tipo, row)
    else debounceSave(`voto-${tipo}`, () => persistVoto(tipo, row))
  }

  // ── Acompañante (histórico — cierra el activo y abre uno nuevo) ──
  async function persistAcompanante(newId: string, newLibre: string) {
    if (!persona) return
    const today = new Date().toISOString().split('T')[0]
    await runSave(async () => {
      const supabase = createClient()
      if (currentAcomp) {
        const { error: closeError } = await supabase
          .from('persona_acompanamiento')
          .update({ fecha_fin: today })
          .eq('id', currentAcomp.id)
        if (closeError) return { error: closeError }
      }
      if (newId || newLibre) {
        const { data: newRec, error: insertError } = await supabase
          .from('persona_acompanamiento')
          .insert({
            persona_id: persona.id,
            acompanante_id: newId || null,
            acompanante_libre: newLibre || null,
            fecha_inicio: today,
          })
          .select('id, acompanante_id, acompanante_libre')
          .single()
        if (insertError) return { error: insertError }
        setCurrentAcomp(newRec)
      } else {
        setCurrentAcomp(null)
      }
      // Sincroniza la columna legacy para compatibilidad con el form admin
      await supabase.from('personas').update({ acompanante_id: newId || null }).eq('id', persona.id)
      return { error: null }
    })
  }

  function handleAcompananteChange(value: string) {
    setAcompananteId(value)
    void persistAcompanante(value, '')
  }

  function handleAcompananteLibreChange(value: string) {
    setAcompananteLibre(value)
    debounceSave('acomp-libre', () => { void persistAcompanante('', value) })
  }

  function toggleAcompananteLibreMode(checked: boolean) {
    setAcompananteLibreMode(checked)
    if (checked) {
      setAcompananteId('')
    } else {
      setAcompananteLibre('')
      void persistAcompanante('', '')
    }
  }

  // ── Convivencias/retiros/talleres realizados ──
  function toggleEventoRealizado(tipoId: string, checked: boolean) {
    const anio = eventosRealizados[tipoId]?.anio ?? ''
    setEventosRealizados(prev => ({ ...prev, [tipoId]: { checked, anio } }))
    if (!persona) return
    if (checked) {
      void runSave(() =>
        createClient()
          .from('persona_eventos_realizados')
          .upsert(
            { persona_id: persona.id, tipo_evento_id: tipoId, anio: anio ? Number(anio) : null },
            { onConflict: 'persona_id,tipo_evento_id' }
          )
      )
    } else {
      void runSave(() =>
        createClient()
          .from('persona_eventos_realizados')
          .delete()
          .eq('persona_id', persona.id)
          .eq('tipo_evento_id', tipoId)
      )
    }
  }

  function setEventoRealizadoAnio(tipoId: string, anio: string) {
    setEventosRealizados(prev => ({ ...prev, [tipoId]: { checked: prev[tipoId]?.checked ?? false, anio } }))
    if (!persona || !eventosRealizados[tipoId]?.checked) return
    debounceSave(`evt-${tipoId}`, () => {
      void runSave(() =>
        createClient()
          .from('persona_eventos_realizados')
          .upsert(
            { persona_id: persona.id, tipo_evento_id: tipoId, anio: anio ? Number(anio) : null },
            { onConflict: 'persona_id,tipo_evento_id' }
          )
      )
    })
  }

  // ── Ministerios que ejerce (áreas de servicio, sin histórico) ──
  function changeMisAreasServicio(newValues: string[]) {
    if (!persona) return
    const added = newValues.filter(v => !misAreasServicio.includes(v))
    const removed = misAreasServicio.filter(v => !newValues.includes(v))
    setMisAreasServicio(newValues)
    const otrosId = areasServicio.find(a => a.nombre === 'Otros')?.id
    if (otrosId && removed.includes(otrosId)) setOtrosComentario('')
    for (const areaId of added) {
      void runSave(() =>
        createClient()
          .from('persona_areas_servicio')
          .insert({ persona_id: persona.id, area_servicio_id: areaId })
      )
    }
    for (const areaId of removed) {
      void runSave(() =>
        createClient()
          .from('persona_areas_servicio')
          .delete()
          .eq('persona_id', persona.id)
          .eq('area_servicio_id', areaId)
      )
    }
  }

  function setOtrosComentarioValue(value: string) {
    setOtrosComentario(value)
    const otrosId = areasServicio.find(a => a.nombre === 'Otros')?.id
    if (!persona || !otrosId || !misAreasServicio.includes(otrosId)) return
    debounceSave('otros-comentario', () => {
      void runSave(() =>
        createClient()
          .from('persona_areas_servicio')
          .update({ comentario: value || null })
          .eq('persona_id', persona.id)
          .eq('area_servicio_id', otrosId)
      )
    })
  }

  const selectClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          Configuración
        </h1>
        <p className="mt-2 text-muted-foreground">
          Preferencias de tu cuenta
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'perfil'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Datos Personales
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('seguridad')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'seguridad'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Seguridad
        </button>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <Card className="border-border bg-card max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">Apariencia</CardTitle>
            <CardDescription>Personaliza cómo se ve la aplicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Tamaño de texto</p>
              <div className="flex gap-3">
                {FONT_SIZE_OPTIONS.map((opt, i) => {
                  const previewSizes = ['text-base', 'text-xl', 'text-2xl']
                  return (
                    <button
                      key={opt.value}
                      onClick={() => applyFontSize(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 px-6 py-4 rounded-lg border-2 transition-colors',
                        fontSize === opt.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <span className={cn('font-semibold leading-none', previewSizes[i])}>
                        {opt.preview}
                      </span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                El cambio se aplica de inmediato y se recuerda al volver.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Perfil */}
      {activeTab === 'perfil' && (
        <div className="space-y-6 max-w-2xl">
          {loadingPersona ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando perfil...</span>
            </div>
          ) : !persona ? (
            <Card className="border-border bg-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin perfil asociado</p>
                <p className="text-sm mt-1">Tu cuenta aún no tiene un perfil de persona asociado. Contactá al administrador.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary card */}
              <Card className="border-border bg-card">
                <CardContent className="py-5 flex items-center gap-4">
                  <AvatarUpload
                    personaId={persona.id}
                    currentUrl={persona.foto_url}
                    initials={`${persona.nombre.charAt(0)}${persona.apellido.charAt(0)}`}
                    size="lg"
                    onUploaded={(url) => setPersona(prev => prev ? { ...prev, foto_url: url } : prev)}
                  />
                  <div>
                    <p className="font-semibold text-foreground text-lg leading-tight">{nombreCompletoConApodo(persona)}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {persona.tipo_persona && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {TIPOS_PERSONA_LABEL[persona.tipo_persona] ?? persona.tipo_persona}
                        </span>
                      )}
                      {modoActual && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                          {MODOS_LABEL[modoActual] ?? modoActual}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Datos institucionales — solo lectura (gestionados por la Administración de CcD) */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Datos institucionales
                  </CardTitle>
                  <CardDescription>
                    Estos datos los administra la comunidad y se importan desde la Administración de CcD. No son editables desde acá.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Input value={persona.tipo_persona ? (TIPOS_PERSONA_LABEL[persona.tipo_persona] ?? persona.tipo_persona) : '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={persona.estado ? persona.estado.charAt(0).toUpperCase() + persona.estado.slice(1) : '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Modo de participación</Label>
                    <Input value={modoActual ? (MODOS_LABEL[modoActual] ?? modoActual) : '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de usuario de la plataforma</Label>
                    <Input value={persona.nombre_usuario ?? '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Código Interno</Label>
                    <Input value={editForm.codigo_interno || '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mail CcD</Label>
                    <Input value={editForm.email_ccd || '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confraternidad</Label>
                    <Input value={confraternidadNombre ?? '—'} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fraternidad</Label>
                    <Input value={fraternidadNombre ?? '—'} readOnly disabled className="bg-muted" />
                  </div>
                </CardContent>

                {/* Subsección editable — la completa el propio cecista */}
                {(modoActual === 'servidor' || modoActual === 'familiar') && (
                  <CardContent className="grid gap-4 border-t border-border pt-6 md:grid-cols-2">
                    <div className={cn('md:col-span-2 space-y-1', !canEditSocioActivo && 'rounded-md bg-muted p-3')}>
                      <div className="flex items-center gap-3">
                        <input
                          id="p-socio-activo"
                          type="checkbox"
                          checked={editForm.socio_asociacion}
                          onChange={e => toggleSocioActivo(e.target.checked)}
                          disabled={editLoading || !canEditSocioActivo}
                          className="h-4 w-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <Label htmlFor="p-socio-activo" className={cn(!canEditSocioActivo && 'text-muted-foreground')}>
                          Socio Activo de la Asociación Civil
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                )}

                <CardContent className="border-t border-border pt-4">
                  <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => openCorrectionDialog('')}>
                    ¿Algo está mal? Reportalo
                  </Button>
                </CardContent>
              </Card>

              {/* Reportar dato incorrecto — abierto desde los botones de arriba */}
              <Dialog open={correctionOpen} onOpenChange={(open) => { setCorrectionOpen(open); if (!open) { setCorrectionForm({ campo: '', descripcion: '' }); setCorrectionError(null); setCorrectionSuccess(false) } }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reportar un dato incorrecto</DialogTitle>
                    <DialogDescription>
                      Estos campos los administra la comunidad. Contanos qué está mal y la Administración de CcD lo corrige.
                    </DialogDescription>
                  </DialogHeader>

                  {correctionSuccess ? (
                    <p className="text-sm text-green-600 py-4 text-center">¡Solicitud enviada! La Administración de CcD la va a revisar.</p>
                  ) : (
                    <form onSubmit={handleReportarCorreccion} className="space-y-4 py-2">
                      <div className="space-y-1">
                        <Label htmlFor="correction-campo">¿Qué dato está mal?</Label>
                        <Select
                          value={correctionForm.campo}
                          onValueChange={(value) => setCorrectionForm(prev => ({ ...prev, campo: value }))}
                          disabled={correctionLoading}
                        >
                          <SelectTrigger id="correction-campo" className="w-full">
                            <SelectValue placeholder="Elegí un campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {CAMPOS_BLOQUEADOS.map(campo => (
                              <SelectItem key={campo} value={campo}>{campo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="correction-descripcion">Contanos qué está mal</Label>
                        <Textarea
                          id="correction-descripcion"
                          value={correctionForm.descripcion}
                          onChange={(e) => setCorrectionForm(prev => ({ ...prev, descripcion: e.target.value }))}
                          placeholder="Ej.: Mi apellido figura como &quot;Gonzales&quot; y es &quot;González&quot;."
                          rows={4}
                          required
                          disabled={correctionLoading}
                        />
                      </div>

                      {correctionError && <p className="text-sm text-destructive">{correctionError}</p>}

                      <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setCorrectionOpen(false)} disabled={correctionLoading}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={correctionLoading}>
                          {correctionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>

              {/* Edit form */}
              <form onSubmit={handleSaveProfile}>
                <Card className="border-border bg-card">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-foreground flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          Datos Personales
                        </CardTitle>
                        <CardDescription>Actualizá tu información — se guarda automáticamente</CardDescription>
                      </div>
                      <SaveIndicator status={saveStatus} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* Nombre / Apellido — solo lectura (gestionado por la Administración de CcD) */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="p-nombre">Nombre</Label>
                        <Input id="p-nombre" value={editForm.nombre} readOnly disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-apellido">Apellido</Label>
                        <Input id="p-apellido" value={editForm.apellido} readOnly disabled className="bg-muted" />
                      </div>
                    </div>
                    <p className="-mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Nombre y apellido los gestiona la Administración de CcD.
                      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => openCorrectionDialog('Nombre')}>
                        ¿Están mal? Reportalo
                      </Button>
                    </p>

                    {/* Apodo / Sobrenombre */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="p-apodo">Apodo / Sobrenombre</Label>
                        <Input id="p-apodo" value={editForm.apodo} onChange={e => field('apodo', e.target.value)} disabled={editLoading} />
                      </div>
                    </div>

                    {/* Teléfono / Fecha nacimiento */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="p-telefono">Teléfono</Label>
                        <Input id="p-telefono" type="tel" value={editForm.telefono} onChange={e => field('telefono', e.target.value)} disabled={editLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-nacimiento">Fecha de Nacimiento</Label>
                        <Input id="p-nacimiento" type="date" value={editForm.fecha_nacimiento} onChange={e => field('fecha_nacimiento', e.target.value)} disabled={editLoading} />
                      </div>
                    </div>

                    {/* Mail Personal — el Mail CcD vive en Datos institucionales */}
                    <div className="space-y-2">
                      <Label htmlFor="p-email">Mail Personal</Label>
                      <Input id="p-email" type="email" value={editForm.email} onChange={e => field('email', e.target.value)} disabled={editLoading} />
                      <p className="text-xs text-muted-foreground">No afecta el acceso al sistema.</p>
                    </div>

                    {/* Tipo Documento / Nro Documento */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="p-tipo-doc">Tipo de Documento</Label>
                        <select id="p-tipo-doc" value={editForm.tipo_documento} onChange={e => field('tipo_documento', e.target.value)} disabled={editLoading} className={selectClass}>
                          <option value="">Seleccionar...</option>
                          <option value="dni">DNI</option>
                          <option value="pasaporte">Pasaporte</option>
                          <option value="cedula">Cédula</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-documento">Nro Documento</Label>
                        <Input id="p-documento" value={editForm.documento} onChange={e => field('documento', e.target.value)} disabled={editLoading} />
                      </div>
                    </div>

                    {/* Nacionalidad / País que expidió el documento */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nacionalidad</Label>
                        <Combobox
                          value={editForm.nacionalidad}
                          onSelect={val => field('nacionalidad', val)}
                          options={PAISES}
                          placeholder="Seleccionar país..."
                          searchPlaceholder="Buscar país..."
                          emptyText="País no encontrado."
                          disabled={editLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>País que expidió el documento</Label>
                        <Combobox
                          value={editForm.pais_documento}
                          onSelect={val => field('pais_documento', val)}
                          options={PAISES}
                          placeholder="Seleccionar país..."
                          searchPlaceholder="Buscar país..."
                          emptyText="País no encontrado."
                          disabled={editLoading}
                        />
                      </div>
                    </div>

                    {/* Dirección */}
                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor="p-direccion">Dirección Calle</Label>
                        <Input id="p-direccion" value={editForm.direccion} onChange={e => field('direccion', e.target.value)} disabled={editLoading} />
                      </div>
                      <div className="space-y-2 w-28">
                        <Label htmlFor="p-nro">Número</Label>
                        <Input id="p-nro" value={editForm.direccion_nro} onChange={e => field('direccion_nro', e.target.value)} disabled={editLoading} />
                      </div>
                    </div>

                    {/* LocationFields: País, Provincia, Ciudad, CP, Diócesis */}
                    <LocationFields
                      pais={editForm.pais}
                      provincia={editForm.provincia}
                      localidad={editForm.localidad}
                      codigoPostal={editForm.codigo_postal}
                      diocesis={editForm.diocesis}
                      onPaisChange={val => setEditForm(prev => ({ ...prev, pais: val, provincia: '', localidad: '' }))}
                      onProvinciaChange={val => setEditForm(prev => ({ ...prev, provincia: val, localidad: '' }))}
                      onLocalidadChange={val => setEditForm(prev => ({ ...prev, localidad: val }))}
                      onCodigoPostalChange={val => field('codigo_postal', val)}
                      onDiocesisChange={val => field('diocesis', val)}
                      disabled={editLoading}
                      paisLabel="País de residencia"
                      provinciaLabel="Provincia/Estado"
                    />

                    {/* Estado Eclesiástico / Parroquia */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="p-eclesial">Estado Eclesiástico</Label>
                        <select
                          id="p-eclesial"
                          value={editForm.estado_eclesial}
                          onChange={e => setEditForm(prev => ({ ...prev, estado_eclesial: e.target.value, estado_eclesial_rango: '', institucion_religiosa: '' }))}
                          disabled={editLoading}
                          className={selectClass}
                        >
                          {ESTADO_ECLESIAL_TOP.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-parroquia">Parroquia</Label>
                        <Input id="p-parroquia" placeholder="Ej: Parroquia San José" value={editForm.parroquia} onChange={e => field('parroquia', e.target.value)} disabled={editLoading} />
                      </div>
                    </div>

                    {editForm.estado_eclesial === 'clerigo' && (
                      <div className="space-y-2">
                        <Label htmlFor="p-eclesial-rango">Rango</Label>
                        <select id="p-eclesial-rango" value={editForm.estado_eclesial_rango} onChange={e => field('estado_eclesial_rango', e.target.value)} disabled={editLoading} className={selectClass}>
                          <option value="">Seleccionar...</option>
                          {ESTADO_ECLESIAL_RANGOS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(editForm.estado_eclesial === 'clerigo' || editForm.estado_eclesial === 'consagrado') && (
                      <div className="space-y-2">
                        <Label htmlFor="p-institucion">Institución / Congregación</Label>
                        <Input id="p-institucion" value={editForm.institucion_religiosa} onChange={e => field('institucion_religiosa', e.target.value)} disabled={editLoading} />
                      </div>
                    )}

                    {/* Ministerios que ejerce (autodeclarado, selección múltiple) */}
                    {persona.tipo_persona === 'cecista' && (
                      <div className="space-y-2">
                        <Label>Ministerios que ejerce</Label>
                        <MultiCombobox
                          values={misAreasServicio}
                          onChange={changeMisAreasServicio}
                          options={areasServicio.map(a => ({ label: a.nombre, value: a.id }))}
                          placeholder="Seleccionar ministerios..."
                          searchPlaceholder="Buscar..."
                          emptyText="No se encontraron resultados."
                          disabled={editLoading}
                        />
                        <p className="text-xs text-muted-foreground">Marcá todos los que correspondan.</p>
                        {(() => {
                          const otrosId = areasServicio.find(a => a.nombre === 'Otros')?.id
                          if (!otrosId || !misAreasServicio.includes(otrosId)) return null
                          return (
                            <div className="space-y-1 pt-1">
                              <Label htmlFor="p-otros-ministerio">¿Cuál?</Label>
                              <Input
                                id="p-otros-ministerio"
                                value={otrosComentario}
                                onChange={e => setOtrosComentarioValue(e.target.value)}
                                disabled={editLoading}
                              />
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Estado de Vida */}
                    <div className="space-y-2">
                      <Label htmlFor="p-vida">Estado Civil</Label>
                      <select id="p-vida" value={editForm.estado_vida} onChange={e => field('estado_vida', e.target.value)} disabled={editLoading} className={selectClass}>
                        <option value="">No completado</option>
                        <option value="sin_especificar">Sin especificar</option>
                        <option value="soltero">Soltero/a</option>
                        <option value="casado">Casado/a</option>
                        <option value="viudo">Viudo/a</option>
                        <option value="separado">Separado/a</option>
                        <option value="divorciado">Divorciado/a</option>
                        <option value="union_civil">Unión Civil / Unión de Hecho</option>
                        <option value="consagrado">Consagrado/a</option>
                      </select>
                    </div>

                    {/* Ocupación o Profesión */}
                    <div className="space-y-2">
                      <Label htmlFor="p-ocupacion">Ocupación o Profesión</Label>
                      <Input id="p-ocupacion" value={editForm.ocupacion} onChange={e => field('ocupacion', e.target.value)} disabled={editLoading} />
                    </div>

                    {/* Nivel Estudios */}
                    <div className="space-y-2">
                      <Label htmlFor="p-estudios">Máx. Nivel de Estudios</Label>
                      <select id="p-estudios" value={editForm.nivel_estudios} onChange={e => field('nivel_estudios', e.target.value)} disabled={editLoading} className={selectClass}>
                        <option value="">Sin especificar</option>
                        {NIVELES_ESTUDIOS.map(n => (
                          <option key={n.value} value={n.value}>{n.label}</option>
                        ))}
                      </select>
                    </div>

                    {(editForm.nivel_estudios === 'universitario' || editForm.nivel_estudios === 'terciario') && (
                      <div className="space-y-2">
                        <Label htmlFor="p-titulo">Título</Label>
                        <Input id="p-titulo" value={editForm.titulo_estudios} onChange={e => field('titulo_estudios', e.target.value)} disabled={editLoading} />
                      </div>
                    )}

                    {/* Notas */}
                    <div className="space-y-2">
                      <Label htmlFor="p-notas">Notas</Label>
                      <textarea
                        id="p-notas"
                        rows={3}
                        value={editForm.notas}
                        onChange={e => field('notas', e.target.value)}
                        disabled={editLoading}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm"
                      />
                    </div>

                    {editError && (
                      <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">
                        {editError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <SaveIndicator status={saveStatus} />
                      <Button type="submit" variant="outline" className="bg-transparent" disabled={editLoading}>
                        {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Guardar ahora
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>

              {/* Mi recorrido — recorrido de la persona en la comunidad */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-foreground">Mi recorrido</CardTitle>
                      <CardDescription>Tu recorrido en la comunidad — se guarda automáticamente</CardDescription>
                    </div>
                    <SaveIndicator status={saveStatus} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="p-anio-ingreso">Año de Ingreso a la Comunidad</Label>
                      <Input
                        id="p-anio-ingreso"
                        type="number"
                        min="1950"
                        max={new Date().getFullYear()}
                        placeholder="Ej: 2010"
                        value={editForm.anio_ingreso}
                        onChange={e => field('anio_ingreso', e.target.value)}
                        disabled={editLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-modo-ingreso">Modo de Participación al Ingreso</Label>
                      <select
                        id="p-modo-ingreso"
                        value={editForm.modo_participacion_ingreso}
                        onChange={e => field('modo_participacion_ingreso', e.target.value)}
                        disabled={editLoading}
                        className={selectClass}
                      >
                        <option value="">Sin especificar</option>
                        {Object.entries(MODOS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-anio-cambio-modo">Año del Último Cambio de Modo de Participar</Label>
                      <Input
                        id="p-anio-cambio-modo"
                        type="number"
                        min="1950"
                        max={new Date().getFullYear()}
                        placeholder="Ej: 2018"
                        value={editForm.anio_ultimo_cambio_modo}
                        onChange={e => field('anio_ultimo_cambio_modo', e.target.value)}
                        disabled={editLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Desde cuándo rige tu modo de participación actual
                        {modoActual ? ` (${MODOS_LABEL[modoActual] ?? modoActual})` : ''}.
                      </p>
                    </div>
                  </div>

                  {/* Acompañante */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="p-acompanante">Acompañante</Label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={acompananteLibreMode}
                          onChange={e => toggleAcompananteLibreMode(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        No está registrado en la plataforma
                      </label>
                    </div>
                    {acompananteLibreMode ? (
                      <Input
                        id="p-acompanante"
                        placeholder="Nombre y apellido del acompañante"
                        value={acompananteLibre}
                        onChange={e => handleAcompananteLibreChange(e.target.value)}
                      />
                    ) : (
                      <Combobox
                        value={acompananteId}
                        onSelect={handleAcompananteChange}
                        options={[
                          { label: 'Sin acompañante', value: '' },
                          ...todasPersonas.map(p => ({ label: apellidoNombreConApodo(p), value: p.id })),
                        ]}
                        placeholder="Seleccionar acompañante..."
                        searchPlaceholder="Buscar por nombre, apellido o apodo..."
                        emptyText="No se encontró la persona."
                      />
                    )}
                  </div>

                  {/* Acompaño a — se completa solo cuando otro cecista te elige como acompañante */}
                  <div className="space-y-2">
                    <Label>Acompaño a</Label>
                    <div className="flex flex-wrap gap-2">
                      {acompanados.map(a => (
                        <span
                          key={a.id}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground"
                        >
                          {a.persona ? apellidoNombreConApodo(a.persona) : ""}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se completa automáticamente cuando otro cecista te elige a vos como su acompañante.
                    </p>
                  </div>

                  {/* Casa Comunitaria (relación 1→1, solo cecistas) */}
                  {persona.tipo_persona === 'cecista' && (
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="p-casa" className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-primary" />
                        Casa Comunitaria
                      </Label>
                      <Combobox
                        id="p-casa"
                        value={casaId}
                        onSelect={persistCasa}
                        options={casas.map(c => ({ label: c.nombre, value: c.id }))}
                        placeholder="Sin casa comunitaria"
                        searchPlaceholder="Buscar casa comunitaria..."
                        emptyText="No se encontraron casas comunitarias."
                      />
                      {casas.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Todavía no hay casas comunitarias cargadas. Pedile a un administrador que las dé de alta.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>

                {/* Convivencias, Retiros y Talleres realizados — cierra la sección */}
                {persona.tipo_persona === 'cecista' && (
                  <CardContent className="space-y-3 border-t border-border pt-6">
                    <div>
                      <h3 className="font-medium text-foreground">Convivencias, Retiros y Talleres realizados</h3>
                      <p className="text-sm text-muted-foreground">Marcá los que hayas hecho e indicá el año (opcional).</p>
                    </div>
                    {tiposEventos.length === 0 && (
                      <p className="text-xs text-muted-foreground">No hay tipos de retiro cargados todavía.</p>
                    )}
                    {tiposEventos.map(t => {
                      const ev = eventosRealizados[t.id] ?? { checked: false, anio: '' }
                      return (
                        <div key={t.id} className="flex items-center gap-3">
                          <input
                            id={`evt-${t.id}`}
                            type="checkbox"
                            checked={ev.checked}
                            onChange={e => toggleEventoRealizado(t.id, e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <Label htmlFor={`evt-${t.id}`} className="flex-1">{nombreLegible(t.nombre)}</Label>
                          <Input
                            type="number"
                            min="1950"
                            max={new Date().getFullYear()}
                            placeholder="Año"
                            value={ev.anio}
                            onChange={e => setEventoRealizadoAnio(t.id, e.target.value)}
                            disabled={!ev.checked}
                            className="w-32"
                          />
                        </div>
                      )
                    })}
                  </CardContent>
                )}
              </Card>

              {/* Dedicación — dedicaciones + votos (solo cecistas) */}
              {persona.tipo_persona === 'cecista' && (
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-foreground">Dedicación</CardTitle>
                    <CardDescription>Tu dedicación y los votos que asumiste.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="font-medium text-foreground">Dedicación</h3>
                      <p className="text-sm text-muted-foreground">Marcá las que correspondan e indicá el año de inicio.</p>
                    </div>
                    {DEDICACION_TIPOS.map(t => {
                      const ded = dedicaciones[t.value] ?? { checked: false, anio: '', votos: [] }
                      const esComoSi = t.value === DEDICACION_VIVIENDO_COMO_SI
                      return (
                        <div key={t.value} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <input
                              id={`ded-${t.value}`}
                              type="checkbox"
                              checked={ded.checked}
                              onChange={e => toggleDedicacion(t.value, e.target.checked)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <Label htmlFor={`ded-${t.value}`} className="flex-1">{t.label}</Label>
                            <Input
                              type="number"
                              min="1950"
                              max={new Date().getFullYear()}
                              placeholder="Año inicio"
                              value={ded.anio}
                              onChange={e => setDedicacionAnio(t.value, e.target.value)}
                              disabled={!ded.checked}
                              className="w-32"
                            />
                          </div>
                          {esComoSi && ded.checked && (
                            <div className="ml-7 space-y-2">
                              <Label className="text-sm text-muted-foreground">
                                ¿Qué votos estás viviendo “como si”?
                              </Label>
                              <MultiCombobox
                                values={ded.votos}
                                onChange={vals => setDedicacionVotos(t.value, vals)}
                                options={VOTO_TIPOS}
                                placeholder="Seleccioná los votos"
                                searchPlaceholder="Buscar voto..."
                                emptyText="No se encontraron votos."
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>

                  <CardContent className="space-y-3 border-t border-border pt-6">
                    <div>
                      <h3 className="font-medium text-foreground">Votos</h3>
                      <p className="text-sm text-muted-foreground">
                        Indicá el año del voto. Si es perpetuo marcalo; si es temporal, la cantidad de años.
                      </p>
                    </div>
                    {VOTO_TIPOS.map(t => {
                      const v = votos[t.value] ?? { anio: '', perpetuo: false, temporal: '' }
                      return (
                        <div key={t.value} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                          <Label className="text-sm">{t.label}</Label>
                          <Input
                            type="number"
                            min="1950"
                            max={new Date().getFullYear()}
                            placeholder="Año"
                            value={v.anio}
                            onChange={e => changeVoto(t.value, { anio: e.target.value }, false)}
                            className="w-24"
                          />
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={v.perpetuo}
                              onChange={e => changeVoto(t.value, { perpetuo: e.target.checked, ...(e.target.checked ? { temporal: '' } : {}) }, true)}
                              className="h-4 w-4 rounded border-border"
                            />
                            Perpetuo
                          </label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Años (temp.)"
                            value={v.temporal}
                            onChange={e => changeVoto(t.value, { temporal: e.target.value }, false)}
                            disabled={v.perpetuo}
                            className="w-28"
                          />
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Security */}
      {activeTab === 'seguridad' && (
        <Card className="border-border bg-card max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-primary" />
              Seguridad
            </CardTitle>
            <CardDescription>Administra la seguridad de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-4">
              <h3 className="font-medium text-foreground mb-2">Cambiar Contraseña</h3>
              <p className="text-sm text-muted-foreground mb-4">Actualiza tu contraseña regularmente para mantener tu cuenta segura</p>
              <Button variant="outline" className="bg-transparent" onClick={() => { setPwOpen(true); setPwError(null); setPwSuccess(false) }}>
                Cambiar Contraseña
              </Button>

              <Dialog open={pwOpen} onOpenChange={(open) => { setPwOpen(open); if (!open) { setPwForm({ actual: '', nueva: '', confirmar: '' }); setPwError(null); setPwSuccess(false) } }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cambiar Contraseña</DialogTitle>
                    <DialogDescription>Ingresá tu contraseña actual y la nueva contraseña dos veces para confirmar.</DialogDescription>
                  </DialogHeader>

                  {pwSuccess ? (
                    <p className="text-sm text-green-600 py-4 text-center">¡Contraseña actualizada correctamente!</p>
                  ) : (
                    <form onSubmit={handlePasswordChange} className="space-y-4 py-2">
                      <div className="space-y-1">
                        <Label htmlFor="pw-actual">Contraseña Actual</Label>
                        <div className="relative">
                          <Input
                            id="pw-actual"
                            type={showPw.actual ? 'text' : 'password'}
                            value={pwForm.actual}
                            onChange={(e) => setPwForm(prev => ({ ...prev, actual: e.target.value }))}
                            required
                            disabled={pwLoading}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPw(prev => ({ ...prev, actual: !prev.actual }))}
                            tabIndex={-1}
                          >
                            {showPw.actual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="pw-nueva">Nueva Contraseña</Label>
                        <div className="relative">
                          <Input
                            id="pw-nueva"
                            type={showPw.nueva ? 'text' : 'password'}
                            value={pwForm.nueva}
                            onChange={(e) => setPwForm(prev => ({ ...prev, nueva: e.target.value }))}
                            required
                            disabled={pwLoading}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPw(prev => ({ ...prev, nueva: !prev.nueva }))}
                            tabIndex={-1}
                          >
                            {showPw.nueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="pw-confirmar">Confirmar Nueva Contraseña</Label>
                        <div className="relative">
                          <Input
                            id="pw-confirmar"
                            type={showPw.confirmar ? 'text' : 'password'}
                            value={pwForm.confirmar}
                            onChange={(e) => setPwForm(prev => ({ ...prev, confirmar: e.target.value }))}
                            required
                            disabled={pwLoading}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPw(prev => ({ ...prev, confirmar: !prev.confirmar }))}
                            tabIndex={-1}
                          >
                            {showPw.confirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {pwError && <p className="text-sm text-destructive">{pwError}</p>}

                      <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setPwOpen(false)} disabled={pwLoading}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={pwLoading}>
                          {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// OJO: `canPerform` se importa de permissions, no de context — este archivo lo
// usa el navegador y context arrastra el cliente de servidor (next/headers).
import type { UserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'
import { esCentralizadorDeEvento } from '@/lib/eventos/cierre'

// Datos que se piden al inscribirse a una convivencia (card #42, Excel "Datos
// para Inscribirse VERIFICADO"). Este archivo no toca la base: lo importan
// tanto el formulario público como el servidor. El acceso a la tabla cerrada
// `evento_inscripcion_datos` (migración 090) está en inscripcion-datos-server.ts.

// ─── Opciones ────────────────────────────────────────────────────────────────
// Las listas las propuso desarrollo a partir de las respuestas del formulario
// anterior; la comunidad las puede ajustar acá sin tocar la base.

export const SEXOS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  // Requiere la migración 093 (CHECK de personas.sexo).
  { value: 'prefiero_no_decirlo', label: 'Prefiero no decirlo' },
] as const

// Mismas opciones que el perfil de cecistas (/settings).
export const ESTADOS_CIVILES = [
  { value: 'sin_especificar', label: 'Sin especificar' },
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'viudo', label: 'Viudo/a' },
  { value: 'separado', label: 'Separado/a' },
  { value: 'divorciado', label: 'Divorciado/a' },
  { value: 'union_civil', label: 'Unión Civil / Unión de Hecho' },
  { value: 'consagrado', label: 'Consagrado/a' },
] as const

export const NIVELES_ESTUDIOS = [
  { value: 'primario', label: 'Primario' },
  { value: 'secundario', label: 'Secundario' },
  { value: 'terciario', label: 'Terciario' },
  { value: 'universitario', label: 'Universitario' },
  { value: 'posgrado_doctorado', label: 'Posgrado / Doctorado' },
] as const

export const ESTADOS_ECLESIALES = [
  { value: 'laico', label: 'Laico/a' },
  { value: 'clerigo', label: 'Clérigo' },
  { value: 'consagrado', label: 'Consagrado/a' },
] as const

// Segundo nivel del estado eclesial, solo para clérigos (050 + 094).
export const ESTADO_ECLESIAL_RANGOS = [
  { value: 'obispo', label: 'Obispo' },
  { value: 'presbitero', label: 'Sacerdote (Presbítero)' },
  { value: 'cardenal', label: 'Cardenal' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'seminarista', label: 'Seminarista' },
  { value: 'diacono_permanente', label: 'Diácono permanente' },
] as const

export const COMO_SE_ENTERO = [
  { value: 'noticias_ccd', label: 'Noticias de las CcD' },
  { value: 'invitacion_personal', label: 'Invitación personal' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'parroquia', label: 'Parroquia' },
  { value: 'otro', label: 'Otro' },
] as const

export const RESTRICCIONES_ALIMENTARIAS = [
  { value: 'ninguna', label: 'Ninguna' },
  { value: 'celiaco', label: 'Celíaco (sin TACC)' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'diabetico', label: 'Diabético' },
  { value: 'sin_sal', label: 'Sin sal' },
  { value: 'lactosa', label: 'Intolerancia a la lactosa' },
  { value: 'otra', label: 'Otra' },
] as const

function labelDe(opciones: readonly { value: string; label: string }[], valor: string | null | undefined): string {
  if (!valor) return ''
  return opciones.find(o => o.value === valor)?.label ?? valor
}

export const labelSexo = (v: string | null | undefined) => labelDe(SEXOS, v)
export const labelEstadoCivil = (v: string | null | undefined) => labelDe(ESTADOS_CIVILES, v)
export const labelNivelEstudios = (v: string | null | undefined) => labelDe(NIVELES_ESTUDIOS, v)
export const labelEstadoEclesial = (v: string | null | undefined) => labelDe(ESTADOS_ECLESIALES, v)
export const labelRangoEclesial = (v: string | null | undefined) => labelDe(ESTADO_ECLESIAL_RANGOS, v)
export const labelComoSeEntero = (v: string | null | undefined) => labelDe(COMO_SE_ENTERO, v)
export const labelRestriccion = (v: string) => labelDe(RESTRICCIONES_ALIMENTARIAS, v)

// ─── Datos de la persona que completa el link ────────────────────────────────

/**
 * Columnas de `personas` que el link público puede completar. Regla de siempre:
 * solo se escribe lo que hoy está vacío (ver route de /api/public/inscripcion).
 */
export const CAMPOS_PERSONA_INSCRIPCION = [
  'telefono',
  'tipo_documento',
  'documento',
  'fecha_nacimiento',
  'direccion',
  'direccion_nro',
  'localidad',
  'codigo_postal',
  'provincia',
  'pais',
  'apodo',
  'sexo',
  'estado_vida',
  'nacionalidad',
  'nivel_estudios',
  'ocupacion',
  'diocesis',
  'formacion_religiosa',
  'participacion_grupos_iglesia',
  'accion_social',
] as const

export type CampoPersonaInscripcion = (typeof CAMPOS_PERSONA_INSCRIPCION)[number]

/**
 * Todos los campos de la persona son obligatorios en el link (card #42). El
 * nombre de cada uno es el que ve la persona cuando le falta alguno.
 */
export const LABELS_CAMPO_PERSONA: Record<CampoPersonaInscripcion, string> = {
  telefono: 'Teléfono celular',
  tipo_documento: 'Tipo de documento',
  documento: 'Número de documento',
  fecha_nacimiento: 'Fecha de nacimiento',
  direccion: 'Domicilio',
  direccion_nro: 'Número, piso, dto.',
  localidad: 'Localidad',
  codigo_postal: 'Código postal',
  provincia: 'Provincia',
  pais: 'País',
  apodo: 'Sobrenombre',
  sexo: 'Sexo',
  estado_vida: 'Estado civil',
  nacionalidad: 'Nacionalidad',
  nivel_estudios: 'Nivel de estudios',
  ocupacion: 'Ocupación o profesión',
  diocesis: 'Diócesis',
  formacion_religiosa: 'Formación religiosa',
  participacion_grupos_iglesia: 'Participación en grupos de la Iglesia',
  accion_social: 'Otros grupos de acción social',
}

/** Un valor de la ficha cuenta como cargado. El estado civil "sin especificar" cuenta como vacío. */
export function campoPersonaCompleto(campo: CampoPersonaInscripcion, valor: unknown): boolean {
  if (typeof valor !== 'string' || valor.trim() === '') return false
  return !(campo === 'estado_vida' && valor === 'sin_especificar')
}

/** Valores admitidos de los campos de `personas` que son de opción. */
export const OPCIONES_CAMPO_PERSONA: Partial<Record<CampoPersonaInscripcion, readonly string[]>> = {
  tipo_documento: ['dni', 'pasaporte', 'cedula', 'otro'],
  sexo: SEXOS.map(o => o.value),
  estado_vida: ESTADOS_CIVILES.map(o => o.value),
  nivel_estudios: NIVELES_ESTUDIOS.map(o => o.value),
}

// ─── Datos de la inscripción ─────────────────────────────────────────────────

export type InscripcionDatos = {
  acompanante: string | null
  dificultad_horario: string | null
  como_se_entero: string | null
  como_se_entero_otro: string | null
  familia_hizo_convivencias: boolean | null
  familia_quien: string | null
  restricciones_alimentarias: string[]
  dieta_detalle: string | null
  salud_observaciones: string | null
}

export const INSCRIPCION_DATOS_VACIA: InscripcionDatos = {
  acompanante: null,
  dificultad_horario: null,
  como_se_entero: null,
  como_se_entero_otro: null,
  familia_hizo_convivencias: null,
  familia_quien: null,
  restricciones_alimentarias: [],
  dieta_detalle: null,
  salud_observaciones: null,
}

const MAX_TEXTO = 2000

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, MAX_TEXTO) : null
}

/**
 * Valida y normaliza lo que manda el formulario público. Devuelve `error` con
 * un mensaje para la persona, o los datos listos para guardar. No confía en
 * nada del cliente: opciones fuera de lista se rechazan, lo demás se recorta.
 */
export function normalizarInscripcionDatos(
  raw: unknown,
): { datos: InscripcionDatos; error: null } | { datos: null; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  // Todas las preguntas son obligatorias (card #42). Las de Sí/No llegan como
  // booleano aparte: con "No" el texto queda en null, con "Sí" es obligatorio.
  const comoSeEntero = texto(r.como_se_entero)
  if (!comoSeEntero) {
    return { datos: null, error: 'Contanos cómo te enteraste de esta convivencia.' }
  }
  if (!COMO_SE_ENTERO.some(o => o.value === comoSeEntero)) {
    return { datos: null, error: 'Opción inválida en "¿Cómo te enteraste?".' }
  }
  if (comoSeEntero === 'otro' && !texto(r.como_se_entero_otro)) {
    return { datos: null, error: 'Contanos cómo te enteraste de esta convivencia.' }
  }

  const siNo = (
    clave: string,
    campoTexto: string,
    pregunta: string,
  ): { valor: string | null; error: null } | { valor: null; error: string } => {
    const v = r[clave]
    if (typeof v !== 'boolean') return { valor: null, error: `Respondé "${pregunta}".` }
    if (!v) return { valor: null, error: null }
    const t = texto(r[campoTexto])
    if (!t) return { valor: null, error: `Completá el detalle de "${pregunta}".` }
    return { valor: t, error: null }
  }

  const familiaResp = siNo('familia_hizo_convivencias', 'familia_quien', '¿Alguien más de tu familia hizo convivencias?')
  if (familiaResp.error !== null) return { datos: null, error: familiaResp.error }
  const acompanante = siNo('viene_acompanado', 'acompanante', '¿Asistirás con algún familiar, amigo o conocido?')
  if (acompanante.error !== null) return { datos: null, error: acompanante.error }
  const dificultad = siNo('tiene_dificultad_horario', 'dificultad_horario', '¿Se te presentará alguna dificultad en el horario?')
  if (dificultad.error !== null) return { datos: null, error: dificultad.error }
  const salud = siNo('tiene_salud_observaciones', 'salud_observaciones', '¿Hay algo importante que tengamos que saber?')
  if (salud.error !== null) return { datos: null, error: salud.error }

  const validas = RESTRICCIONES_ALIMENTARIAS.map(o => o.value) as string[]
  const restricciones = Array.isArray(r.restricciones_alimentarias)
    ? [...new Set(r.restricciones_alimentarias.filter((v): v is string => typeof v === 'string'))]
    : []
  if (restricciones.some(v => !validas.includes(v))) {
    return { datos: null, error: 'Opción inválida en las restricciones alimentarias.' }
  }
  if (restricciones.length === 0) {
    return { datos: null, error: 'Indicá si tenés alguna restricción alimentaria (o marcá "Ninguna").' }
  }
  // "Ninguna" no convive con otras: si marcó algo más, gana lo más restrictivo.
  const restriccionesFinal =
    restricciones.length > 1 ? restricciones.filter(v => v !== 'ninguna') : restricciones
  // Con cualquier restricción que no sea "Ninguna", el detalle es obligatorio.
  const tieneRestriccion = restriccionesFinal.some(v => v !== 'ninguna')
  const dietaDetalle = tieneRestriccion ? texto(r.dieta_detalle) : null
  if (tieneRestriccion && !dietaDetalle) {
    return { datos: null, error: 'Especificá el detalle de tu restricción alimentaria.' }
  }

  return {
    error: null,
    datos: {
      acompanante: acompanante.valor,
      dificultad_horario: dificultad.valor,
      como_se_entero: comoSeEntero,
      como_se_entero_otro: comoSeEntero === 'otro' ? texto(r.como_se_entero_otro) : null,
      familia_hizo_convivencias: r.familia_hizo_convivencias as boolean,
      familia_quien: familiaResp.valor,
      restricciones_alimentarias: restriccionesFinal,
      dieta_detalle: dietaDetalle,
      salud_observaciones: salud.valor,
    },
  }
}

// ─── Convivencias, retiros y talleres realizados ─────────────────────────────
// Son de la persona, no de la inscripción: van a persona_eventos_realizados,
// la misma tabla que llena el perfil del cecista.

export type EventoRealizado = { tipo_evento_id: string; anio: number | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normaliza el checklist que manda el formulario. Los ids se validan contra el catálogo en el servidor. */
export function normalizarEventosRealizados(
  raw: unknown,
): { eventos: EventoRealizado[]; error: null } | { eventos: null; error: string } {
  if (!Array.isArray(raw)) return { eventos: [], error: null }
  const eventos: EventoRealizado[] = []
  const anioMax = new Date().getFullYear()
  for (const item of raw.slice(0, 60)) {
    const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    if (typeof c.tipo_evento_id !== 'string' || !UUID_RE.test(c.tipo_evento_id)) continue
    if (eventos.some(e => e.tipo_evento_id === c.tipo_evento_id)) continue
    // El año es obligatorio para lo que se tilda (card #42).
    const anioTexto = c.anio == null ? '' : String(c.anio).trim()
    if (!anioTexto) {
      return { eventos: null, error: 'Indicá el año de cada convivencia, retiro o taller que marcaste.' }
    }
    const anio = Number(anioTexto)
    if (!Number.isInteger(anio) || anio < 1950 || anio > anioMax) {
      return { eventos: null, error: 'Hay un año inválido en las convivencias realizadas.' }
    }
    eventos.push({ tipo_evento_id: c.tipo_evento_id, anio })
  }
  return { eventos, error: null }
}

// ─── Autorización ────────────────────────────────────────────────────────────

export type EventoInscripcionScope = {
  organizacion_id: string | null
  fraternidad_id: string | null
  coordinador_asignado_id: string | null
  centralizador_1_persona_id: string | null
  centralizador_2_persona_id: string | null
  centralizador_3_persona_id: string | null
}

/**
 * Puede ver la dieta y las observaciones de salud de los inscriptos: el
 * coordinador y los centralizadores del evento (los necesitan para recibir a
 * la gente) y quien tenga `inscripcion.view_datos_sensibles` scopeado
 * (asignable desde el catálogo).
 */
export function canVerDatosSensiblesInscripcion(ctx: UserContext | null, evento: EventoInscripcionScope): boolean {
  if (!ctx) return false
  return (
    (!!ctx.persona_id && ctx.persona_id === evento.coordinador_asignado_id) ||
    esCentralizadorDeEvento(ctx, evento) ||
    canPerform(ctx, 'inscripcion.view_datos_sensibles', evento.organizacion_id) ||
    (evento.fraternidad_id ? canPerform(ctx, 'inscripcion.view_datos_sensibles', evento.fraternidad_id) : false)
  )
}

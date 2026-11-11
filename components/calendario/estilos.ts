// Colores por tipo de evento. Los eventos donde el usuario tiene un rol van
// "sólidos" (como un evento propio en Google Calendar); el resto, en tono suave.
// Las clases van completas (sin interpolar) para que Tailwind las detecte.

type EstiloTipo = {
  solido: string
  suave: string
  punto: string
  texto: string
}

const ESTILOS: Record<string, EstiloTipo> = {
  convivencia: {
    solido: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-blue-950',
    suave:
      'bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900',
    punto: 'bg-blue-600 dark:bg-blue-500',
    texto: 'text-blue-700 dark:text-blue-300',
  },
  retiro: {
    solido:
      'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950',
    suave:
      'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900',
    punto: 'bg-emerald-600 dark:bg-emerald-500',
    texto: 'text-emerald-700 dark:text-emerald-300',
  },
  taller: {
    solido: 'bg-amber-500 text-amber-950 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-300',
    suave:
      'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900',
    punto: 'bg-amber-500 dark:bg-amber-400',
    texto: 'text-amber-700 dark:text-amber-300',
  },
  encuentro: {
    solido:
      'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400 dark:text-violet-950',
    suave:
      'bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900',
    punto: 'bg-violet-600 dark:bg-violet-500',
    texto: 'text-violet-700 dark:text-violet-300',
  },
}

const ESTILO_OTRO: EstiloTipo = {
  solido: 'bg-slate-600 text-white hover:bg-slate-700 dark:bg-slate-400 dark:hover:bg-slate-300 dark:text-slate-950',
  suave:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  punto: 'bg-slate-600 dark:bg-slate-400',
  texto: 'text-slate-700 dark:text-slate-300',
}

export function estiloTipo(tipo: string): EstiloTipo {
  return ESTILOS[tipo] ?? ESTILO_OTRO
}

export const TIPOS_LEYENDA = ['convivencia', 'retiro', 'taller', 'encuentro'] as const

export const ESTADO_BADGE: Record<string, string> = {
  aprobado: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  publicado: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  en_curso: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  finalizado: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  cerrado: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  suspendido: 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
}
export const ESTADO_BADGE_TRAMITE = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'

import {
  MENSAJE_ASIGNACION_DUPLICADA_GENERICO,
  esErrorAsignacionDuplicada,
} from '@/lib/ministerios/asignacion-duplicada'

export function translateSupabaseError(message: string): string {
  if (/duplicate key value violates unique constraint/i.test(message)) {
    if (esErrorAsignacionDuplicada(message)) return MENSAJE_ASIGNACION_DUPLICADA_GENERICO
    if (/email/i.test(message)) return 'Ya existe una persona con ese email.'
    if (/documento/i.test(message)) return 'Ya existe una persona con ese número de documento.'
    if (/nombre_usuario/i.test(message)) return 'Ese nombre de usuario ya está en uso.'
    return 'Ya existe un registro con esos datos. Verificá si ya fue cargado.'
  }
  if (/violates foreign key constraint/i.test(message)) {
    return 'No se puede completar la operación porque hace referencia a un registro que no existe.'
  }
  if (/violates not-null constraint/i.test(message)) {
    return 'Falta un campo obligatorio.'
  }
  if (/value too long for type/i.test(message)) {
    return 'Uno de los valores ingresados es demasiado largo.'
  }
  if (/invalid input syntax/i.test(message)) {
    return 'Uno de los valores ingresados tiene un formato inválido.'
  }
  return message
}

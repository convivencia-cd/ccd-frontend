// Ejecutar: node --test tests/inscripcion-datos.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers/load-ts.cjs')
const {
  CAMPOS_PERSONA_INSCRIPCION,
  RESTRICCIONES_ALIMENTARIAS,
  campoPersonaCompleto,
  normalizarEventosRealizados,
  normalizarInscripcionDatos,
} = load('lib/eventos/inscripcion-datos.ts', {
  '@/lib/auth/permissions': {},
  '@/lib/eventos/cierre': {},
})

const respuestas = (extra = {}) => ({
  como_se_entero: 'invitacion_personal',
  familia_hizo_convivencias: false,
  viene_acompanado: false,
  tiene_dificultad_horario: false,
  tiene_salud_observaciones: false,
  restricciones_alimentarias: ['ninguna'],
  ...extra,
})

test('todos los datos de la persona rechazan valores vacíos o espacios', () => {
  for (const campo of CAMPOS_PERSONA_INSCRIPCION) {
    for (const valor of [null, undefined, '', '   ']) {
      assert.equal(campoPersonaCompleto(campo, valor), false, campo)
    }
    assert.equal(campoPersonaCompleto(campo, 'Dato completo'), true, campo)
  }
  assert.equal(campoPersonaCompleto('estado_vida', 'sin_especificar'), false)
})

test('cómo se enteró es obligatorio y Otro requiere un detalle', () => {
  for (const extra of [{ como_se_entero: '' }, { como_se_entero: 'otro' },
    { como_se_entero: 'otro', como_se_entero_otro: '   ' }]) {
    assert.ok(normalizarInscripcionDatos(respuestas(extra)).error)
  }
  const resultado = normalizarInscripcionDatos(respuestas({
    como_se_entero: 'otro', como_se_entero_otro: ' Una invitación ',
  }))
  assert.equal(resultado.error, null)
  assert.equal(resultado.datos.como_se_entero_otro, 'Una invitación')
})

for (const [pregunta, detalle] of [
  ['familia_hizo_convivencias', 'familia_quien'],
  ['viene_acompanado', 'acompanante'],
  ['tiene_dificultad_horario', 'dificultad_horario'],
  ['tiene_salud_observaciones', 'salud_observaciones'],
]) {
  test(`${pregunta}: exige Sí/No y detalle solo al responder Sí`, () => {
    for (const valor of [null, undefined, '', 'si', 'no']) {
      assert.ok(normalizarInscripcionDatos(respuestas({ [pregunta]: valor })).error)
    }
    for (const valor of [null, undefined, '', '   ']) {
      assert.ok(normalizarInscripcionDatos(respuestas({ [pregunta]: true, [detalle]: valor })).error)
    }
    const si = normalizarInscripcionDatos(respuestas({ [pregunta]: true, [detalle]: ' Detalle ' }))
    assert.equal(si.error, null)
    assert.equal(si.datos[detalle], 'Detalle')
    const no = normalizarInscripcionDatos(respuestas({ [pregunta]: false, [detalle]: 'Detalle anterior' }))
    assert.equal(no.error, null)
    assert.equal(no.datos[detalle], null)
  })
}

test('cada restricción alimentaria requiere detalle salvo Ninguna', () => {
  assert.ok(normalizarInscripcionDatos(respuestas({ restricciones_alimentarias: [] })).error)
  assert.equal(normalizarInscripcionDatos(respuestas()).error, null)
  for (const opcion of RESTRICCIONES_ALIMENTARIAS.filter(o => o.value !== 'ninguna')) {
    for (const detalle of [undefined, '', '   ']) {
      assert.ok(normalizarInscripcionDatos(respuestas({
        restricciones_alimentarias: [opcion.value], dieta_detalle: detalle,
      })).error, opcion.value)
    }
    const resultado = normalizarInscripcionDatos(respuestas({
      restricciones_alimentarias: [opcion.value], dieta_detalle: ' Detalle de dieta ',
    }))
    assert.equal(resultado.error, null, opcion.value)
    assert.equal(resultado.datos.dieta_detalle, 'Detalle de dieta')
  }
  const ninguna = normalizarInscripcionDatos(respuestas({ dieta_detalle: 'Detalle anterior' }))
  assert.equal(ninguna.datos.dieta_detalle, null)
})

test('Ninguna no permite omitir el detalle si también hay una restricción', () => {
  assert.ok(normalizarInscripcionDatos(respuestas({
    restricciones_alimentarias: ['ninguna', 'celiaco'],
  })).error)
  const resultado = normalizarInscripcionDatos(respuestas({
    restricciones_alimentarias: ['ninguna', 'celiaco'], dieta_detalle: 'Sin TACC',
  }))
  assert.deepEqual(resultado.datos.restricciones_alimentarias, ['celiaco'])
})

test('convivencias, retiros y talleres son opcionales; al marcar uno, su año es obligatorio', () => {
  const tipo_evento_id = '12345678-1234-1234-1234-123456789abc'
  assert.deepEqual(normalizarEventosRealizados([]), { eventos: [], error: null })
  for (const anio of [null, undefined, '', '   ', 1949, new Date().getFullYear() + 1, '2020.5']) {
    assert.ok(normalizarEventosRealizados([{ tipo_evento_id, anio }]).error)
  }
  const resultado = normalizarEventosRealizados([{ tipo_evento_id, anio: '2020' }])
  assert.equal(resultado.error, null)
  assert.deepEqual(resultado.eventos, [{ tipo_evento_id, anio: 2020 }])
})

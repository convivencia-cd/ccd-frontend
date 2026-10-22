// Ejecutar: node --test tests/evento-estado.test.cjs
// Compila solo los módulos bajo prueba; no carga Next ni envía correos reales.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers/load-ts.cjs')

const { isSendableAddress } = load('lib/email/config.ts')
const { getPublicOrigin } = load('lib/http.ts')
const render = load('lib/email/render.ts')
const { eventoCambioEstado } = load('lib/email/templates.ts', {
  '@/lib/eventos/cierre': {}, '@/lib/utils': {}, './render': render,
  './template': { defineTemplate: template => template },
})

// Cliente en memoria: ejecuta filtros, fechas y actualización condicional.
function database(tables, failure = null) {
  const calls = []
  return { calls, from(table) {
    const filters = []
    let updates
    let inserted
    const value = (row, key) => key.split('.').reduce((v, k) => v?.[k], row)
    const query = {
      select() { return this },
      eq(key, expected) { filters.push(row => value(row, key) === expected); return this },
      in(key, values) { filters.push(row => values.includes(value(row, key))); return this },
      or(expression) {
        filters.push(row => expression.split(',').some(condition => {
          const [key, op, expected] = condition.split('.')
          const actual = value(row, key)
          if (op === 'is') return actual == null
          if (actual == null) return false
          return op === 'lte' ? actual <= expected : actual > expected
        }))
        return this
      },
      update(data) { updates = data; return this },
      insert(data) { inserted = data; return this },
      result(single = false) {
        calls.push({ table, updates })
        if (failure) return { data: null, error: { message: failure } }
        const rows = (tables[table] ?? []).filter(row => filters.every(f => f(row)))
        if (updates) rows.forEach(row => Object.assign(row, updates))
        if (inserted) (tables[table] ??= []).push(inserted)
        return { data: single ? rows[0] ?? null : rows, error: null }
      },
      maybeSingle() { return Promise.resolve(this.result(true)) },
      single() { return this.maybeSingle() },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject) },
    }
    return query
  } }
}

const evento = () => ({
  id: 'retiro', nombre: 'CONVIVENCIA DIOS AMOR - Buenos Aires - 16/10/2026',
  estado: 'solicitud', organizacion_id: 'confra', fraternidad_id: 'frater',
  coordinador_asignado_id: 'coordinador',
})
function fixture() {
  const assignment = (persona_id, codigo_interno, organizacion_id, extra = {}) => ({
    persona_id, organizacion_id, estado: 'activo', fecha_inicio: '2020-01-01', fecha_fin: null,
    ministerio: { codigo_interno, activo: true }, ...extra,
  })
  return {
    organizaciones: [{ id: 'frater', parent_id: 'confra' }, { id: 'confra', parent_id: null }],
    asignaciones_ministerio: [
      assignment('enlace', 'EFRATER', 'frater'), assignment('responsable', 'RCONFRA', 'confra'),
      assignment('timonel', 'TIMON', 'eqt'), assignment('delegado', 'DEQT', 'frater'),
      assignment('coordinador', 'EFRATER', 'frater'), assignment('duplicado', 'RCONFRA', 'confra'),
      assignment('ajeno', 'EFRATER', 'otra-fraternidad'), assignment('otro', 'RCONFRA', 'otra-confra'),
      assignment('vencido', 'EFRATER', 'frater', { fecha_fin: '2020-01-01' }),
      assignment('futuro', 'EFRATER', 'frater', { fecha_inicio: '2999-01-01' }),
      assignment('inactivo', 'DEQT', 'frater', { estado: 'inactivo' }),
      assignment('interno', 'EFRATER', 'frater'), assignment('sin-email', 'EFRATER', 'frater'),
      assignment('baja', 'EFRATER', 'frater'), assignment('asesor', 'ASES', 'frater'),
    ],
    personas: ['enlace', 'responsable', 'timonel', 'delegado', 'coordinador', 'ajeno', 'otro',
      'vencido', 'futuro', 'inactivo', 'interno', 'sin-email', 'baja', 'asesor', 'duplicado'].map(id => ({
      id, estado: id === 'baja' ? 'inactivo' : 'activo',
      email: id === 'interno' ? 'login@ccd.internal' : id === 'sin-email' ? null :
        id === 'duplicado' ? ' ENLACE@EXAMPLE.COM ' : `${id}@example.com`,
    })),
    eventos: [evento()],
  }
}
function notifier(db, send = async () => ({ ok: true })) {
  return load('lib/eventos/notificar-estado.ts', {
    '@supabase/supabase-js': { createClient: () => db },
    '@/lib/email': { isSendableAddress, sendTemplateEmailBatch: send, templates: { eventoCambioEstado } },
  })
}
function updater(db, sent) {
  return load('lib/eventos/actualizar-estado.ts', {
    '@/lib/http': { getPublicOrigin },
    './notificar-estado': { notificarCambioEstadoRetiro: async (...args) => sent.push(args) },
  }).actualizarEstadoEvento
}
const request = () => new Request('https://plataforma.example.com/api/eventos/retiro/estado')

test('destinatarios: cinco roles, alcance, vigencia, direcciones y deduplicación', async () => {
  const db = database(fixture())
  const emails = await notifier(db).destinatariosCambioEstado(db, evento())
  assert.deepEqual(emails.sort(), ['enlace', 'responsable', 'timonel', 'delegado', 'coordinador']
    .map(id => `${id}@example.com`).sort())
})

test('resuelve responsables del padre cuando el retiro solo tiene fraternidad', async () => {
  const db = database(fixture())
  const emails = await notifier(db).destinatariosCambioEstado(db, { ...evento(), organizacion_id: null })
  assert.ok(emails.includes('responsable@example.com'))
})

test('sin organización ni coordinador solo notifica al timonel global', async () => {
  const db = database(fixture())
  const emails = await notifier(db).destinatariosCambioEstado(db, {
    ...evento(), organizacion_id: null, fraternidad_id: null, coordinador_asignado_id: null,
  })
  assert.deepEqual(emails, ['timonel@example.com'])
})

test('envía un correo privado por dirección con el nombre completo y enlace interno', async () => {
  const batches = []
  const db = database(fixture())
  await notifier(db, async (template, entries) => { batches.push({ template, entries }); return { ok: true } })
    .notificarCambioEstadoRetiro(evento(), 'https://plataforma.example.com')
  assert.equal(batches.length, 1)
  assert.equal(batches[0].entries.length, 5)
  for (const entry of batches[0].entries) {
    assert.equal(typeof entry.options.to, 'string')
    assert.equal(entry.props.evento, evento().nombre)
    assert.equal(entry.props.detalleUrl, 'https://plataforma.example.com/eventos/retiro')
  }
})

test('sin destinatarios no llama al proveedor', async () => {
  const db = database({})
  await notifier(db, async () => assert.fail('No debe enviar')).notificarCambioEstadoRetiro(
    { ...evento(), coordinador_asignado_id: null }, 'https://plataforma.example.com',
  )
})

test('errores de consulta o proveedor se registran sin lanzar', async t => {
  const log = t.mock.method(console, 'error', () => {})
  for (const [db, send] of [
    [database({}, 'Consulta fallida'), async () => assert.fail('No debe enviar')],
    [database(fixture()), async () => ({ ok: false, errors: ['Proveedor no disponible'] })],
    [database(fixture()), async () => { throw new Error('Red no disponible') }],
  ]) await notifier(db, send).notificarCambioEstadoRetiro(evento(), 'https://plataforma.example.com')
  assert.equal(log.mock.callCount(), 3)
})

test('dos transiciones concurrentes desde el mismo estado generan un solo aviso', async () => {
  const db = database(fixture()), sent = []
  const update = updater(db, sent)
  const results = await Promise.all([1, 2].map(() => update(db, request(), 'retiro', 'solicitud', { estado: 'discernimiento_confra' })))
  assert.equal(results.filter(r => !r.error).length, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0].estado, 'discernimiento_confra')
})

test('guardar el mismo estado, una actualización fallida o sin filas no notifica', async () => {
  for (const db of [database(fixture()), database({}, 'RLS'), database({})]) {
    const sent = []
    await updater(db, sent)(db, request(), 'retiro', 'solicitud', { estado: 'solicitud' })
    assert.equal(sent.length, 0)
  }
})

test('la notificación usa el nombre y coordinador recién guardados', async () => {
  const db = database(fixture()), sent = []
  await updater(db, sent)(db, request(), 'retiro', 'solicitud', {
    estado: 'publicado', nombre: 'Nuevo nombre completo', coordinador_asignado_id: 'nuevo-coordinador',
  })
  assert.equal(sent[0][0].nombre, 'Nuevo nombre completo')
  assert.equal(sent[0][0].coordinador_asignado_id, 'nuevo-coordinador')
})

test('plantilla: asunto, texto solicitado, enlace clickeable y HTML escapado', () => {
  const props = { evento: 'Retiro <especial> & familia', detalleUrl: 'https://plataforma.example.com/eventos/retiro' }
  assert.equal(eventoCambioEstado.subject(props), `Novedad sobre Retiro ${props.evento}`)
  const rendered = render.renderEmail({ title: eventoCambioEstado.subject(props), blocks: eventoCambioEstado.blocks(props) })
  assert.ok(rendered.text.includes(`Novedades en el retiro ${props.evento}.`))
  assert.ok(rendered.text.includes(`Puede acceder a las mismas, haciendo clic en ${props.detalleUrl}`))
  assert.ok(rendered.text.includes('Bendiciones!'))
  assert.ok(rendered.html.includes(`href="${props.detalleUrl}"`))
  assert.ok(rendered.html.includes('&lt;especial&gt; &amp; familia'))
})

const flows = [
  ['aprobar', 'solicitud', 'discernimiento_confra', { resultado_discernimiento: 'aprobado_sin_modificaciones' }],
  ['aprobar', 'discernimiento_confra', 'pendiente_datos_noticias', { resultado_discernimiento: 'aprobado_sin_modificaciones' }],
  ['aprobar', 'solicitud', 'rechazado', { resultado_discernimiento: 'rechazado', notas_discernimiento: 'Motivo' }],
  ['datos-noticias', 'pendiente_datos_noticias', 'pendiente_aprobacion_final', { centralizador_1_nombre: 'María', centralizador_1_telefono: '1234' }],
  ['aprobacion-final', 'pendiente_aprobacion_final', 'publicado', { accion: 'publicar' }],
  ['aprobacion-final', 'pendiente_aprobacion_final', 'suspendido', { accion: 'suspender' }],
  ['aprobacion-final', 'pendiente_aprobacion_final', 'pendiente_datos_noticias', { accion: 'devolver', notas_aprobacion_final: 'Corregir' }],
  ['publicar', 'aprobado', 'publicado', {}], ['iniciar', 'publicado', 'en_curso', {}],
  ['finalizar', 'en_curso', 'finalizado', {}], ['cerrar', 'finalizado', 'cerrado', {}],
  ['suspender', 'publicado', 'suspendido', { notas_suspension: 'Motivo' }],
  ['estado', 'publicado', 'cancelado', { estado: 'cancelado', estadoAnterior: 'publicado' }],
]
function route(name, db, sent, ctx = { is_admin: true, persona_id: 'actor' }) {
  return load(`app/api/eventos/[id]/${name}/route.ts`, {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/auth/context': { getUserContext: async () => ctx, canPerform: () => true },
    '@/lib/eventos/actualizar-estado': { actualizarEstadoEvento: updater(db, sent) },
    '@/lib/eventos/solicitud-requeridos': { camposFaltantesSolicitud: () => [] },
    '@/lib/eventos/cierre': { canCerrarConvivencia: () => true, MIN_FOTOS_CIERRE: 3, esCentralizadorDeEvento: () => false },
    '@/lib/eventos/fotos-cierre': { contarFotosCierre: async () => 3 },
  })
}
for (const [name, before, after, body] of flows) {
  test(`${name}: ${before} → ${after} notifica una vez`, async () => {
    const data = fixture(), sent = []
    Object.assign(data.eventos[0], { estado: before, requiere_discernimiento_confra: true,
      flyer_horizontal_url: 'flyer', flyer_cuadrado_url: 'flyer' })
    const db = database(data)
    const handlers = route(name, db, sent)
    const response = await (handlers.POST ?? handlers.PATCH)(new Request(request(), {
      method: 'POST', body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'retiro' }) })
    assert.equal(response.status, 200, JSON.stringify(await response.json()))
    assert.equal(sent.length, 1)
    assert.equal(sent[0][0].estado, after)
  })
}

test('cambio manual: requiere sesión de administrador', async () => {
  for (const [ctx, status] of [[null, 401], [{ is_admin: false }, 403]]) {
    const db = database(fixture()), sent = []
    const response = await route('estado', db, sent, ctx).PATCH(request(), { params: Promise.resolve({ id: 'retiro' }) })
    assert.equal(response.status, status)
    assert.equal(db.calls.length, 0)
    assert.equal(sent.length, 0)
  }
})

test('cambio manual: rechaza estado inválido o versión desactualizada sin notificar', async () => {
  for (const [body, status] of [
    [{ estado: 'inventado', estadoAnterior: 'solicitud' }, 400],
    [{ estado: 'publicado', estadoAnterior: 'aprobado' }, 409],
  ]) {
    const db = database(fixture()), sent = []
    const response = await route('estado', db, sent).PATCH(new Request(request(), {
      method: 'PATCH', body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'retiro' }) })
    assert.equal(response.status, status)
    assert.equal(sent.length, 0)
    assert.equal(db.calls.filter(c => c.updates).length, 0)
  }
})

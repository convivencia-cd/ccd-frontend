// Ejecutar: node --test tests/interesado-alta.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers/load-ts.cjs')
const { isSendableAddress } = load('lib/email/config.ts')
const { getPublicOrigin } = load('lib/http.ts')
const render = load('lib/email/render.ts')
const { nuevoInteresado } = load('lib/email/templates.ts', {
  '@/lib/eventos/cierre': {}, '@/lib/utils': {}, './render': render,
  './template': { defineTemplate: x => x },
})

function database(steps) {
  const pending = [...steps], calls = []
  return { calls, done: () => assert.equal(pending.length, 0), from(table) {
    const step = pending.shift()
    assert.ok(step, `Consulta inesperada: ${table}`)
    assert.equal(table, step.table)
    const call = { table, filters: [], values: null }
    calls.push(call)
    const result = () => ({ data: step.data ?? null, error: step.error ?? null })
    const query = {
      select() { return this }, limit() { return this },
      eq(...args) { call.filters.push(args); return this },
      in(...args) { call.filters.push(args); return this },
      insert(values) { call.values = values; call.action = 'insert'; return this },
      update(values) { call.values = values; call.action = 'update'; return this },
      single() { return Promise.resolve(result()) },
      maybeSingle() { return this.single() },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
    }
    return query
  } }
}
const event = (extra = {}) => ({
  id: 'retreat', nombre: 'Convivencia - Buenos Aires - 16/10/2026', estado: 'publicado',
  centralizador_1_persona_id: null, centralizador_1_email: null,
  centralizador_2_persona_id: null, centralizador_2_email: null,
  centralizador_3_persona_id: null, centralizador_3_email: null, ...extra,
})
const interested = (evento = event()) => ({
  id: 'interest', evento,
  persona: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', telefono: '123456' },
})
function notifier(db, send = async () => ({ ok: true })) {
  return load('lib/interesados/notificar-alta.ts', {
    '@supabase/supabase-js': { createClient: () => db },
    '@/lib/email': { isSendableAddress, sendTemplateEmailBatch: send, templates: { nuevoInteresado } },
  })
}

test('resuelve los tres centralizadores: contacto del retiro y fallback a persona', async () => {
  const db = database([{ table: 'personas', data: [
    { id: 'c1', email: 'perfil@example.com' }, { id: 'c2', email: 'segundo@example.com' },
  ] }])
  const recipients = await notifier(db).destinatariosNuevoInteresado(db, event({
    centralizador_1_persona_id: 'c1', centralizador_1_email: ' contacto@example.com ',
    centralizador_2_persona_id: 'c2', centralizador_2_email: 'login@ccd.internal',
    centralizador_3_email: 'tercero@example.com',
  }))
  assert.deepEqual(recipients, ['contacto@example.com', 'segundo@example.com', 'tercero@example.com'])
  assert.deepEqual(db.calls[0].filters, [['id', ['c1', 'c2']]])
  db.done()
})

test('deduplica por persona y por email normalizado', async () => {
  const db = database([{ table: 'personas', data: [{ id: 'c1', email: 'uno@example.com' }] }])
  const recipients = await notifier(db).destinatariosNuevoInteresado(db, event({
    centralizador_1_persona_id: 'c1', centralizador_1_email: 'UNO@example.com',
    centralizador_2_persona_id: 'c1', centralizador_2_email: 'otro@example.com',
    centralizador_3_email: ' uno@example.com ',
  }))
  assert.deepEqual(recipients, ['uno@example.com'])
})

test('sin asignados o con correos inválidos no envía', async () => {
  const db = database([{ table: 'evento_participantes', data: interested(event({
    centralizador_1_email: 'sin-email', centralizador_2_email: 'login@ccd.internal',
  })) }])
  await notifier(db, () => assert.fail('No debe enviar')).notificarAltaInteresado('interest', 'https://app.example.com')
  db.done()
})

test('envía mensajes individuales con datos guardados y enlace al seguimiento del retiro', async () => {
  const db = database([{ table: 'evento_participantes', data: interested(event({
    centralizador_1_email: 'uno@example.com', centralizador_2_email: 'dos@example.com',
  })) }])
  const batches = []
  await notifier(db, async (template, entries) => { batches.push(entries); return { ok: true } })
    .notificarAltaInteresado('interest', 'https://app.example.com')
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 2)
  assert.deepEqual(db.calls[0].filters, [
    ['id', 'interest'], ['estado_participacion', 'interesado'], ['rol_en_evento', 'convivente'],
  ])
  for (const entry of batches[0]) {
    assert.equal(typeof entry.options.to, 'string')
    assert.equal(entry.props.nombre, 'Ana Pérez')
    assert.equal(entry.props.evento, event().nombre)
    assert.equal(entry.props.email, 'ana@example.com')
    assert.equal(entry.props.seguimientoUrl, 'https://app.example.com/interesados?evento_id=retreat')
  }
})

test('consulta o proveedor fallidos no impiden conservar el alta', async t => {
  const log = t.mock.method(console, 'error', () => {})
  const brokenDb = database([{ table: 'evento_participantes', error: { message: 'DB error' } }])
  await notifier(brokenDb).notificarAltaInteresado('interest', 'https://app.example.com')
  const db = database([{ table: 'evento_participantes', data: interested(event({ centralizador_1_email: 'uno@example.com' })) }])
  await notifier(db, async () => ({ ok: false, errors: ['Resend error'] }))
    .notificarAltaInteresado('interest', 'https://app.example.com')
  assert.equal(log.mock.callCount(), 2)
})

test('plantilla con nombre, contacto, retiro y enlace; escapa el contenido', () => {
  const props = { nombre: 'Ana <Pérez>', evento: 'Retiro & familia', email: 'ana@example.com',
    telefono: '123456', seguimientoUrl: 'https://app.example.com/interesados?evento_id=retreat' }
  assert.equal(nuevoInteresado.subject(props), 'Nuevo interesado — Retiro & familia')
  const result = render.renderEmail({ title: nuevoInteresado.subject(props), blocks: nuevoInteresado.blocks(props) })
  assert.ok(result.html.includes('Ana &lt;Pérez&gt;'))
  assert.ok(result.html.includes(`href="${props.seguimientoUrl}"`))
  assert.ok(result.text.includes('ana@example.com'))
  assert.ok(result.text.includes('123456'))
})

const jsonResponse = { NextResponse: { json: (body, init) => Response.json(body, init) } }
const request = body => new Request('https://app.example.com/api/interes', { method: 'POST', body: JSON.stringify(body) })
const params = { params: Promise.resolve({ id: 'retreat' }) }
const publicBody = { nombre: 'Ana', apellido: 'Pérez', evento_id: 'retreat', email: 'ana@example.com', telefono: '1234' }
function publicRoute(db, sent) {
  return load('app/api/public/interes/route.ts', {
    '@supabase/supabase-js': { createClient: () => db }, 'next/server': jsonResponse,
    '@/lib/http': { getPublicOrigin },
    '@/lib/interesados/notificar-alta': { notificarAltaInteresado: async (...args) => { db.done(); sent.push(args) } },
  }).POST
}
const publicSteps = [
  { table: 'eventos', data: event() }, { table: 'personas', data: { id: 'person' } },
  { table: 'evento_participantes', data: null },
]
test('alta pública de una persona existente avisa después de insertar su nuevo interés', async () => {
  const db = database([...publicSteps, { table: 'evento_participantes', data: { id: 'interest' } }]), sent = []
  const response = await publicRoute(db, sent)(request(publicBody))
  assert.equal(response.status, 200)
  assert.deepEqual(sent, [['interest', 'https://app.example.com']])
  assert.equal(db.calls.at(-1).action, 'insert')
})

test('alta pública duplicada o fallida no notifica', async () => {
  for (const steps of [
    [...publicSteps.slice(0, 2), { table: 'evento_participantes', data: { id: 'existing' } }],
    [...publicSteps, { table: 'evento_participantes', error: { code: '23505' } }],
  ]) {
    const db = database(steps), sent = []
    await publicRoute(db, sent)(request(publicBody))
    assert.equal(sent.length, 0)
    db.done()
  }
})

function privateRoute(name, db, sent, ctx = { persona_id: 'session-person' }, allowed = true) {
  return load(`app/api/eventos/[id]/${name}/route.ts`, {
    'next/server': jsonResponse, '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/auth/context': { getUserContext: async () => ctx }, '@/lib/http': { getPublicOrigin },
    '@/lib/interesados/notificar-alta': { notificarAltaInteresado: async (...args) => { db.done(); sent.push(args) } },
    '@/lib/eventos/equipo': { ROLES_EVENTO: ['convivente', 'servidor'],
      ESTADOS_PARTICIPACION: ['interesado', 'inscripto'], canGestionarParticipantes: () => allowed, ROLES_EVENTO_LABEL: {} },
  }).POST
}
for (const [rol, estado, count] of [['convivente', 'interesado', 1], ['convivente', 'inscripto', 0], ['servidor', 'interesado', 0]]) {
  test(`alta interna ${rol}/${estado}: ${count} aviso`, async () => {
    const db = database([
      { table: 'eventos', data: event() }, { table: 'personas', data: { id: 'person', tipo_persona: 'cecista' } },
      { table: 'evento_participantes', data: null }, { table: 'evento_participantes', data: { id: 'interest' } },
    ]), sent = []
    const response = await privateRoute('participantes', db, sent)(request({
      persona_id: 'person', rol_en_evento: rol, estado_participacion: estado, tipo_participante: 'no_cecista',
    }), params)
    assert.equal(response.status, 200)
    assert.equal(sent.length, count)
    assert.equal(db.calls.at(-1).values.tipo_participante, 'no_cecista')
  })
}

test('alta propia usa la persona de la sesión y avisa luego de guardar', async () => {
  const db = database([{ table: 'eventos', data: event() }, { table: 'evento_participantes', data: { id: 'interest' } }]), sent = []
  const response = await privateRoute('interes', db, sent)(request({ persona_id: 'forged', notas: ' Hola ' }), params)
  assert.equal(response.status, 200)
  assert.equal(db.calls.at(-1).values.persona_id, 'session-person')
  assert.equal(db.calls.at(-1).values.notas, 'Hola')
  assert.equal(sent.length, 1)
})

test('alta propia duplicada no notifica', async () => {
  const db = database([{ table: 'eventos', data: event() }, { table: 'evento_participantes', error: { code: '23505' } }]), sent = []
  const response = await privateRoute('interes', db, sent)(request({}), params)
  assert.equal(response.status, 409)
  assert.equal(sent.length, 0)
})

test('sin sesión, sin persona o sin permiso no hay alta ni notificación', async () => {
  for (const [name, ctx, allowed, steps, status] of [
    ['interes', null, false, [], 401], ['interes', { persona_id: null }, false, [], 403],
    ['participantes', {}, false, [{ table: 'eventos', data: event() }], 403],
  ]) {
    const db = database(steps), sent = []
    const response = await privateRoute(name, db, sent, ctx, allowed)(request({}), params)
    assert.equal(response.status, status)
    assert.equal(sent.length, 0)
    assert.ok(db.calls.every(c => !c.action))
  }
})

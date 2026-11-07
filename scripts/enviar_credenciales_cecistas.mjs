// Envía a cada cecista un mail con su acceso a la plataforma.
//
// Los logins ya existen (scripts/create_cecista_logins.mjs): usuario = nombre_usuario,
// contraseña inicial = el mismo usuario, y `debe_cambiar_password = true` hace que la
// plataforma les pida una nueva al primer ingreso. El mail (plantilla
// `credencialesCecista` de lib/email/templates.ts) explica eso, sin links de un solo uso.
//
// Destinatarios: cecistas activos con login, email real (personas.email) y que todavía
// NO cambiaron la contraseña inicial. Quien ya entró y la cambió no recibe nada.
//
// - SIN FLAGS NO ENVÍA NADA: muestra cuántos mails saldrían y a quiénes (dry-run).
// - Idempotente: registra cada envío en scripts/credenciales_cecistas_enviadas.json y
//   saltea a quien ya figure ahí (se puede cortar y retomar, o mandar de a tandas con
//   --limit si el plan de Resend tiene cupo diario).
// - Respeta EMAIL_DEV_REDIRECT_TO / EMAIL_DISABLED de lib/email (en modo redirección
//   no registra los envíos, porque no llegaron a los cecistas).
//
// Uso:
//   node scripts/enviar_credenciales_cecistas.mjs                      # dry-run: no envía
//   node scripts/enviar_credenciales_cecistas.mjs --prueba vos@mail.com # 1 mail de ejemplo (datos ficticios)
//   node scripts/enviar_credenciales_cecistas.mjs --enviar --limit 50  # envío real (pide confirmar)
//   node scripts/enviar_credenciales_cecistas.mjs --enviar             # envío real a todos los pendientes
//   --url https://...   cambia la URL base (default: producción)
//
// Requiere en .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)

// ─── cargar .env (simple, sin dependencias) ───────────────────────────────────
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* si no hay .env, se usan las env vars del entorno */ }

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY_ = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY_) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const ENVIAR = process.argv.includes('--enviar')
const PRUEBA = arg('--prueba')
const LIMIT = arg('--limit') ? parseInt(arg('--limit'), 10) : Infinity
const BASE_URL = (arg('--url') ?? 'https://plataforma.convivenciacondios.org').replace(/\/$/, '')
const PAUSA_MS = 600 // Resend permite ~2 envíos/seg por defecto
const LOG_PATH = new URL('./credenciales_cecistas_enviadas.json', import.meta.url)

// ─── lib/email (TypeScript) cargada igual que en tests/ ───────────────────────
const { load } = require('../tests/helpers/load-ts.cjs')
const config = load('lib/email/config.ts')
const render = load('lib/email/render.ts')
const client = load('lib/email/client.ts', { resend: require('resend'), './config': config })
const send = load('lib/email/send.ts', { './client': client, './config': config, './render': render })
const template = load('lib/email/template.ts', { './send': send })
const { templates } = load('lib/email/templates.ts', {
  '@/lib/eventos/cierre': {}, '@/lib/utils': {}, './render': render, './template': template,
})

const props = (p) => ({
  nombre: p.nombre.trim(),
  nombreUsuario: p.nombre_usuario,
  loginUrl: `${BASE_URL}/auth/login`,
  recuperarUrl: `${BASE_URL}/auth/forgot-password`,
})

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ocultar = (email) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2')

// ─── modo prueba: un solo mail con datos ficticios ────────────────────────────
if (PRUEBA) {
  const r = await template.sendTemplateEmail(
    templates.credencialesCecista,
    props({ nombre: 'María', nombre_usuario: 'mariaejemplo' }),
    { to: PRUEBA, tags: { envio: 'credenciales_prueba' } }
  )
  console.log(r.ok ? (r.skipped ? `No se envió (${r.skipped}).` : `Enviado a ${PRUEBA} (id ${r.id}).`) : `Error: ${r.error}`)
  process.exit(r.ok && !r.skipped ? 0 : 1)
}

// ─── destinatarios ────────────────────────────────────────────────────────────
const admin = createClient(URL_, KEY_, { auth: { autoRefreshToken: false, persistSession: false } })

async function fetchDestinatarios() {
  const out = []
  const PAGE = 1000 // PostgREST corta en 1000 filas: hay que paginar
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('personas')
      .select('id, codigo_interno, nombre, nombre_usuario, email')
      .eq('tipo_persona', 'cecista')
      .eq('estado', 'activo')
      .is('fecha_baja', null)
      .eq('debe_cambiar_password', true)
      .not('auth_user_id', 'is', null)
      .not('nombre_usuario', 'is', null)
      .not('email', 'is', null)
      .order('codigo_interno', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out.filter(p => config.isSendableAddress(p.email))
}

const enviados = existsSync(LOG_PATH) ? JSON.parse(readFileSync(LOG_PATH, 'utf8')) : {}
const todos = await fetchDestinatarios()
const pendientes = todos.filter(p => !enviados[p.id]).slice(0, LIMIT === Infinity ? undefined : LIMIT)

console.log(`Cecistas con login, email y contraseña inicial sin cambiar: ${todos.length}`)
console.log(`Ya avisados (según ${LOG_PATH.pathname.split('/').pop()}): ${todos.length - todos.filter(p => !enviados[p.id]).length}`)
console.log(`A enviar en esta corrida: ${pendientes.length}`)
for (const p of pendientes.slice(0, 5)) console.log(`  ${p.codigo_interno}  ${p.nombre_usuario}  ${ocultar(p.email)}`)
if (pendientes.length > 5) console.log(`  … y ${pendientes.length - 5} más`)

if (!ENVIAR) {
  console.log('\n[DRY-RUN] No se envió nada. Para enviar de verdad: --enviar (y opcional --limit N).')
  process.exit(0)
}

// ─── envío real ───────────────────────────────────────────────────────────────
const cfg = config.getEmailConfig()
if (!cfg.enabled) {
  console.error('\nEl envío está desactivado (falta RESEND_API_KEY o EMAIL_DISABLED=true). No se envió nada.')
  process.exit(1)
}
if (cfg.devRedirectTo)
  console.log(`\n⚠️  EMAIL_DEV_REDIRECT_TO activo: TODOS los mails van a ${cfg.devRedirectTo} y no se registran como enviados.`)

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ok = (await rl.question(`\nSe van a enviar ${pendientes.length} mails desde ${cfg.from}. Escribí ENVIAR para confirmar: `)).trim()
rl.close()
if (ok !== 'ENVIAR') {
  console.log('Cancelado. No se envió nada.')
  process.exit(0)
}

const counts = { enviado: 0, error: 0 }
const errores = []
for (const [i, p] of pendientes.entries()) {
  const opts = {
    to: p.email,
    tags: { envio: 'credenciales_cecistas' },
    idempotencyKey: `credenciales-cecista-${p.id}`,
  }
  let r = await template.sendTemplateEmail(templates.credencialesCecista, props(p), opts)
  if (!r.ok && /rate|too many|429/i.test(r.error)) {
    await sleep(5000)
    r = await template.sendTemplateEmail(templates.credencialesCecista, props(p), opts)
  }

  if (r.ok && !r.skipped) {
    counts.enviado++
    if (!cfg.devRedirectTo) {
      enviados[p.id] = { codigo: p.codigo_interno, enviado_en: new Date().toISOString(), resend_id: r.id }
      writeFileSync(LOG_PATH, JSON.stringify(enviados, null, 2))
    }
  } else {
    counts.error++
    errores.push({ codigo: p.codigo_interno, error: r.ok ? r.skipped : r.error })
    if (!r.ok && /quota|limit/i.test(r.error)) {
      console.error(`\nResend cortó por cupo: ${r.error}. Se puede retomar más tarde (saltea a los ya enviados).`)
      break
    }
  }
  process.stdout.write(`\r  ${i + 1}/${pendientes.length}`)
  await sleep(PAUSA_MS)
}
process.stdout.write('\n')

console.log('\nResumen:', counts)
if (errores.length) {
  const path = new URL('./credenciales_cecistas_errores.json', import.meta.url)
  writeFileSync(path, JSON.stringify(errores, null, 2))
  console.log(`Errores (${errores.length}) guardados en scripts/credenciales_cecistas_errores.json`)
}

# Email (Resend)

Capa reutilizable de envío de correo. **Solo servidor** (Route Handlers, Server Components, scripts).

```ts
import { sendEmail, sendTemplateEmail, templates, block } from '@/lib/email'
```

## Variables de entorno

| Variable | Requerida | Qué hace |
|---|---|---|
| `RESEND_API_KEY` | sí (para enviar de verdad) | API key de Resend. Sin ella todo corre en *dry run*: loguea y no envía. |
| `EMAIL_FROM` | recomendada | Remitente por defecto, ej. `Comunidad CcD <no-reply@tudominio.org>`. El dominio debe estar verificado en Resend. |
| `EMAIL_REPLY_TO` | no | Reply-to por defecto. |
| `EMAIL_DEV_REDIRECT_TO` | no | Redirige **todos** los destinatarios a esa casilla (dev/staging). |
| `EMAIL_DISABLED` | no | `true` desactiva el envío sin sacar la API key. |

## Contrato

`sendEmail()` **nunca lanza**. Devuelve `{ ok: true, id }` | `{ ok: true, id: null, skipped }` | `{ ok: false, error }`,
para que un fallo de correo no tumbe la inscripción o el pago que lo disparó. El caller decide si loguea o reintenta.

También descarta direcciones internas `@ccd.internal` (los logins sin correo real) — no hace falta filtrarlas a mano.

## Uso

### Con plantilla (recomendado)

```ts
await sendTemplateEmail(
  templates.inscripcionRegistrada,
  { nombre: 'María', evento: 'Convivencia de Otoño', fechaInicio: '2026-09-12', estado: 'confirmado' },
  { to: persona.email, tags: { evento_id: evento.id } }
)
```

### Ad-hoc, con bloques

```ts
await sendEmail({
  to: ['a@x.com', 'b@x.com'],
  subject: 'Cambio de sede',
  blocks: [
    block.heading('Cambio de sede'),
    block.paragraph('El retiro se traslada a la Casa San José.'),
    block.facts([{ label: 'Nueva dirección', value: 'Av. Siempreviva 742' }]),
    block.button('Ver evento', `${origin}/e/${evento.id}`),
  ],
})
```

Bloques disponibles: `heading`, `paragraph`, `list`, `facts`, `button`, `note`, `divider`, `raw`.
El HTML se genera con estilos inline (compatible con Gmail/Outlook) y la versión texto plano sale sola.

### Con adjuntos

```ts
await sendEmail({
  to: persona.email,
  subject: 'Informe de cierre',
  blocks: [block.paragraph('Adjuntamos el informe.')],
  attachments: [{ filename: 'cierre.pdf', content: pdfBuffer }],
})
```

### A muchos destinatarios

```ts
await sendTemplateEmailBatch(
  templates.recordatorioEvento,
  inscriptos.map(i => ({ props: { nombre: i.nombre, evento: e.nombre }, options: { to: i.email } }))
)
```

Trocea de a 100 por lote. La API batch de Resend no acepta adjuntos ni envío programado.

## Agregar una plantilla

En [templates.ts](templates.ts):

```ts
export const miPlantilla = defineTemplate<{ nombre: string }>({
  subject: p => `Hola ${p.nombre}`,
  blocks: p => [block.heading(`¡Hola, ${p.nombre}!`), block.paragraph('...')],
})
```

y sumala al objeto `templates` del final. Las plantillas son funciones puras `props → bloques`:
se pueden previsualizar sin enviar con `buildTemplateEmail(...)`.

## Diagnóstico

### Cambios de estado de retiros

Las transiciones del flujo y los cambios manuales del administrador pasan por
`lib/eventos/actualizar-estado.ts`. Solo se notifica después de guardar un cambio
real; una actualización rechazada o concurrente no dispara un correo.

`lib/eventos/notificar-estado.ts` resuelve los ministerios vigentes EFRATER,
RCONFRA y DEQT de la organización/fraternidad y sus padres, TIMON a nivel
comunitario y el coordinador asignado. Descarta personas inactivas, correos
internos y direcciones duplicadas. Cada destinatario recibe un correo individual
con el nombre guardado del retiro y el enlace interno `/eventos/:id`.

El envío usa la configuración de Resend existente. Los fallos se registran con
el prefijo `[evento-estado]` sin revertir el cambio; no hay reintento automático.
Pruebas sin envíos reales: `node --test tests/evento-estado.test.cjs`.

### Configuración de envío

Con sesión de admin:

- `GET /api/email/test` — muestra la configuración detectada (sin enviar).
- `POST /api/email/test` con `{ "to": "vos@ejemplo.com" }` — envía un correo de prueba.

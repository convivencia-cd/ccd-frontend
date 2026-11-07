# Componentes de terceros

Proyecto Convivencia con Dios | 28 de octubre de 2026 | Versión documental 1.0

El desarrollo propio utiliza bibliotecas, servicios y datos de terceros. Esto es habitual y no cambia el acuerdo de propiedad del código específico del proyecto.

## Bibliotecas
El proyecto declara 60 dependencias de aplicación y 9 de desarrollo. El detalle de nombres, versiones y licencias está en anexos/dependencias-directas.md y .json. pnpm-lock.yaml conserva la resolución de versiones, incluidas las dependencias indirectas.
Los grupos principales son Next.js y React para la aplicación; Tailwind y Radix para la interfaz; React Hook Form y Zod para formularios; Supabase, Resend y Mercado Pago para integraciones; y bibliotecas para PDF, Word, Excel, gráficos y QR.

## Licencias identificadas
Los metadatos locales informan 62 licencias MIT, 4 Apache-2.0, 1 ISC y 1 MPL-2.0. Mercado Pago no declara el campo license en su package.json instalado, pero su archivo LICENSE contiene licencia MIT.
html5-qrcode declara MPL-2.0; conservar y revisar sus condiciones según la distribución o modificaciones realizadas. xlsx declara Apache-2.0. Mantener los avisos de licencia de las bibliotecas y los componentes incorporados al código.
El inventario no constituye una revisión exhaustiva de licencias indirectas ni de vulnerabilidades.

## Datos y contenidos
Los códigos postales provienen de GeoNames, según lib/geo/cp-ar/index.ts, que indica CC BY 4.0. Conservar la atribución y confirmar los avisos de la descarga original.
El logo, las fotos y los contenidos de la comunidad se consideran separadamente de las bibliotecas. Conservar sus autorizaciones de uso cuando correspondan.

## Servicios externos
Vercel, Supabase, Resend y Mercado Pago tienen sus propias condiciones de servicio. Las cuentas y accesos se describen en el documento 06. No se verificaron contratos adicionales o licencias comerciales.
Fuente de datos geográficos: https://www.geonames.org/export/.

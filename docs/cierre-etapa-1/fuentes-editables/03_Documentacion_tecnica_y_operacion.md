# Guía técnica de la plataforma

Proyecto Convivencia con Dios | 28 de octubre de 2026 | Versión documental 1.0

Esta guía permite ubicar el código, instalar la aplicación y preparar una entrega. La referencia revisada es el commit 52ee771, del 27 de octubre de 2026.

## Ubicación y tecnología
Producción: https://plataforma.convivenciacondios.org/.
Repositorio: https://github.com/convivencia-cd/ccd-frontend.
Rama revisada: main, vinculada a ccd/main. El hash completo figura en anexos/manifiesto-tecnico.json.
La aplicación utiliza Next.js 16.0.10, React 19.2.0, TypeScript y Tailwind CSS. Supabase proporciona base de datos, autenticación y almacenamiento. Vercel aloja la aplicación; Resend envía correos y Mercado Pago procesa cobros.

## Organización del código
app contiene las pantallas y las API. app/(app) reúne las pantallas internas; app/auth el acceso; app/e/[id] la página pública de un evento; y app/pago/[id] el proceso de inscripción y pago.
lib reúne permisos, validaciones, correos, pagos y lógica de eventos. components contiene la interfaz reutilizable. scripts contiene SQL y utilidades. tests contiene las pruebas locales.
Los antecedentes funcionales y de datos están en docs/PRD.md, docs/negocio.md y docs/data-model-2.0.md. El esquema realmente instalado debe contrastarse con la base de datos de producción.

## Instalación
1. Clonar el repositorio y seleccionar main o el commit de entrega.
2. Usar Node.js 20.9.0 o superior, según el requisito declarado por Next.js instalado. El proyecto declara pnpm 10.18.2.
3. Ejecutar pnpm install --frozen-lockfile.
4. Configurar las variables del documento 06 en un entorno de prueba.
5. Ejecutar pnpm dev para desarrollo.
6. Ejecutar pnpm build y pnpm start para comprobar la construcción y ejecución de producción.
Los comandos de build y start no se ejecutaron para esta revisión documental.

## Base de datos y despliegue
Los scripts SQL no deben ejecutarse todos de forma automática: hay archivos históricos y prefijos repetidos. Confirmar cuáles se aplicaron y preparar una secuencia revisada antes de una instalación nueva.
El pull incorporó scripts/100_realizados_desde_asistencia.sql, que relaciona la asistencia con los eventos realizados de la persona. Su presencia en Git no confirma su ejecución en producción.
Antes de desplegar: preparar respaldo, revisar cambios de datos, comprobar variables y construir. Después: verificar acceso, permisos y los procesos afectados. Registrar el commit publicado. Volver a un despliegue anterior no revierte la base de datos.

## Integraciones
Mercado Pago utiliza /api/mercadopago/oauth/callback y /api/public/pagos/mercadopago/webhook. El código actualizado incorpora validación del estado de OAuth y comprobaciones de referencia, importe y moneda del pago. En Vercel producción, la falta de MP_WEBHOOK_SECRET hace que se rechacen las notificaciones.
Para correos, consultar lib/email/README.md. EMAIL_DISABLED desactiva envíos y EMAIL_DEV_REDIRECT_TO cambia los destinatarios. Revisar ambos antes de publicar. Los avisos de estado y alta revisados no tienen reintento automático.

## Verificación local
Se ejecutó node --test tests/*.test.cjs: 48 pruebas, 41 aprobadas y 7 fallidas por un import no simulado de avisos-equipo. El documento 08 registra el pendiente. El historial reciente está en anexos/versiones-del-codigo.md.

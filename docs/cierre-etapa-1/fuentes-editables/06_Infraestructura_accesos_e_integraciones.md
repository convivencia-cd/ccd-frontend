# Servicios y accesos

Proyecto Convivencia con Dios | 28 de octubre de 2026 | Versión documental 1.0

Vercel, Supabase, Resend y el dominio están en cuentas del cliente y a su cargo, según lo confirmado por el proveedor. Este documento resume los servicios y la modalidad de acceso.

## Cuenta de acceso y costos
Los desarrolladores trabajan en Supabase, GitHub y Resend ingresando directamente con la cuenta de Google noreply@convivenciacondios.org, provista por el cliente Convivencia Con Dios.
Si el cliente decide contratar planes pagos, ampliar capacidad o habilitar consumos facturables en esos servicios, sus costos quedan a cargo de Convivencia Con Dios. La contratación y facturación se gestionan desde las cuentas u organizaciones del cliente vinculadas a ese acceso, con el medio de pago que el cliente configure.

## Servicios
| Servicio | Uso | Estado conocido |
| --- | --- | --- |
| GitHub | Código e historial | convivencia-cd/ccd-frontend; main sigue ccd/main |
| Vercel | Hosting y despliegues | Cuenta del cliente; proyecto concreto por registrar |
| Supabase | Datos, usuarios y archivos | Cuenta del cliente; plan Free; sin backups automáticos informados |
| Dominio y DNS | Dirección pública | Del cliente; producción en plataforma.convivenciacondios.org |
| Resend | Correo transaccional | Cuenta del cliente; remitente por comprobar |
| Mercado Pago | Cobros | Integración existente; comprobar titulares y cuentas vinculadas |
| v0 | Herramienta de origen | Mencionada en README; uso actual por confirmar |

Producción: https://plataforma.convivenciacondios.org/.
Repositorio: https://github.com/convivencia-cd/ccd-frontend.
El pull del repositorio se realizó correctamente. El commit desplegado en producción no fue verificado en esta revisión documental.

## Variables de configuración
NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY: conexión de la aplicación con Supabase.
SUPABASE_SERVICE_ROLE_KEY: credencial privilegiada, solo del servidor.
RESEND_API_KEY, EMAIL_FROM y EMAIL_REPLY_TO: servicio, remitente y respuesta de correo.
EMAIL_DISABLED y EMAIL_DEV_REDIRECT_TO: controles para desactivar o redirigir envíos; revisar su valor antes de producción.
MP_CLIENT_ID, MP_CLIENT_SECRET y MP_WEBHOOK_SECRET: aplicación de pagos, OAuth y validación de notificaciones.
Los valores concretos se conservan en las cuentas y herramientas de secretos. No deben copiarse a este documento.

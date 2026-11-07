# Fuentes de la documentación

Revisión actualizada el 28 de octubre de 2026 sobre 52ee771a9f2ac7144901d2e49b46c027deea7976, después de git pull --ff-only desde ccd/main.

## Información confirmada por el proveedor

Cliente Convivencia Con Dios; propietario del código específico. Joaquín Balthasar De Weert es el proveedor contratado personalmente y programador principal. Juan Tomas Soto es el programador contratado por él, con conocimiento del cliente. Angeles Truccia es la PM y analista funcional.
Constanza Cardenas Mancini aprueba en reuniones y Trello; Pablo Medina, integrante del EQT (Equipo Timón), coordina el cierre. Según la instrucción del proveedor, el acta marca Aceptación en todas sus áreas excepto Correo, que queda Pendiente.
El cliente es titular y responsable de Vercel, Supabase, Resend y dominio. Supabase usa Free y no hay backups automáticos, según el proveedor. Joaquín preparará la copia de cierre.
Las importaciones #52, #108 y #48 abarcan emails, teléfonos y DNI; faltan correcciones de emails del cliente. Documentos y Reportes generales quedaron fuera según recuerda el proveedor; confirmación pendiente.
La garantía propuesta es de 30 días desde aceptación; para importaciones posteriores, 30 días desde entrega y aceptación, solo para esa parte. Reportes por Trello o WhatsApp grupal. El cliente aún debe aceptar la propuesta.

## Evidencia local

Git: remote ccd, upstream ccd/main y log reciente. package.json y pnpm-lock.yaml: tecnología y dependencias. node_modules: versiones y licencias instaladas. next.config.mjs: configuración. tests: 48 casos, 41 aprobados y 7 fallidos por simulación incompleta. Código de app y lib: funciones e integraciones. scripts: evolución de datos y nueva migración 100.
La lista de dependencias directas no cambió con el pull. Conservar el alcance de la revisión indicado en su inventario.

## Verificaciones que siguen pendientes

Commit desplegado, paneles de servicios, ejecución de migraciones, preparación y restauración del respaldo, datos legales y conformidad final. No se certificaron seguridad integral, ausencia de defectos ni ejecución de todas las pruebas funcionales.

## Referencias técnicas

Supabase backups: https://supabase.com/docs/guides/platform/backups
GeoNames: https://www.geonames.org/export/

El proveedor confirmó que Supabase, GitHub y Resend utilizan la cuenta de Google noreply@convivenciacondios.org provista por el cliente. Los planes pagos y consumos que el cliente decida contratar quedan a cargo de Convivencia Con Dios y se gestionan desde sus cuentas u organizaciones.

El proveedor aclaró que los desarrolladores trabajan ingresando directamente con la cuenta de Google provista por el cliente. Se retiró del documento 06 el procedimiento de comprobación de entrega de accesos.

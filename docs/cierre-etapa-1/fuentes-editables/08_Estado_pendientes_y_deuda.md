# Pendientes y estado del desarrollo

Proyecto Convivencia con Dios | 28 de octubre de 2026 | Versión documental 1.0

Este registro acompaña el cierre de Etapa 1 del 31 de octubre de 2026. Referencia revisada: 52ee771, del 27 de octubre. Los pendientes funcionales se distinguen de las observaciones técnicas.

## Pendientes funcionales
Correo: pendiente en el acta; coordinar su validación con Constanza Cardenas Mancini.
Cards de Trello #52, #108 y #48: importación de emails, teléfonos y DNI. El cliente entregó los archivos, salvo correcciones de emails que todavía faltan. Las importaciones se completarán en cuanto se reciban, antes o después del 31 de octubre. Siguen siendo parte de Etapa 1.
El detalle por card se conserva en Trello. Si siguen abiertas al cierre, incluirlas en la conformidad y registrar luego la entrega y validación.
Documentos y Reportes generales: según recuerda el proveedor, quedaron fuera del alcance. Confirmar esa exclusión; no confundirlos con los informes específicos de eventos.

## Pendientes de entrega
Joaquín Balthasar De Weert preparará la copia de seguridad y su comprobación, conforme al documento 05. Falta registrar la conformidad final con Pablo Medina y comprobar los accesos del cliente.

## Observaciones técnicas actuales
Las pruebas locales ejecutadas después del pull dieron 48 casos: 41 aprobados y 7 fallidos por un import no simulado de @/lib/eventos/avisos-equipo. Ocurren en tests/evento-estado.test.cjs. Hay que actualizar las simulaciones y repetir esos casos; el resultado no demuestra por sí solo un fallo en producción.
next.config.mjs permite construir ignorando errores de TypeScript. Conviene revisar y resolver los errores antes de retirar esa opción. No se ejecutó un build en esta revisión.
Confirmar las migraciones instaladas, especialmente scripts/100_realizados_desde_asistencia.sql incorporado por el pull. Los avisos de estado y alta revisados no tienen reintento automático.
El detalle de cambios y verificaciones está en anexos/versiones-del-codigo.md y anexos/fuentes-y-evidencias.md.

## Responsables
Desarrollo principal: Joaquín Balthasar De Weert. Programación: Juan Tomas Soto. Coordinación y análisis: Angeles Truccia. Aprobación funcional: Constanza Cardenas Mancini. Coordinación del cierre por el cliente: Pablo Medina, integrante del EQT (Equipo Timón).

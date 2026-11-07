# Versiones del código

Revisión del 28 de octubre de 2026. Se ejecutó git pull --ff-only sobre main, vinculada a ccd/main, y se actualizó desde 81f0663 hasta 52ee771.

Repositorio: https://github.com/convivencia-cd/ccd-frontend
Rama: main
Commit completo revisado: 52ee771a9f2ac7144901d2e49b46c027deea7976
Último commit: 27 de octubre de 2026.
Versión de package.json: 0.1.0.

La referencia identifica el código revisado hoy. No confirma el despliegue en producción ni los cambios que puedan llegar antes del corte del 31 de octubre.

## Historial reciente

| Commit | Fecha | Descripción |
| --- | --- | --- |
| 52ee771 | 2026-10-27 | fix: cerrar fuga de datos en interés público y reforzar pagos de Mercado Pago |
| b5c4fc1 | 2026-10-27 | feat: mejorar la lógica de avisos al equipo asignado en eventos y unificar el manejo de roles |
| f11c627 | 2026-10-27 | feat: agregar lógica para filtrar conviventes que dieron el presente y mejorar la carga de datos en el listado |
| b0243c8 | 2026-10-27 | feat: agregar panel de inicio para cuentas de Participante y ajustar lógica de visualización en el dashboard y configuración |
| cbf94e9 | 2026-10-26 | Merge branch 'main' of https://github.com/convivencia-cd/ccd-frontend |
| 30daa35 | 2026-10-26 | feat: agregar función para obtener asesores activos y mejorar la selección de coordinadores y asesores en el evento |
| 81f0663 | 2026-10-26 | Cambios card #70 |
| 32f0e15 | 2026-10-22 | feat: mejorar la navegación y la estructura de los indicadores en el panel de inicio, añadiendo enlaces y mejorando la lógica de selección de confraternidades y fraternidades |
| bff0064 | 2026-10-22 | feat: agregar notificaciones por correo a centralizadores al asignarlos y al actualizar eventos |
| e69e4d2 | 2026-10-22 | feat: hacer el comprobante obligatorio al registrar movimientos y marcar campos obligatorios en el formulario de inscripción |

## Cambios incorporados por el pull

Se incorporaron seis commits, con cambios en el inicio de participantes, asistencia y eventos realizados, asignación y avisos de equipos, interés público y validaciones de Mercado Pago. El historial conserva los cambios exactos. Se añadió scripts/100_realizados_desde_asistencia.sql; aplicación en producción no comprobada.

## Pruebas realizadas

node --test tests/*.test.cjs: 48 casos, 41 aprobados y 7 fallidos. Todos los fallos actuales se producen por un import no simulado de @/lib/eventos/avisos-equipo. No se ejecutó build ni se desplegó la aplicación en esta revisión.

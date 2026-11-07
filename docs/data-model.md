# DOCUMENTO DE MODELO DE DATOS

## Plataforma de Gestión Integral – Comunidad CcD

Versión 1.0

---

# 1. Introducción

Este documento define el modelo de datos conceptual y lógico de la Plataforma CcD.

El modelo está diseñado bajo los siguientes principios:

- Persistencia histórica obligatoria.
- No eliminación física de registros relevantes.
- Separación entre:
  - Modo de participación institucional
  - Ministerio institucional
  - Rol técnico del sistema
  - Rol operativo dentro de eventos
- Jerarquía organizacional flexible y extensible.
- Compatibilidad con PostgreSQL (Supabase).

---

# 2. Principios de Diseño del Modelo

1. Toda asignación institucional debe ser histórica.
2. El estado actual debe derivarse del histórico.
3. Una persona puede tener múltiples roles simultáneos.
4. Ministerio ≠ Rol técnico del sistema.
5. Rol en evento ≠ Ministerio institucional.
6. La jerarquía organizacional es autorreferenciada.

---

# 3. Entidades Principales

---

# 3.1 PERSONA

Representa a cualquier individuo dentro del sistema.

## Atributos principales

- id (UUID, PK)
- fecha_alta
- fecha_baja (nullable)
- nombre
- apellido
- apodo (nullable — apodo/sobrenombre, se muestra entre paréntesis junto al nombre)
- email (unique)
- teléfono
- tipo_documento
- documento
- fecha_nacimiento
- dirección
- localidad
- provincia
- país
- estado (activo/inactivo)
- acepta_comunicaciones (boolean)
- created_at
- updated_at

## Relaciones

- 1:N persona_modos
- 1:N asignaciones_ministerio
- 1:N evento_participantes
- 1:1 perfil_usuario

---

# 3.2 ORGANIZACION

Representa cualquier nodo estructural.

Tipos posibles:

- comunidad
- confraternidad
- fraternidad
- casa_retiro
- eqt

## Atributos

- id (UUID, PK)
- parent_id (FK self reference)
- nombre
- tipo
- código
- estado (activa/inactiva)
- fecha_creacion
- fecha_baja
- país
- provincia
- localidad

## Relaciones

- 1:N organizaciones (jerarquía)
- 1:N eventos
- 1:N asignaciones_ministerio

---

# 3.3 PERSONA_MODOS

Histórico de modos de participación institucional.

## Modos posibles

- colaborador
- servidor
- asesor
- familiar
- orante
- intercesor

## Atributos

- id (UUID)
- persona_id (FK)
- modo
- fecha_inicio
- fecha_fin (nullable)
- estado (activo/inactivo)
- motivo_fin
- documento_url
- created_at

## Reglas

- No puede haber dos modos excluyentes activos simultáneamente.
- No se elimina histórico.
- El modo actual se calcula por fecha_fin IS NULL.

---

# 3.4 MINISTERIO

Catálogo institucional de ministerios.

## Tipos

- conducción
- pastoral
- servicio

## Niveles

- comunidad
- confraternidad
- fraternidad
- evento

## Atributos

- id (UUID)
- nombre
- tipo
- nivel
- requiere_acta (boolean)
- activo (boolean)

---

# 3.5 ASIGNACIONES_MINISTERIO

Histórico de asignaciones institucionales.

## Atributos

- id (UUID)
- persona_id (FK)
- ministerio_id (FK)
- organizacion_id (FK)
- evento_id (nullable FK)
- fecha_inicio
- fecha_fin (nullable)
- estado
- motivo_fin
- documento_url
- asignado_por
- created_at

## Reglas

- Puede existir asignación a nivel organizacional o evento.
- Toda asignación debe tener fecha_inicio.
- La asignación actual es aquella sin fecha_fin.

## Tipos de evento del Coordinador (ASIGNACION_MINISTERIO_TIPOS_EVENTO)

Migración 103 (card #47). Una asignación del ministerio Coordinador (COOR) lista
los tipos de evento que esa persona puede coordinar:

- asignacion_id (FK asignaciones_ministerio)
- tipo_evento_id (FK tipos_eventos)

Los desplegables de coordinador (coordinadores propuestos, coordinador asignado,
aprobación final, Asignaciones del Retiro) muestran solo a quien tiene una
asignación COOR vigente con el tipo del evento tildado. Sin tipos tildados, no
aparece en ninguno. Las rutas de la API validan lo mismo
(`lib/eventos/coordinadores-tipo-evento.ts`).

---

# 3.6 EVENTO

Representa convivencias, retiros y talleres.

## Tipos

- convivencia
- retiro
- taller

## Atributos

- id (UUID)
- organizacion_id (FK)
- casa_retiro_id (FK organizacion)
- nombre
- tipo
- audiencia (abierto/cerrado)
- modalidad (presencial/virtual/bimodal)
- estado (workflow)
- fecha_solicitud
- fecha_aprobacion
- aprobado_por
- cupo_maximo
- cuota_inscripcion
- pension
- created_at

## Estados posibles

- borrador
- solicitado
- aprobado
- publicado
- finalizado

---

# 3.7 EVENTO_FECHAS

Permite fechas fragmentadas.

## Atributos

- id (UUID)
- evento_id (FK)
- fecha_inicio
- fecha_fin

---

# 3.8 EVENTO_PARTICIPANTES

Vincula personas con eventos.

## Roles posibles en evento

- convivente
- coordinador
- asesor
- centralizador
- equipo_auxiliar

## Atributos

- id (UUID)
- evento_id (FK)
- persona_id (FK)
- rol
- estado_inscripcion
- fecha_inscripcion

## Reglas

- Rol en evento no depende del modo institucional.
- Puede haber múltiples roles por evento si el negocio lo permite.

---

# 3.9 PERFILES_USUARIO

Extensión de Supabase Auth.

## Atributos

- id (FK auth.users)
- persona_id (FK)
- estado

---

# 3.10 ROLES_SISTEMA

Roles técnicos del sistema.

Ejemplos:

- admin_general
- solo_lectura
- tecnico_confraternidad

## Atributos

- id
- nombre

---

# 3.11 USUARIO_ROLES

Permisos contextuales.

## Atributos

- id
- usuario_id
- rol_sistema_id
- organizacion_id (nullable)

## Reglas

- Permisos deben aplicarse vía RLS.
- Permisos pueden ser globales o por organización.

---

# 4. Relaciones Clave del Sistema

Persona
→ persona_modos
→ asignaciones_ministerio
→ evento_participantes

Organizacion
→ organizaciones (self relation)
→ eventos

Evento
→ evento_fechas
→ evento_participantes

Usuario
→ perfiles_usuario
→ usuario_roles

---

# 5. Reglas Críticas de Integridad

1. No eliminación física de personas con historial.
2. Toda asignación institucional es histórica.
3. Los permisos no deben depender del texto del ministerio.
4. La jerarquía organizacional define alcance de permisos.
5. Los datos deben ser exportables.

---

# 6. Estrategia de Implementación en Supabase

- PostgreSQL como base relacional.
- UUID como PK.
- Row Level Security obligatorio.
- Policies basadas en:
  - usuario_roles
  - jerarquía organizacional
- Uso de índices en:
  - persona_id
  - organizacion_id
  - evento_id
  - fecha_fin

---

# 7. Escalabilidad

El modelo soporta:

- Crecimiento multi-país.
- Más de 5000 personas.
- Histórico de múltiples años.
- Cambio de autoridades sin pérdida de trazabilidad.

---

Documento Técnico Base v1.0
Modelo preparado para Supabase + Next.js

# Kidario Backend Contracts (Plan A -> FastAPI + Supabase Postgres)

## 1) Objetivo

Definir contratos de dominio para persistir datos fuera de Supabase Auth:

- Perfil común de usuario (`profiles`)
- Perfil de padre/madre/tutor (`parent_profiles` + `parent_children`)
- Perfil de profesora (`teacher_profiles` + tablas auxiliares)

Este documento cubre:

- Modelo de datos inicial
- Contratos HTTP (request/response)
- Reglas de negocio mínimas
- Semántica de idempotencia

## 2) Principios de diseño

1. `auth.users` (Supabase Auth) sigue siendo fuente de verdad para identidad y credenciales.
2. `profiles` es la capa común de dominio (user record canónico de la app).
3. Tablas por rol guardan solo datos específicos del rol.
4. Endpoints de escritura son `upsert` por `user_id` para simplificar onboarding.
5. Inicialmente un usuario tiene un solo rol activo (`parent` o `teacher`).

## 3) Modelo de datos propuesto (v1)

## 3.1 Tabla `profiles`

- `id uuid primary key` (igual a `auth.users.id`)
- `email text not null unique`
- `first_name text`
- `last_name text`
- `role text not null check (role in ('parent', 'teacher'))`
- `auth_email_confirmed boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notas:

- `id` se completa desde JWT (`sub`).
- `email` se sincroniza desde token/Auth cuando aplique.

## 3.2 Tabla `parent_profiles`

- `profile_id uuid primary key references profiles(id) on delete cascade`
- `phone text`
- `birth_date date`
- `address text`
- `bio text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## 3.3 Tabla `parent_children`

- `id uuid primary key`
- `profile_id uuid not null references parent_profiles(profile_id) on delete cascade`
- `name text not null`
- `gender text`
- `age smallint`
- `current_grade text`
- `birth_month_year text` formato `YYYY-MM`
- `school text`
- `focus_points text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- `index parent_children_profile_id`

## 3.4 Tabla `teacher_profiles`

- `profile_id uuid primary key references profiles(id) on delete cascade`
- `phone text`
- `cpf text`
- `professional_registration text`
- `city text`
- `state text`
- `modality text` (`online|presencial|hibrido`)
- `mini_bio text`
- `hourly_rate numeric(10,2)`
- `lesson_duration_minutes int`
- `profile_photo_file_name text`
- `request_experience_anonymity boolean not null default false`
- `is_active_teacher boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## 3.5 Tabla `teacher_specialties`

- `id uuid primary key`
- `profile_id uuid not null references teacher_profiles(profile_id) on delete cascade`
- `specialty text not null`

Índices:

- `index teacher_specialties_profile_id`
- `unique(profile_id, specialty)`

## 3.6 Tabla `teacher_formations`

- `id uuid primary key`
- `profile_id uuid not null references teacher_profiles(profile_id) on delete cascade`
- `degree_type text not null`
- `course_name text not null`
- `institution text not null`
- `completion_year text`

Índices:

- `index teacher_formations_profile_id`

## 3.7 Tabla `teacher_experiences`

- `id uuid primary key`
- `profile_id uuid not null references teacher_profiles(profile_id) on delete cascade`
- `institution text not null`
- `role text not null`
- `responsibilities text not null`
- `period_from text not null`
- `period_to text`
- `current_position boolean not null default false`

Índices:

- `index teacher_experiences_profile_id`

## 3.8 Tabla `teacher_availability`

- `id uuid primary key`
- `profile_id uuid not null references teacher_profiles(profile_id) on delete cascade`
- `day_of_week smallint not null` (0-6)
- `start_time text not null` (`HH:mm`)
- `end_time text not null` (`HH:mm`)

Índices:

- `index teacher_availability_profile_id`

## 4) Contratos HTTP (v1)

Base path: `/api/v1`

Autorización:

- Header `Authorization: Bearer <supabase_access_token>`
- Backend valida JWT de Supabase y extrae `user_id` (`sub`), `email`.

## 4.1 GET `/api/v1/profiles/me`

Descripción:

- Devuelve perfil común + estado de perfil por rol.

Response `200`:

```json
{
  "profile": { "id": "uuid", "email": "user@email.com", "first_name": "Maria", "last_name": "Silva", "role": "parent" },
  "parent_profile_exists": true,
  "teacher_profile_exists": false
}
```

## 4.2 PATCH `/api/v1/profiles/parent`

Descripción:

- Crea o actualiza parcialmente el perfil de padre para el usuario autenticado.
- Campos escalares se actualizan parcialmente.
- Hijos se actualizan de forma incremental con operaciones `upsert` y `delete_ids`.

Request body:

```json
{
  "first_name": "Maria",
  "last_name": "Silva",
  "phone": "(11) 99999-9999",
  "birth_date": "1987-10-01",
  "address": "Rua X, 123",
  "bio": "Busca apoio pedagógico...",
  "children_ops": {
    "upsert": [
      {
        "id": "optional-uuid-existing-child",
        "name": "Lucas",
        "gender": "masculino",
        "age": 8,
        "current_grade": "3-ano-fundamental",
        "birth_month_year": "2017-04",
        "school": "Colegio Y",
        "focus_points": "leitura e concentração"
      }
    ],
    "delete_ids": ["existing-child-uuid-to-delete"]
  }
}
```

Response `200`:

```json
{
  "status": "ok",
  "profile_id": "uuid",
  "role": "parent"
}
```

Errores:

- `401` token inválido
- `409` usuario ya registrado como `teacher`
- `422` validación de payload

## 4.3 PATCH `/api/v1/profiles/teacher`

Descripción:

- Crea o actualiza parcialmente perfil de profesora para el usuario autenticado.
- Campos escalares se actualizan parcialmente.
- Colecciones se actualizan incrementalmente con operaciones por tipo.

Request body:

```json
{
  "first_name": "Ana",
  "last_name": "Souza",
  "phone": "(11) 98888-7777",
  "cpf": "000.000.000-00",
  "professional_registration": "ABC123",
  "city": "Sao Paulo",
  "state": "SP",
  "modality": "hibrido",
  "mini_bio": "Pedagoga com foco em alfabetização",
  "hourly_rate": 320.0,
  "lesson_duration_minutes": 60,
  "profile_photo_file_name": "foto-ana.jpg",
  "request_experience_anonymity": false,
  "specialties_ops": {
    "add": ["Alfabetização", "TEA"],
    "remove": ["Discalculia"]
  },
  "formations_ops": {
    "upsert": [
      {
        "id": "optional-uuid-existing-formation",
        "degree_type": "graduacao",
        "course_name": "Pedagogia",
        "institution": "USP",
        "completion_year": "2018"
      }
    ],
    "delete_ids": ["existing-formation-uuid-to-delete"]
  },
  "experiences_ops": {
    "upsert": [
      {
        "id": "optional-uuid-existing-experience",
        "institution": "Colegio Z",
        "role": "Professora",
        "responsibilities": "Aulas individuais",
        "period_from": "2021-01",
        "period_to": null,
        "current_position": true
      }
    ],
    "delete_ids": ["existing-experience-uuid-to-delete"]
  },
  "availability_ops": {
    "upsert": [
      {
        "id": "optional-uuid-existing-slot",
        "day_of_week": 1,
        "start_time": "14:00",
        "end_time": "16:00"
      }
    ],
    "delete_ids": ["existing-slot-uuid-to-delete"]
  }
}
```

Response `200`:

```json
{
  "status": "ok",
  "profile_id": "uuid",
  "role": "teacher"
}
```

Errores:

- `401` token inválido
- `409` usuario ya registrado como `parent`
- `422` validación de payload

## 4.4 PATCH `/api/v1/admin/teachers/{profile_id}/activation`

Descripción:

- Endpoint administrativo para activar/desactivar profesoras en plataforma.

Request body:

```json
{
  "is_active_teacher": true
}
```

Response `200`:

```json
{
  "status": "ok",
  "profile_id": "uuid",
  "is_active_teacher": true
}
```

Errores:

- `401` token inválido
- `403` usuario sin permisos admin
- `404` profesora no encontrada

## 5) Reglas de negocio (v1)

1. Un `profile_id` no puede existir en `parent_profiles` y `teacher_profiles` al mismo tiempo.
2. `profiles.role` debe reflejar el rol persistido.
3. `PATCH` actualiza parcialmente sin sobrescribir campos no enviados.
4. En `PATCH /profiles/parent`, se requiere al menos un child total tras aplicar operaciones.
5. En `PATCH /profiles/teacher`, se requiere al menos un bloque de disponibilidad total tras aplicar operaciones.
6. Para `teacher_experiences`: si `current_position=true`, `period_to` puede ser null.
7. `teacher_profiles.is_active_teacher` inicia siempre en `false`.
8. `is_active_teacher` no se recibe en onboarding público; solo admins pueden actualizarlo.

## 6) Mapeo frontend -> backend

Origen actual frontend:

- `Signup.tsx` (parent)
- `TeacherPrivateSignup.tsx` (teacher)

Mapeo sugerido:

- Frontend mantiene `signUpWithEmailPassword` para Auth.
- Tras login exitoso (email confirmado), frontend hace `PATCH` al endpoint de perfil correspondiente.
- Signup parent y signup teacher deben cambiar `full_name` por `first_name` + `last_name`.
- Signup children debe cambiar `birth_month` + `birth_year` por un único campo `birth_month_year` (`YYYY-MM`).

## 7) Estrategia de migración desde `user_metadata`

Mientras convivimos con metadata en Supabase Auth:

## 8) RLS baseline (Supabase)

SQL asociado:

- `sql/002_rls_profiles.sql`
- `sql/003_rls_validation.sql` (smoke test manual)

Reglas aplicadas:

1. RLS habilitado en todas las tablas de perfil (`profiles`, `parent_*`, `teacher_*`).
2. Usuarios `authenticated` solo pueden leer/escribir sus propios registros (`auth.uid()`).
3. Tablas de rol (`parent_*`, `teacher_*`) validan coherencia con `profiles.role`.
4. `service_role`/`postgres` mantienen acceso total para procesos backend confiables (FastAPI).

Nota:

- El frontend no debe usar `service_role`.
- Si en el futuro el marketplace requiere lectura pública parcial de profesoras, se recomienda exponer una `view` segura con columnas no sensibles en lugar de abrir `teacher_profiles` completo.

1. Leer metadata en frontend solo como respaldo temporal.
2. En primer login con sesión válida, persistir en backend (`PATCH` correspondiente).
3. Backend pasa a ser fuente de verdad para perfiles.

## 8) Criterios de aceptación para continuar implementación

1. Estructura de tablas aprobada.
2. Contratos `PATCH /profiles/parent` y `PATCH /profiles/teacher` aprobados.
3. Decisión confirmada: un solo rol activo por usuario en v1.
4. Aprobada estrategia incremental de colecciones (`upsert`/`delete_ids`) en `PATCH`.
5. Aprobado que activación de profesora se gestione solo por admins (`is_active_teacher`).

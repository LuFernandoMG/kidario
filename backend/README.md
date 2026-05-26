# Kidario Backend (FastAPI)

## Setup

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run API

Recommended dev startup:

```bash
make dev
```

This starts the API without auto-reload, which is the most stable option when integrating with the frontend.

If you need hot reload while editing backend code, use:

```bash
make dev-watch
```

That watcher is scoped to `app/` and excludes `tests/`, `scripts/`, `.venv/`, caches, and other files that can cause reload loops.

Equivalent explicit command for watch mode:

```bash
python -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload \
  --reload-dir app \
  --reload-include '*.py' \
  --reload-exclude '.venv/*' \
  --reload-exclude 'tests/*' \
  --reload-exclude 'scripts/*' \
  --reload-exclude 'sql/*' \
  --reload-exclude 'docs/*' \
  --reload-exclude '.git/*' \
  --reload-exclude '.pytest_cache/*' \
  --reload-exclude '__pycache__/*'
```

## Run tests (automated)

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Current automated test:

- `tests/test_health.py` (smoke test de `/api/v1/health`)
- `tests/test_auth_api.py` (contratos HTTP de `POST /auth/signup`)
- `tests/test_profiles_api.py` (contratos HTTP de `/profiles/me`, `PATCH /profiles/parent`, `PATCH /profiles/teacher`, y conflicto de rol)
- `tests/test_bookings_api.py` (contratos HTTP de creación/agenda/detalle/cancelación de bookings)
- `tests/test_teacher_control_api.py` (contratos HTTP de control center Teacher y listado de chats)
- `tests/test_marketplace_api.py` (contratos HTTP del marketplace de profesoras)

## Run tests (manual API checks)

1. Levanta la API:

```bash
cd backend
source .venv/bin/activate
make dev
```

2. Verifica health:

```bash
curl -i http://localhost:8000/api/v1/health
```

3. Obtén un access token válido de Supabase (por ejemplo, desde el frontend ya logueado en `localStorage` key `kidario_supabase_tokens_v1`).

4. Prueba endpoint protegido:

```bash
curl -i http://localhost:8000/api/v1/profiles/me \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>"
```

5. Prueba patch parent:

```bash
curl -i -X PATCH http://localhost:8000/api/v1/profiles/parent \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Maria",
    "last_name": "Silva",
    "children_ops": {
      "upsert": [
        {
          "name": "Lucas",
          "birth_month_year": "2017-04"
        }
      ]
    }
  }'
```

## API base

- Prefix: `/api/v1`
- Health: `/api/v1/health`
- Auth:
  - `POST /api/v1/auth/signup`
- Profiles:
  - `GET /api/v1/profiles/me`
  - `GET /api/v1/profiles/parent`
  - `GET /api/v1/profiles/teacher`
  - `PATCH /api/v1/profiles/parent`
  - `PATCH /api/v1/profiles/teacher`
  - `POST /api/v1/profiles/teacher/photo` (`multipart/form-data`, field `file`)
- Marketplace:
  - `GET /api/v1/marketplace/teachers`
  - `GET /api/v1/marketplace/teachers/{teacher_id}`
  - `GET /api/v1/marketplace/teachers/{teacher_id}/reviews`
- Bookings:
  - `POST /api/v1/bookings`
  - `GET /api/v1/bookings/parent/agenda`
  - `GET /api/v1/bookings/teacher/agenda`
  - `GET /api/v1/bookings/{booking_id}`
  - `GET /api/v1/bookings/{booking_id}/review`
  - `POST /api/v1/bookings/{booking_id}/review`
  - `PATCH /api/v1/bookings/{booking_id}/reschedule`
  - `PATCH /api/v1/bookings/{booking_id}/teacher/decision`
  - `PATCH /api/v1/bookings/{booking_id}/teacher/reschedule`
  - `PATCH /api/v1/bookings/{booking_id}/cancel`
  - `PATCH /api/v1/bookings/{booking_id}/complete`
  - `GET /api/v1/teachers/{teacher_id}/availability/slots`
- Chat:
  - `GET /api/v1/chat/threads`
  - `POST /api/v1/chat/threads/from-booking/{booking_id}`
  - `GET /api/v1/chat/threads/{thread_id}`
  - `GET /api/v1/chat/threads/{thread_id}/messages`
  - `POST /api/v1/chat/threads/{thread_id}/messages`
- Teacher domain:
  - `GET /api/v1/teacher/control-center/overview`
  - `GET /api/v1/teacher/students/{child_id}/timeline`
- Admin:
  - `PATCH /api/v1/admin/teachers/{teacher_id}/activation`
  - `GET /api/v1/admin/reviews`
  - `PATCH /api/v1/admin/reviews/{review_id}`

The current backend contract uses the normalized schema introduced in `sql/012_normalized_supabase_schema.sql`.
Public payloads use internal `parent_id`, `teacher_id`, `child_id`, ISO `starts_at`, `amount_cents`, and payment rows from
`payment_orders`/`payment_charges`; legacy `profile_id`, `date_iso`/`time`, `price_total`, and booking payment columns are
only populated internally where older database constraints still require them.

## Database schema

Apply SQL scripts in order (Supabase SQL Editor):

- `sql/000_reset_public_schema.sql` (optional, destructive reset for development only)
- `sql/001_init_profiles.sql`
- `sql/002_rls_profiles.sql`
- `sql/004_init_bookings.sql`
- `sql/005_rls_bookings.sql`
- `sql/006_normalize_parent_children_gender.sql`
- `sql/007_init_chat.sql`
- `sql/008_rls_chat.sql`
- `sql/009_add_follow_up_objectives.sql`
- `sql/010_add_booking_activity_plans.sql`
- `sql/011_add_parent_cpf.sql`
- `sql/012_normalized_supabase_schema.sql`
- `sql/003_rls_validation.sql` (optional smoke test)

`002` enables RLS with owner-based policies for `authenticated` users and keeps
full access for `service_role/postgres` so current FastAPI direct DB access keeps working.

Use `000` only when you want to wipe the current `public` schema and start from
zero. It drops all public tables, functions, triggers, policies, views and data,
then recreates the schema grants expected by Supabase. It does not drop
`auth.users`.

`012` introduces the normalized Supabase model for `users`, `parents`, `teachers`,
`children`, class packages, Pagar.me-ready payment records, and mobile
notifications. It backfills from the current tables and keeps sync triggers for
the legacy table contract while backend services are migrated incrementally. If
legacy parent/teacher CPF, phone, birth date, or address data is incomplete or
CPF values are duplicated, the migration uses deterministic placeholder values
so foreign keys and `NOT NULL`/`UNIQUE` constraints can be created; clean these
records before enabling production payment flows that require verified
CPF/address data.

Quick verification query:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users',
    'addresses',
    'parents',
    'children',
    'teachers',
    'profiles',
    'parent_profiles',
    'parent_children',
    'teacher_profiles',
    'teacher_specialties',
    'teacher_formations',
    'teacher_experiences',
    'teacher_availability',
    'package_plans',
    'booking_packages',
    'booking_reviews',
    'payment_orders',
    'payment_charges',
    'notification_devices',
    'notifications'
  )
order by tablename, policyname;
```

## Auth

Bearer token expected in `Authorization` header.
JWT is verified against Supabase JWKS.

If your Supabase project signs JWTs with `HS256`, configure:

- `KIDARIO_SUPABASE_JWT_SECRET` in `.env` (Project Settings -> API -> JWT secret)

If you get SSL errors calling Supabase (JWKS or Auth endpoints like `/auth/v1/signup`, e.g. `CERTIFICATE_VERIFY_FAILED`):

- Upgrade deps to install `certifi`: `pip install -e ".[dev]"`
- Optionally set `KIDARIO_SUPABASE_JWKS_CA_BUNDLE` to your corporate/local CA bundle path.
  - Example macOS with python.org installer: run `Install Certificates.command`.

## Signup Anti-Spam

`POST /api/v1/auth/signup` now supports:

- Honeypot rejection (`honeypot` field must stay empty)
- In-memory rate limiting (by IP and by email)
- Optional CAPTCHA validation in backend (Turnstile or reCAPTCHA)

Recommended backend env vars:

- `KIDARIO_SIGNUP_RATE_LIMIT_WINDOW_SECONDS=300`
- `KIDARIO_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS_PER_IP=20`
- `KIDARIO_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL=8`
- `KIDARIO_SIGNUP_CAPTCHA_REQUIRED=true`
- `KIDARIO_SIGNUP_CAPTCHA_PROVIDER=turnstile` (or `recaptcha`)
- `KIDARIO_SIGNUP_CAPTCHA_SECRET_KEY=<provider-secret>`
- `KIDARIO_SIGNUP_CAPTCHA_VERIFY_URL=` (optional override)

When running behind a proxy/load balancer, keep:

- `KIDARIO_TRUST_PROXY_HEADERS=true`

## Teacher Activity Planner (LLM)

The teacher activity plan can be generated by OpenAI and persisted per booking.

Configure in `.env`:

- `KIDARIO_TEACHER_ACTIVITY_LLM_ENABLED=true`
- `KIDARIO_TEACHER_ACTIVITY_LLM_API_KEY=<YOUR_OPENAI_API_KEY>`
- `KIDARIO_TEACHER_ACTIVITY_LLM_MODEL=gpt-4o-mini`
- `KIDARIO_TEACHER_ACTIVITY_LLM_BASE_URL=https://api.openai.com/v1`
- `KIDARIO_TEACHER_ACTIVITY_LLM_TIMEOUT_SECONDS=8.0`
- `KIDARIO_TEACHER_ACTIVITY_LLM_CA_BUNDLE=` (optional, use your corporate/local CA bundle)

Behavior:

- If disabled or without API key, backend uses deterministic fallback activities.
- If enabled and key is set, backend calls OpenAI once per booking context and stores the plan.
- On subsequent requests, cached/persisted plan is reused unless booking context changes.

## Teacher Profile Photo Upload

The recommended flow is server-side upload through:

- `POST /api/v1/profiles/teacher/photo`

Rules implemented:

- Random object key (UUID-based), no user-provided path.
- Validation for image MIME types (`jpg/png/webp`) and max size.
- Upload to S3-compatible storage when S3 credentials are configured.
- Fallback to Supabase Storage REST using `KIDARIO_SUPABASE_SERVICE_ROLE_KEY`.
- Profile update in DB after upload; rollback attempt if DB update fails.
- Read endpoints return a resolved image URL (signed when possible; public URL fallback).

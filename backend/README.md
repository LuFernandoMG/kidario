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

Current automated tests:

- `tests/test_health.py` (smoke test de `/api/v2/health`)
- `tests/test_auth_api.py` (contratos HTTP de `POST /api/v2/auth/signup`)
- `tests/test_profiles_api.py` y `tests/test_v2_profiles_api.py` (identidad, padres, profesores, direcciones e hijos)
- `tests/test_v2_explore_api.py` (contratos HTTP de `/api/v2/explore`)
- `tests/test_bookings_api.py` y `tests/test_v2_bookings_payments_api.py` (bookings, pagos y agenda v2)
- `tests/test_v2_packages_api.py` (planes de paquetes y compras v2)
- `tests/test_v2_reviews_api.py` (reviews públicos, booking-level y moderación v2)
- `tests/test_v2_notifications_api.py` (dispositivos, preferencias y notificaciones v2)
- `tests/test_teacher_control_api.py` (control center Teacher y chats v2)
- `tests/test_admin_api.py` (dashboard, acceso, activación y reviews admin v2)

## Run tests (manual API checks)

1. Levanta la API:

```bash
cd backend
source .venv/bin/activate
make dev
```

2. Verifica health:

```bash
curl -i http://localhost:8000/api/v2/health
```

3. Obtén un access token válido de Supabase (por ejemplo, desde el frontend ya logueado en `localStorage` key `kidario_supabase_tokens_v1`).

4. Prueba endpoint protegido:

```bash
curl -i http://localhost:8000/api/v2/me \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>"
```

5. Prueba patch parent:

```bash
curl -i -X PATCH http://localhost:8000/api/v2/parents/me \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Maria",
    "last_name": "Silva",
    "phone": "(11) 99999-9999",
    "birth_date": "1987-10-01",
    "address": {
      "street": "Rua A",
      "district": "Centro",
      "city": "Sao Paulo",
      "state": "SP"
    }
  }'
```

## API base

The active API is `/api/v2`. The previous-version router is no longer mounted in `app.main`.

- Prefix: `/api/v2`
- Health:
  - `GET /api/v2/health`
- Auth:
  - `POST /api/v2/auth/signup`
- Identity:
  - `GET /api/v2/me`
  - `PATCH /api/v2/me`
- Parents:
  - `GET /api/v2/parents/me`
  - `PATCH /api/v2/parents/me`
  - `GET /api/v2/parents/me/children`
  - `POST /api/v2/parents/me/children`
  - `PATCH /api/v2/parents/me/children/{child_id}`
  - `DELETE /api/v2/parents/me/children/{child_id}`
- Teachers:
  - `GET /api/v2/teachers/me`
  - `PATCH /api/v2/teachers/me`
  - `GET /api/v2/teachers/me/package-plans`
  - `POST /api/v2/teachers/me/package-plans`
  - `PATCH /api/v2/teachers/me/package-plans/{package_plan_id}`
- Explore:
  - `GET /api/v2/explore/teachers`
  - `GET /api/v2/explore/teachers/{teacher_id}`
- Bookings:
  - `POST /api/v2/bookings`
  - `GET /api/v2/bookings/{booking_id}`
  - `GET /api/v2/parents/me/bookings`
  - `GET /api/v2/teachers/me/bookings`
  - `PATCH /api/v2/bookings/{booking_id}/reschedule`
  - `PATCH /api/v2/bookings/{booking_id}/teacher/reschedule`
  - `POST /api/v2/bookings/{booking_id}/decision`
  - `POST /api/v2/bookings/{booking_id}/cancel`
  - `POST /api/v2/bookings/{booking_id}/complete`
  - `POST /api/v2/bookings/{booking_id}/review`
  - `GET /api/v2/bookings/{booking_id}/review`
- Packages:
  - `POST /api/v2/packages/purchases`
  - `GET /api/v2/parents/me/packages`
  - `GET /api/v2/teachers/me/packages`
- Payments:
  - `GET /api/v2/bookings/{booking_id}/payment`
  - `GET /api/v2/parents/me/payments`
  - `GET /api/v2/teachers/me/payments`
- Reviews:
  - `GET /api/v2/reviews?teacher_id={teacher_id}`
  - `GET /api/v2/admin/reviews`
  - `PATCH /api/v2/admin/reviews/{review_id}`
- Notifications:
  - `GET /api/v2/notifications/devices`
  - `POST /api/v2/notifications/devices`
  - `DELETE /api/v2/notifications/devices/{device_id}`
  - `GET /api/v2/notifications/preferences`
  - `PUT /api/v2/notifications/preferences`
  - `GET /api/v2/notifications`
  - `POST /api/v2/notifications/{notification_id}/read`
  - `POST /api/v2/admin/notifications`

V2 profile responses include nested `address` for self-service parent/teacher profiles, but never return raw `cpf`;
responses expose only `cpf_masked`. Public signup remains limited to `parent` and `teacher`; internal admin users use
`users.role = 'admin'`.
V2 explore responses are self-contained for initial UI rendering: availability preview, rating/review summary, latest reviews,
and package summaries come in the teacher list/detail payloads.
V2 packages use `package_plans` for teacher-managed offers and `booking_packages` for purchases. Creating a package
purchase also creates a `payment_order` and first `payment_charge`, using the same cents/currency contract as bookings.
Package purchase responses include derived session counters, and bookings with `package_id` require an active package for
the same parent, teacher and child to avoid duplicate per-class charges. For v2 bookings, `payment_method` is required only
when the booking is not covered by a package.
V2 reviews are exposed through a consolidated public list by `teacher_id`, booking-level create/read routes, and admin
moderation routes. V2 notifications cover device registration, channel/type preferences, inbox reads, and admin-created
notification rows; delivery providers can consume the same normalized tables later.

The current backend contract uses the normalized schema introduced in `sql/012_normalized_supabase_schema.sql`.
Public payloads use internal `parent_id`, `teacher_id`, `child_id`, ISO `starts_at`, `amount_cents`, and payment rows from
`payment_orders`/`payment_charges`. Legacy `profile_id`, `date_iso`/`time`, `price_total`, and booking payment columns may
remain in old tables for migration history, but the mounted API does not use them as source of truth.

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
- `sql/013_api_v2_cutover.sql`
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

`013` is the API v2 cutover migration. It relaxes old `NOT NULL` constraints that
belonged to the v1 contract, disables booking-to-payment compatibility sync that
would duplicate normalized payment rows, and adds normalized indexes/FKs for
teacher availability, follow-ups and activity plans.

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

`POST /api/v2/auth/signup` supports:

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

## Address geocoding

Parent and teacher profile writes enrich addresses server-side. The frontend keeps collecting only postal address fields;
the backend uses ViaCEP by CEP to improve the Brazilian address used for lookup, then Google Geocoding to persist
`addresses.latitude` and `addresses.longitude`.

Configure in `.env`:

- `KIDARIO_GOOGLE_GEOCODING_API_KEY=<google-geocoding-api-key>`
- `KIDARIO_GOOGLE_GEOCODING_BASE_URL=https://maps.googleapis.com/maps/api/geocode/json`
- `KIDARIO_GOOGLE_GEOCODING_TIMEOUT_SECONDS=5.0`
- `KIDARIO_GOOGLE_GEOCODING_CA_BUNDLE=` (optional, use your corporate/local CA bundle)
- `KIDARIO_VIACEP_BASE_URL=https://viacep.com.br/ws`
- `KIDARIO_VIACEP_TIMEOUT_SECONDS=4.0`
- `KIDARIO_VIACEP_CA_BUNDLE=` (optional, use your corporate/local CA bundle)

If `KIDARIO_GOOGLE_GEOCODING_API_KEY` is empty, registration/profile updates still work and coordinates remain `null`.

## Pagar.me PSP

Configure in `.env`:

- `KIDARIO_PAGARME_SECRET_KEY=<sk_test_or_live>`
- `KIDARIO_PAGARME_BASE_URL=https://api.pagar.me/core/v5`
- `KIDARIO_PAGARME_WEBHOOK_SECRET=<webhook-secret>`
- `KIDARIO_PAGARME_PLATFORM_RECIPIENT_ID=<kidario-recipient-id>`
- `KIDARIO_PLATFORM_FEE_PERCENT=20`

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

- `POST /api/v2/teachers/me/photo`

Rules implemented:

- Random object key (UUID-based), no user-provided path.
- Validation for image MIME types (`jpg/png/webp`) and max size.
- Server-side normalization: center-crop to square, resize to max `KIDARIO_PROFILE_PHOTO_TARGET_SIZE_PIXELS`
  (default `512`), and store as optimized JPEG with `KIDARIO_PROFILE_PHOTO_JPEG_QUALITY` (default `82`).
- Upload to S3-compatible storage when S3 credentials are configured.
- Fallback to Supabase Storage REST using `KIDARIO_SUPABASE_SERVICE_ROLE_KEY`.
- Profile update in DB after upload; rollback attempt if DB update fails.
- Read endpoints return a resolved image URL (signed when possible; public URL fallback).

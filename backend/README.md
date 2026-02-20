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

```bash
uvicorn app.main:app --reload --port 8000
```

## Run tests (automated)

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Current automated test:

- `tests/test_health.py` (smoke test de `/api/v1/health`)
- `tests/test_profiles_api.py` (contratos HTTP de `/profiles/me`, `PATCH /profiles/parent`, `PATCH /profiles/teacher`, y conflicto de rol)
- `tests/test_bookings_api.py` (contratos HTTP de creación/agenda/detalle/cancelación de bookings)
- `tests/test_marketplace_api.py` (contratos HTTP del marketplace de profesoras)

## Run tests (manual API checks)

1. Levanta la API:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
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
- Profiles:
  - `GET /api/v1/profiles/me`
  - `PATCH /api/v1/profiles/parent`
  - `PATCH /api/v1/profiles/teacher`
- Marketplace:
  - `GET /api/v1/marketplace/teachers`
  - `GET /api/v1/marketplace/teachers/{teacher_profile_id}`
- Bookings:
  - `POST /api/v1/bookings`
  - `GET /api/v1/bookings/parent/agenda`
  - `GET /api/v1/bookings/teacher/agenda`
  - `GET /api/v1/bookings/{booking_id}`
  - `PATCH /api/v1/bookings/{booking_id}/reschedule`
  - `PATCH /api/v1/bookings/{booking_id}/cancel`
  - `PATCH /api/v1/bookings/{booking_id}/complete`
  - `GET /api/v1/teachers/{teacher_profile_id}/availability/slots`
- Admin:
  - `PATCH /api/v1/admin/teachers/{profile_id}/activation`

## Database schema

Apply SQL scripts in order (Supabase SQL Editor):

- `sql/001_init_profiles.sql`
- `sql/002_rls_profiles.sql`
- `sql/004_init_bookings.sql`
- `sql/005_rls_bookings.sql`
- `sql/003_rls_validation.sql` (optional smoke test)

`002` enables RLS with owner-based policies for `authenticated` users and keeps
full access for `service_role/postgres` so current FastAPI direct DB access keeps working.

Quick verification query:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'parent_profiles',
    'parent_children',
    'teacher_profiles',
    'teacher_specialties',
    'teacher_formations',
    'teacher_experiences',
    'teacher_availability'
  )
order by tablename, policyname;
```

## Auth

Bearer token expected in `Authorization` header.
JWT is verified against Supabase JWKS.

If your Supabase project signs JWTs with `HS256`, configure:

- `KIDARIO_SUPABASE_JWT_SECRET` in `.env` (Project Settings -> API -> JWT secret)

If you get SSL errors fetching JWKS (e.g. `CERTIFICATE_VERIFY_FAILED`):

- Upgrade deps to install `certifi`: `pip install -e ".[dev]"`
- Optionally set `KIDARIO_SUPABASE_JWKS_CA_BUNDLE` to your corporate/local CA bundle path.

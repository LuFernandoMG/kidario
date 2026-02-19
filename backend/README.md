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
- Admin:
  - `PATCH /api/v1/admin/teachers/{profile_id}/activation`

## Database schema

Initial SQL migration:

- `sql/001_init_profiles.sql`

Apply manually in Supabase SQL Editor for now.

## Auth

Bearer token expected in `Authorization` header.
JWT is verified against Supabase JWKS.

If your Supabase project signs JWTs with `HS256`, configure:

- `KIDARIO_SUPABASE_JWT_SECRET` in `.env` (Project Settings -> API -> JWT secret)

If you get SSL errors fetching JWKS (e.g. `CERTIFICATE_VERIFY_FAILED`):

- Upgrade deps to install `certifi`: `pip install -e ".[dev]"`
- Optionally set `KIDARIO_SUPABASE_JWKS_CA_BUNDLE` to your corporate/local CA bundle path.

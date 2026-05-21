# Kidario Web App

Kidario `apps/web` is the mobile-first web app for parents and teachers. It keeps the current backend contracts and now follows a single folder convention without `domains`.

## Current Scope

### Shared pages

- `/` welcome
- `/login`
- `/recuperar-senha`
- `/redefinir-senha`
- hidden admin dashboard path

### Parent flow

- `/cadastro`
- `/explorar`
- `/professora/:id`
- `/agendar/:id`
- `/checkout/:id`
- `/confirmacao-reserva/:bookingId`
- `/aula/:bookingId`
- `/chat/:threadId`
- `/agenda`
- `/progresso`
- `/perfil`
- `/perfil/responsavel`

### Teacher flow

- `/inicio`
- `/agenda` when the authenticated role is `teacher`
- `/alunos`
- `/planejamento`
- `/financeiro`
- `/aulas/:bookingId/cierre`
- `/perfil/professora`
- `/convites/professoras/cadastro-privado-kidario-a8k3m2`

### Legacy redirects still supported

- `/escolher-professora`
- `/professora/centro`
- `/professora/inicio`
- `/professora/agenda`
- `/professora/alunos`
- `/professora/planejamento`
- `/professora/financeiro`

Removed:

- `/escolher-perfil`
- `ChooseProfile.tsx`

## Folder Layout

```text
src/
  pages/
    parent/
    teacher/
  components/
    teacher/
  data/
    api/
    queries/
    mock/
  routes/
  types/
  hooks/
  lib/
```

Rules:

- `src/pages` root contains only cross-role pages.
- `src/pages/parent` contains the parent journey.
- `src/pages/teacher` contains the teacher journey.
- `src/data/api` contains all backend clients.
- `src/data/queries` contains TanStack Query hooks.
- `src/data/mock` contains mocks such as [`src/data/mock/mockTeachers.ts`](./src/data/mock/mockTeachers.ts).
- `src/routes` is the single source of truth for route constants, builders, and legacy aliases.
- `src/types` is the shared type reference layer.
- `src/domains` is no longer part of the frontend architecture.

More detail lives in [`../../docs/architecture.md`](../../docs/architecture.md).

## Stack

- React 18
- TypeScript
- Vite 5
- React Router
- TanStack Query
- Tailwind CSS + shadcn/ui
- Framer Motion
- Vitest + Testing Library
- Playwright

## Setup

Requirements:

- Node.js 18+
- npm

Install and run:

```bash
cd frontend
npm install
npm run dev
```

You can also run the same scripts directly from `frontend/apps/web`.

## Environment

Create `.env.local` from `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_API_URL`
- `VITE_SIGNUP_CAPTCHA_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

The frontend expects the backend API on `http://localhost:8000/api/v1` by default.

## Scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run test
npm run test:watch
npm run test:e2e
```

## Notes

- The app keeps the existing backend and auth flow.
- Parent and teacher web flows are both active.
- The marketplace still falls back to mock data in some scenarios.
- The local dependency tree is currently hoisted at `frontend/node_modules` by the workspace root.

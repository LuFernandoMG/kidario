# Frontend Architecture

## Goal

Keep `frontend/apps/web` and `frontend/apps/mobile` under one frontend workspace, with shared platform-neutral contracts in `frontend/packages/shared`.

## Source Of Truth

### Pages

- `apps/web/src/pages` root: shared pages only
- `apps/web/src/pages/parent`: parent-only journey
- `apps/web/src/pages/teacher`: teacher-only journey

Pages are route entries. They should not be wrappers around files in another feature tree.

### Data

- `apps/web/src/data/api`: backend clients and HTTP contracts
- `apps/web/src/data/queries`: TanStack Query hooks
- `apps/web/src/data/mock`: mock datasets

If a module talks to the backend, it belongs in `data/api`.

### Routes

- `packages/shared/src/routes/frontend.ts`: canonical frontend route contract consumed by web and mobile
- `apps/web/src/routes/paths.ts`: web-facing re-exports for shared canonical routes
- `apps/web/src/routes/teacher.ts`: web-facing re-exports for teacher canonical routes and builders
- `apps/web/src/routes/admin.ts`: hidden admin path
- `apps/web/src/routes/legacy.ts`: web-facing re-exports for supported legacy aliases
- `apps/mobile/src/routes/frontend.ts`: mobile-facing re-export of the shared frontend route contract

Do not spread route strings through the app when a reusable constant already exists.

### Mobile Shell Contracts

- `packages/shared/src/mobile/frontendWeb.ts`: frontend base URL normalization and URL classification
- `packages/shared/src/mobile/deepLinks.ts`: Kidario mobile deep-link parsing and builders
- `packages/shared/src/mobile/networkStatus.ts`: shared network status type and pure state transitions
- `packages/shared/src/mobile/webviewBridge.ts`: WebView upload bridge message contract and bootstrap script
- `apps/mobile/src/lib`: mobile-facing wrappers around these shared contracts

Keep native modules, Expo APIs, React Native components, and WebView component wiring inside `apps/mobile`. Shared mobile shell contracts must stay platform-neutral.

### Types

- `packages/shared/src`: platform-neutral contracts and helpers that can run in web, React Native, and Node scripts
- `apps/web/src/types`: shared references for cross-module types

Keep one-off component prop types colocated. Shared business or transport types belong in `types` or are re-exported through `types`.

### Components

- `apps/web/src/components`: shared and feature UI
- `apps/web/src/components/teacher`: teacher-specific UI blocks

### Lib

- `apps/web/src/lib`: cross-cutting helpers only

Examples:

- auth session helpers
- generic backend utility helpers
- formatting and storage helpers

`lib` is not for routes, pages, or API clients.

## Import Rules

- Cross-platform modules must live in `packages/shared` and avoid browser-only, React DOM-only, or React Native-only APIs.
- Mobile shell helpers that are pure TypeScript should live under `packages/shared/src/mobile`; `apps/mobile/src/lib` should only adapt them to Expo environment variables or keep backward-compatible imports.
- Route components in `App.tsx` must import from `apps/web/src/pages` and `apps/web/src/routes`.
- Page components may import from `components`, `data`, `routes`, `hooks`, `lib`, and `types`.
- `data/queries` may import from `data/api`, `lib`, and `types`.
- `data/api` should not import from `pages`.
- Mobile route wrappers must import route constants from `apps/mobile/src/routes/frontend`, which re-exports `@kidario/shared/routes/frontend`.

## Active Flows

### Parent

- auth
- signup
- explore
- teacher profile
- booking scheduler
- checkout
- booking confirmation
- agenda
- booking detail
- chat
- progress
- profile redirect and parent profile settings

### Teacher

- private signup
- control center
- agenda
- students
- planning
- finance
- lesson closure
- profile settings

### Shared

- welcome
- login
- recover password
- reset password
- hidden admin dashboard

## Legacy Support

Still supported:

- `/escolher-professora`
- `/professora/centro`
- `/professora/inicio`
- `/professora/agenda`
- `/professora/alunos`
- `/professora/planejamento`
- `/professora/financeiro`

Removed:

- `/escolher-perfil`
- `src/pages/ChooseProfile.tsx`

## Explicit Non-Goals

- No `apps/web/src/domains`
- No page re-export wrappers
- No teacher flow hidden behind placeholders
- No UI redesign in this cleanup phase

## Mobile Preparation

This structure is the reference baseline for `apps/mobile`:

- pages define the real frontend scope
- `packages/shared/src/routes/frontend.ts` defines the stable URL contract
- data/api defines reusable backend contracts
- shared types are no longer hidden inside domain folders

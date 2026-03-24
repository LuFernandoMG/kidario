# Mobile Implementation Backlog

This backlog defines the implementation work required to build `/mobile` as a WebView-first Expo app that wraps the current [`/frontend`](../README.md) and keeps the web app as the main product surface.

## Strategy

The active strategy is no longer "duplicate the frontend as a native app".

The active strategy is:

- keep `frontend` as the single source of truth for product behavior
- use `/mobile` as a thin shell around the current web app
- add native bridges only when they solve a real mobile product gap
- postpone selective native rewrites until the mobile wrapper proves product value

Paused path:

- a fully parallel `mobile/src/data/api` + `queries` + `session` stack is not part of the active roadmap

## Milestone 1: Foundation

Goal:

- `/mobile` exists, builds as an Expo app and has a basic route structure.

Stories:

| ID | Priority | Estimate | Story |
| --- | --- | --- | --- |
| MOB-001 | P0 | M | Create `/mobile` Expo Router app with TypeScript, linting, env setup and base scripts. |
| MOB-002 | P0 | S | Add root app layout, not-found screen and route groups for `shared`, `parent` and `teacher`. |
| MOB-003 | P0 | M | Create the mobile theme layer (`colors`, `spacing`, `typography`) and base `Screen` container. |
| MOB-004 | P1 | M | Port a minimal shared `types` layer that can support future bridges without driving a parallel app architecture. |

## Milestone 2: WebView Shell

Goal:

- The mobile app loads the current frontend as the primary runtime surface.

Stories:

| ID | Priority | Estimate | Story |
| --- | --- | --- | --- |
| MOB-005 | P0 | M | Implement frontend shell configuration and a reusable shell screen that loads the current web app. |
| MOB-006 | P0 | M | Add native WebView rendering and a web fallback renderer for local browser debugging. |
| MOB-007 | P0 | S | Route shared, parent and teacher shell entry screens to the corresponding frontend paths. |
| MOB-008 | P1 | M | Add shell loading, error, retry and offline states plus external navigation rules. |
| MOB-009 | P1 | S | Extend the development diagnostics to validate the shell URL, frontend availability and WebView prerequisites. |

Acceptance criteria:

- `/mobile` can open the current frontend root
- shared, parent and teacher entry routes can target matching frontend URLs
- local development works with the frontend running separately
- the mobile shell does not require duplicating product logic already present in `frontend`

## Milestone 3: Wrapped Frontend MVP

Goal:

- The current web product is usable from the mobile shell.

Stories:

| ID | Priority | Estimate | Story |
| --- | --- | --- | --- |
| MOB-010 | P0 | M | Validate shared auth flows inside the shell (`/`, `/login`, recovery and reset routes). |
| MOB-011 | P0 | M | Validate parent entry flows inside the shell (`/cadastro`, `/explorar`, `/perfil`, `/agenda`, `/chat`). |
| MOB-012 | P0 | M | Validate teacher entry flows inside the shell (`/inicio`, `/agenda`, `/alunos`, `/planejamento`, `/financeiro`). |
| MOB-013 | P1 | M | Document the current limitations of shell-based auth, storage and file upload on mobile devices. |
| MOB-014 | P1 | M | Add a native splash/loading shell UX around the wrapped frontend. |

## Milestone 4: Native Bridges

Goal:

- Add only the native capabilities that materially improve the shell experience.

Stories:

| ID | Priority | Estimate | Story |
| --- | --- | --- | --- |
| MOB-020 | P1 | M | Add deep link handling for password reset and internal route opening. |
| MOB-021 | P1 | M | Evaluate and implement a bridge for file upload flows that are weak inside plain WebView. |
| MOB-022 | P2 | M | Evaluate push notifications for chat and agenda. |
| MOB-023 | P2 | M | Add network-aware UX for offline and reconnection states. |

## Milestone 5: Selective Native Extraction

Goal:

- Replace only the highest-value mobile surfaces with native screens if the shell proves insufficient.

Stories:

| ID | Priority | Estimate | Story |
| --- | --- | --- | --- |
| MOB-030 | P2 | L | Define the first candidate flows for native extraction based on real usage and shell pain points. |
| MOB-031 | P2 | L | Extract only one flow at a time behind a stable roadmap decision, starting with the highest-value surface. |

## Definition of Done

A story is done only if:

- the capability exists in `/mobile`
- it reduces duplication instead of increasing it
- the wrapped frontend behavior remains the source of truth
- development and debugging instructions are documented
- the result can be manually validated in the current shell workflow

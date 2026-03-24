# Mobile Shell Validation

This document defines the validation scope for milestone 3 of the WebView-first mobile strategy.

## Goal

Confirm that the current [`/frontend`](../README.md) can be reached from `/mobile` through explicit shell entry points, without rebuilding the same product logic natively.

## Preconditions

1. Run the frontend separately.
2. Set `EXPO_PUBLIC_FRONTEND_WEB_URL` in [`/mobile/.env.example`](../../mobile/.env.example) or rely on the default `http://localhost:8080`.
3. Start the mobile shell from [`/mobile`](../../mobile/README.md).

## Shared Auth Flows

| Mobile shell route | Frontend target | Story |
| --- | --- | --- |
| `/` | `/` | MOB-010 |
| `/login` | `/login` | MOB-010 |
| `/recover-password` | `/recuperar-senha` | MOB-010 |
| `/reset-password` | `/redefinir-senha` | MOB-010 |

Validation expectations:

- the wrapped frontend renders without a shell error
- navigation remains owned by the frontend
- reset and recover routes can be opened directly from the shell

## Parent Entry Flows

| Mobile shell route | Frontend target | Story |
| --- | --- | --- |
| `/signup` | `/cadastro` | MOB-011 |
| `/explore` | `/explorar` | MOB-011 |
| `/profile` | `/perfil` | MOB-011 |
| `/agenda` | `/agenda` | MOB-011 |
| `/chat/:threadId` | `/chat/:threadId` | MOB-011 |

Validation expectations:

- the shell reaches the correct frontend route without duplicating product logic
- profile and agenda behave as frontend-owned surfaces
- chat is validated with a real `threadId` captured from the existing product

## Teacher Entry Flows

| Mobile shell route | Frontend target | Story |
| --- | --- | --- |
| `/home` | `/inicio` | MOB-012 |
| `/teacher-agenda` | `/agenda` | MOB-012 |
| `/students` | `/alunos` | MOB-012 |
| `/planning` | `/planejamento` | MOB-012 |
| `/finance` | `/financeiro` | MOB-012 |
| `/private-signup` | `/convites/professoras/cadastro-privado-kidario-a8k3m2` | Supporting shell coverage |

Validation expectations:

- teacher routes remain frontend-owned
- `/teacher-agenda` intentionally maps to frontend `/agenda` to avoid a route collision inside Expo Router
- teacher private signup remains reachable from the shell

## Current Result

Milestone 3 route coverage now exists in `/mobile` for:

- shared auth routes
- parent core entry routes
- teacher core entry routes
- parent chat via a dynamic shell route

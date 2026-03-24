# Mobile Native Extraction Decision

## Decision

Date:

- 2026-03-24

Decision:

- the first selectively extracted native flow is the unauthenticated mobile entry surface

## Why This Flow

- it has the lowest coupling to backend contracts
- it improves launch UX immediately
- it provides clear native value without duplicating the main product logic
- it can act as a stable entry hub for parent, teacher and shared shell routes

## What Remains Wrapped

The following still remain frontend-owned inside the shell:

- login
- recover password
- reset password
- parent signup
- parent explore, agenda, profile and chat
- teacher home, agenda, students, planning, finance and private signup

## Rollout Rule

This extraction is enabled behind a mobile flag so it can be reverted without changing the roadmap back to a fully wrapped shell.

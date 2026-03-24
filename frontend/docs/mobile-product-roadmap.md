# Mobile Product Roadmap

## Decision

Date:

- 2026-03-23

Decision:

- Kidario mobile will follow a WebView-first strategy.

Reasoning:

- the current `frontend` already contains the product behavior we want to expose on mobile
- maintaining a parallel React Native app with its own UI, API layer and session model would duplicate too much code and decision-making
- the fastest path to a usable mobile product is to wrap the existing web app and keep `frontend` as the primary surface

What this means:

- `/mobile` becomes a shell, not a second full product implementation
- the active roadmap favors reuse of `frontend` over native reimplementation
- native-only work will be added only when it solves a concrete mobile gap

## Product Phases

### Phase 1: Shell Foundation

Outcome:

- Expo app exists
- route groups and shell scaffolding exist
- the app can load the current frontend

Stories:

- `MOB-001` to `MOB-009`

### Phase 2: Wrapped Frontend MVP

Outcome:

- the mobile shell can expose the same current product flows already alive in `frontend`
- auth, parent and teacher entry routes are validated inside the shell

Stories:

- `MOB-010` to `MOB-014`

### Phase 3: Native Bridges

Outcome:

- mobile-only gaps are covered without replacing the full web app

Candidate bridges:

- deep links
- upload flows
- push notifications
- offline-aware UX

Stories:

- `MOB-020` to `MOB-023`

### Phase 4: Selective Native Extraction

Outcome:

- only if shell limitations are proven by real use, specific flows can be rebuilt natively

Rules:

- one flow at a time
- must have a documented product reason
- must reduce friction that the shell cannot solve well

Stories:

- `MOB-030` onward

Current decision:

- the first extracted flow is the unauthenticated mobile entry surface
- it stays behind `EXPO_PUBLIC_NATIVE_ENTRY_FLOW_ENABLED`
- wrapped frontend routes remain the source of truth for all product behavior after entry

## Guardrails

- `frontend` remains the main source of truth
- avoid parallel domain logic in `/mobile`
- do not build a second complete product surface unless roadmap explicitly changes again
- prefer shell improvements and small native bridges over broad rewrites

## Risks

- App Store review risk if the shell has too little native value
- file upload and auth edge cases may need native bridges
- physical device development depends on shell URL reachability and frontend availability

## Revisit Triggers

This roadmap should be revisited if:

- the shell blocks critical product flows
- app review feedback requires more native behavior
- performance or stability is not acceptable on target devices
- product data shows that a specific flow deserves native extraction

# Shared Hooks Evaluation

## Current Classification

### Shared Pure Logic

- `packages/shared/src/mobile/networkStatus.ts`: shared `NetworkStatus` type and pure transition logic used by mobile platform hooks.

### Data Hooks

- `apps/web/src/data/queries/teacherControl.ts`: React Query hooks for teacher data.

These are data hooks, but they are not shared-ready yet. They depend on the web auth session helper and web-local API modules. Before moving them to `packages/shared`, extract token acquisition and API client dependencies behind injectable functions or shared API clients.

### UI Hooks

- `apps/web/src/hooks/use-toast.ts`: web UI hook coupled to toast component types.
- `apps/web/src/hooks/use-mobile.tsx`: web layout hook coupled to `window.matchMedia`.
- Component-scoped hooks such as `useCarousel`, `useFormField`, `useChart`, and `useSidebar`: keep colocated with their UI components.

### Platform Hooks

- `apps/mobile/src/hooks/useNetworkStatus.native.ts`: native adapter using `@react-native-community/netinfo`.
- `apps/mobile/src/hooks/useNetworkStatus.web.ts`: web adapter using browser online/offline events.

These hooks stay in `apps/mobile` because their event sources are platform-specific. Shared behavior belongs in pure helpers under `packages/shared`.

## Rules

- Put shared data hooks only under `packages/shared` when they avoid DOM, React Native, Expo, router, storage, and UI component imports.
- Keep platform hooks inside app folders or platform-specific files like `.native.ts` and `.web.ts`.
- Keep UI hooks inside the app or component package that owns the rendered UI.
- Prefer extracting pure types, query keys, state reducers, and URL/data transforms before moving full hooks.

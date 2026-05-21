# @kidario/shared

Platform-neutral frontend contracts shared by `apps/web` and `apps/mobile`.

## Contents

- `src/routes/frontend.ts`: canonical frontend route contract and route builders.
- `src/mobile/frontendWeb.ts`: frontend URL normalization and URL classification.
- `src/mobile/deepLinks.ts`: Kidario mobile deep-link parsing and builders.
- `src/mobile/webviewBridge.ts`: WebView upload bridge message types and injected script builders.

## Rules

- Keep this package free of React DOM, React Native, Expo, browser storage, and app component imports.
- Put environment-specific adaptation in the consuming app, not here.
- Export new shared modules explicitly from `package.json`.

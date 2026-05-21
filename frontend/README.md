# Kidario Frontend

This directory is the frontend workspace for Kidario.

## Layout

```text
apps/
  web/        Vite React web app
  mobile/     Expo React Native shell app
packages/
  shared/     platform-neutral route, deep-link, URL, and bridge contracts
docs/         frontend architecture and mobile shell notes
```

The current web product lives in `apps/web`. The mobile WebView shell lives in `apps/mobile`. Platform-neutral contracts live under `packages/shared` and are consumed through `@kidario/shared/*`.

## Scripts

Run from this directory:

```bash
npm install
npm --prefix apps/mobile install
npm run dev
npm run build
npm run test
npm run check
npm run mobile:check
```

The default root scripts forward to `apps/web`; `mobile:*` scripts forward to `apps/mobile`; `shared:*` scripts forward to `packages/shared`. `npm run check` validates the shared package, web lint/tests/build, mobile route contract, and mobile typecheck. Mobile keeps its own lockfile for now, so install its dependencies with `npm --prefix apps/mobile install`.

## Architecture

More detail lives in [`docs/architecture.md`](./docs/architecture.md).

# Kidario Frontend

This directory is the frontend workspace for Kidario.

## Layout

```text
apps/
  web/        Vite React web app
  mobile/     Expo React Native shell app
docs/         frontend architecture and mobile shell notes
```

The current web product lives in `apps/web`. The mobile WebView shell lives in `apps/mobile`. Future shared code should live under `packages/` rather than inside a platform app.

## Scripts

Run from this directory:

```bash
npm install
npm --prefix apps/mobile install
npm run dev
npm run build
npm run test
npm run mobile:check
```

The default root scripts forward to `apps/web`; `mobile:*` scripts forward to `apps/mobile`. Mobile keeps its own lockfile for now, so install its dependencies with `npm --prefix apps/mobile install`.

## Architecture

More detail lives in [`docs/architecture.md`](./docs/architecture.md).

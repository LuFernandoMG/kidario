# Kidario Mobile

Native container for the real `frontend`.

Current strategy: full route fidelity with the public surface of [`frontend/apps/web/src/App.tsx`](/Users/luisfernando/Documents/Independiente/Projects/kidario_app/frontend/apps/web/src/App.tsx), excluding Admin.

`frontend/apps/mobile` does not implement a parallel product UI. It only provides:

- full-screen `WebView` on iOS/Android
- direct handoff to the real frontend on Expo web
- deep links into frontend routes
- native file picker bridge for existing frontend forms
- connectivity handling and minimal shell fallback states

## Setup

```bash
cd frontend
npm install
npm --prefix apps/mobile install
npm run mobile:start
npm run mobile:check
```

For local shell debugging, keep the frontend running separately:

```bash
cd frontend
npm run dev
```

On Expo web, the shell redirects directly to the real frontend instead of embedding it in an `iframe`.
This preserves the same browser session and storage behavior during web debugging.

## Environment

Create `.env` from `.env.example` and define:

- `EXPO_PUBLIC_FRONTEND_WEB_URL`

For local development, the default frontend URL is:

```bash
http://localhost:8080
```

## Development Check

Use the bounded validation script when developing:

```bash
npm run dev:check
```

If your local machine is slow and the script times out, increase the limits temporarily:

```bash
DEV_CHECK_TIMEOUT_MULTIPLIER=2 npm run dev:check
```

The development check now also validates:

- route contract fidelity against `frontend/apps/web/src/routes`
- the shell URL configured in `EXPO_PUBLIC_FRONTEND_WEB_URL`
- that the local frontend responds over HTTP
- that `react-native-webview` is installed

## Validation Coverage

Current validation docs remain in `frontend/docs`, but the mobile implementation target is now route fidelity rather than selective native extraction.

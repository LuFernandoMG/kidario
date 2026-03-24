# Kidario Mobile

Initial Expo Router scaffold for the Kidario mobile app.

Current strategy: WebView-first.

This folder was created as part of `MOB-001` and currently contains:

- Expo Router entry setup
- TypeScript configuration
- ESLint configuration
- Environment variable scaffold
- Mobile shell that loads the existing `frontend`
- dedicated shell entry screens for shared, parent and teacher routes
- development diagnostics for frontend reachability and WebView prerequisites

Current status:

- `/mobile` is now a wrapper over the existing web frontend.
- The current goal is to keep `frontend` as the main product surface.
- Native capabilities will be added only where product value justifies them.

## Setup

```bash
cd mobile
npm install
npm run start
npm run dev:check
```

For local shell debugging, keep the frontend running separately:

```bash
cd ../frontend
npm run dev
```

## Environment

Create `.env` from `.env.example` and define:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_FRONTEND_WEB_URL`
- `EXPO_PUBLIC_BACKEND_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SIGNUP_CAPTCHA_ENABLED`

For local web shell development, the default frontend URL is:

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

- the shell URL configured in `EXPO_PUBLIC_FRONTEND_WEB_URL`
- that the local frontend responds over HTTP
- that `react-native-webview` is installed

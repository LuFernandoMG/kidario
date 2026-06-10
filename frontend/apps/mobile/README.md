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

- route contract fidelity against `frontend/packages/shared/src/routes/frontend.ts`
- the shell URL configured in `EXPO_PUBLIC_FRONTEND_WEB_URL`
- that the local frontend responds over HTTP
- that `react-native-webview` is installed

Pure shell contracts for frontend URLs, deep links, and upload bridge messages live in `frontend/packages/shared/src/mobile`. The files under `frontend/apps/mobile/src/lib` keep the app-facing imports stable and adapt environment-specific values.

## Android RC Preview

Current Android RC shape:

- visible app name: `Kidario`
- Android package: `com.leikvir.kidario`
- deep-link scheme: `kidario-mobile://`
- preview WebView target: `https://use.kidario.app`
- EAS project: `3c4e45d3-e92a-4c86-87c9-012e68e5e7da`
- preview distribution: internal APK through EAS

### Local validation

Run these checks before trying a device build:

```bash
cd frontend/apps/mobile
EXPO_PUBLIC_APP_ENV=preview \
EXPO_PUBLIC_FRONTEND_WEB_URL=https://use.kidario.app \
PATH="$PWD/node_modules/.bin:$PATH" \
node ./scripts/dev-check.mjs
```

Useful targeted checks:

```bash
cd frontend/apps/mobile
node ./scripts/check-route-contract.mjs
node_modules/.bin/expo config --type public
node_modules/.bin/tsc --noEmit --pretty false
node_modules/.bin/eslint app src app.config.ts expo-env.d.ts
```

Expected local result for the current RC configuration:

- route contract passes
- Expo public config includes `android.package = com.leikvir.kidario`
- `EXPO_PUBLIC_FRONTEND_WEB_URL` resolves to `https://use.kidario.app`
- frontend availability check returns HTTP 200

### Android device or emulator

Use a real Android device or emulator with Android Studio/SDK configured:

```bash
cd frontend/apps/mobile
EXPO_PUBLIC_APP_ENV=preview \
EXPO_PUBLIC_FRONTEND_WEB_URL=https://use.kidario.app \
node_modules/.bin/expo run:android
```

Then validate:

- app installs as `Kidario`
- first screen opens the WebView shell
- login, cadastro, explorar, agenda, chat, perfil and logout open through the wrapped web app
- offline/retry state appears when the device network is disabled
- external links leave the WebView instead of replacing the shell
- `kidario-mobile://agenda` opens the app and routes into `/agenda`

If using an existing development build instead of `run:android`, start Metro with:

```bash
cd frontend/apps/mobile
EXPO_PUBLIC_APP_ENV=preview \
EXPO_PUBLIC_FRONTEND_WEB_URL=https://use.kidario.app \
node_modules/.bin/expo start --clear
```

### EAS preview build status

The EAS preview profile is configured in `eas.json` with:

```json
{
  "EXPO_PUBLIC_APP_ENV": "preview",
  "EXPO_PUBLIC_FRONTEND_WEB_URL": "https://use.kidario.app"
}
```

The current remote build attempt is:

```text
a7143a93-4d2f-4de4-9dc4-671b24b2b669
```

Status at the time this note was written:

```text
ERRORED: Unknown error. See logs of the Bundle JavaScript build phase for more information.
```

Do not keep retrying the same EAS command until the Bundle JavaScript failure is diagnosed. To inspect the current build:

```bash
cd frontend/apps/mobile
/opt/homebrew/bin/npx --yes eas-cli@latest build:view a7143a93-4d2f-4de4-9dc4-671b24b2b669 --json
```

When retrying EAS after fixing the bundle failure, use:

```bash
cd frontend/apps/mobile
EAS_NO_VCS=1 \
EAS_SKIP_AUTO_FINGERPRINT=1 \
/opt/homebrew/bin/npx --yes eas-cli@latest build \
  --platform android \
  --profile preview \
  --non-interactive \
  --no-wait \
  --message "Android RC preview WebView shell"
```

Notes:

- `EAS_NO_VCS=1` is needed in this local environment because git status can hang.
- `EAS_SKIP_AUTO_FINGERPRINT=1` avoids the Expo fingerprint step hanging on this repo.
- The root `.easignore` keeps the archive focused on `frontend/apps/mobile` and `frontend/packages/shared`.
- EAS remote versioning owns Android `versionCode`; do not set `android.versionCode` in `app.config.ts`.

## Validation Coverage

Current validation docs remain in `frontend/docs`, but the mobile implementation target is now route fidelity rather than selective native extraction.

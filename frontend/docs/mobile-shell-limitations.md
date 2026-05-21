# Mobile Shell Limitations

This document records the current product limitations of the WebView-first mobile approach.

## Auth and Session

- Authentication state is still owned by the wrapped frontend.
- The shell does not yet implement a native session bridge.
- Password reset and recovery can already be opened through mobile deep links, but the authenticated session itself is still frontend-owned.
- Physical devices cannot use `localhost` for the frontend target; the shell URL must point to a reachable host on the same network or a deployed environment.

## Storage

- Local storage and cookies remain browser/WebView concerns, not native storage concerns.
- The shell does not yet synchronize auth state into `SecureStore` or another native container.
- Session debugging remains easier on Expo web than on a real device until a native auth bridge exists.

## File Upload

- File upload flows still depend on what the wrapped frontend can do inside the WebView.
- A native document-picker bridge now exists in `apps/mobile`, but the frontend still has to consume that contract explicitly.
- Camera and richer image capture flows are still not bridged.
- Teacher profile photo and any browser-dependent upload UX should still be treated as provisional until the frontend consumes the native upload event.

## CAPTCHA and Browser-Specific UX

- Any frontend flow that depends on browser-only CAPTCHA behavior remains constrained by the WebView.
- Browser APIs that assume a full desktop environment may behave differently or degrade on mobile devices.

## Navigation and Deep Links

- External links are opened outside the shell on native.
- Internal route ownership stays in the frontend.
- Native deep-link routing now exists for password reset and selected internal product destinations.

## Web Debugging

- On Expo web, the shell redirects directly to the frontend instead of rendering an iframe.
- This is intentional: it preserves the same browser session and storage behavior as the real frontend.

## Product Decision

These limitations are accepted intentionally in the WebView-first phase because the goal is to validate mobile product value while keeping `frontend` as the single source of truth.

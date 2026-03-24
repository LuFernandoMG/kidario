# Mobile Shell Limitations

This document records the current product limitations of the WebView-first mobile approach.

## Auth and Session

- Authentication state is still owned by the wrapped frontend.
- The shell does not yet implement a native session bridge.
- Password reset and recovery can be opened from the shell, but deep-link ownership is still a future bridge item.
- Physical devices cannot use `localhost` for the frontend target; the shell URL must point to a reachable host on the same network or a deployed environment.

## Storage

- Local storage and cookies remain browser/WebView concerns, not native storage concerns.
- The shell does not yet synchronize auth state into `SecureStore` or another native container.
- Session debugging remains easier on Expo web than on a real device until a native auth bridge exists.

## File Upload

- File upload flows still depend on what the wrapped frontend can do inside the WebView.
- Camera, image picker and native file-system integration are not bridged yet.
- Teacher profile photo and any browser-dependent upload UX should be treated as provisional inside the shell.

## CAPTCHA and Browser-Specific UX

- Any frontend flow that depends on browser-only CAPTCHA behavior remains constrained by the WebView.
- Browser APIs that assume a full desktop environment may behave differently or degrade on mobile devices.

## Navigation and Deep Links

- External links are opened outside the shell on native.
- Internal route ownership stays in the frontend.
- Native deep-link routing for password reset and internal product destinations is still scheduled for milestone 4.

## Product Decision

These limitations are accepted intentionally in the WebView-first phase because the goal is to validate mobile product value while keeping `frontend` as the single source of truth.

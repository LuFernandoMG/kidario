# Mobile Upload Bridge

The WebView-first mobile shell now exposes a minimal native upload bridge for flows that are weak inside plain WebView.

## Scope

Current implementation:

- native shell only
- document picker bridge triggered from the wrapped frontend
- upload result returned back into the WebView as a browser event

## Frontend Contract

Inside the wrapped frontend, call:

```js
window.KidarioMobileBridge?.pickDocument({
  requestId: "teacher-profile-photo",
  allowMultiple: false,
  accept: ["image/*"],
});
```

The mobile shell will dispatch:

```js
window.addEventListener("kidario-mobile-upload", (event) => {
  console.log(event.detail);
});
```

Result shape:

- `type`: `"pick-document-result"`
- `requestId`: forwarded request id
- `canceled`: whether the picker was canceled
- `files`: selected files with `name`, `uri`, `mimeType`, `size`
- `error`: optional native bridge error

## Current Limitation

The bridge exists in `/mobile`, but the web frontend does not consume it yet. This is intentional: the mobile shell can now support native selection when the frontend is ready to listen for the event.

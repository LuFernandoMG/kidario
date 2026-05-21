const BRIDGE_READY_EVENT = "kidario-mobile-bridge-ready";
const UPLOAD_RESULT_EVENT = "kidario-mobile-upload";

export interface PickDocumentBridgeMessage {
  type: "pick-document";
  requestId?: string;
  allowMultiple?: boolean;
  accept?: string[];
}

export interface UploadBridgeFile {
  name: string;
  uri: string;
  mimeType: string | null;
  size: number | null;
}

export interface UploadBridgeResult {
  type: "pick-document-result";
  requestId: string | null;
  canceled: boolean;
  files: UploadBridgeFile[];
  error?: string;
}

export const frontendBridgeBootstrapScript = `
  (function () {
    if (window.__kidarioMobileBridgeInstalled) {
      return;
    }

    window.__kidarioMobileBridgeInstalled = true;
    window.KidarioMobileBridge = window.KidarioMobileBridge || {};

    window.KidarioMobileBridge.pickDocument = function pickDocument(options) {
      var requestId = options && options.requestId ? options.requestId : "pick_" + Date.now();
      var payload = {
        type: "pick-document",
        requestId: requestId,
        allowMultiple: Boolean(options && options.allowMultiple),
        accept: Array.isArray(options && options.accept) ? options.accept : []
      };

      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      return requestId;
    };

    window.KidarioMobileBridge.receiveUploadResult = function receiveUploadResult(result) {
      window.dispatchEvent(new CustomEvent("${UPLOAD_RESULT_EVENT}", { detail: result }));
    };

    function installLayoutInset() {
      try {
        var doc = window.document;
        if (!doc || !doc.head) {
          return;
        }

        if (!doc.getElementById("kidario-mobile-layout-inset")) {
          var style = doc.createElement("style");
          style.id = "kidario-mobile-layout-inset";
          style.textContent = [
            ":root { --kidario-mobile-top-inset: calc(env(safe-area-inset-top, 0px) + 1.25em); }",
            "html, body, #root { min-height: 100%; }",
            "body { min-height: 100vh; }",
            "body > #root { min-height: inherit; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen { padding-top: 0 !important; box-sizing: border-box; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > header.sticky.top-0 { top: 0 !important; padding-top: var(--kidario-mobile-top-inset) !important; height: calc(3.5rem + var(--kidario-mobile-top-inset)) !important; box-sizing: border-box; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > header.sticky.top-0 + .relative.-mt-14 { margin-top: calc(-3.5rem - var(--kidario-mobile-top-inset)) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > header.sticky.top-0 + .relative.-mt-14 > .h-48.bg-gradient-to-b.from-kidario-mint-light.to-background { margin-top: calc(-1 * var(--kidario-mobile-top-inset)) !important; height: calc(12rem + var(--kidario-mobile-top-inset)) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > [class~='px-4'][class~='pt-4'] { padding-top: calc(var(--kidario-mobile-top-inset) + 1rem) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > [class~='px-4'][class~='pt-6'] { padding-top: calc(var(--kidario-mobile-top-inset) + 1.5rem) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > [class~='px-4'][class~='pt-8'] { padding-top: calc(var(--kidario-mobile-top-inset) + 2rem) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > [class~='px-4'][class~='pt-10'] { padding-top: calc(var(--kidario-mobile-top-inset) + 2.5rem) !important; }",
            "body.kidario-mobile-shell .min-h-screen.bg-background > main.min-h-screen > [class~='px-4'][class~='pt-20'] { padding-top: calc(var(--kidario-mobile-top-inset) + 5rem) !important; }",
            ".page-container { padding-top: calc(var(--kidario-mobile-top-inset) + 1rem) !important; }",
            ".min-h-screen.bg-background.px-6.py-8 { padding-top: calc(var(--kidario-mobile-top-inset) + 2rem) !important; }",
            ".relative.z-10.flex.min-h-screen.flex-col.justify-between > .flex-1.px-6.pt-14 { padding-top: calc(var(--kidario-mobile-top-inset) + 0.5rem) !important; }"
          ].join("");
          doc.head.appendChild(style);
        }

        if (doc.body) {
          doc.body.classList.add("kidario-mobile-shell");
        }
      } catch (error) {
        console.warn("Kidario mobile layout inset injection failed", error);
      }
    }

    installLayoutInset();
    document.addEventListener("DOMContentLoaded", installLayoutInset, { once: true });

    window.dispatchEvent(new CustomEvent("${BRIDGE_READY_EVENT}"));
  })();
  true;
`;

export function parseBridgeMessage(rawMessage: string): PickDocumentBridgeMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as PickDocumentBridgeMessage;
    return parsed?.type === "pick-document" ? parsed : null;
  } catch {
    return null;
  }
}

export function createUploadResultScript(result: UploadBridgeResult): string {
  const payload = JSON.stringify(result).replace(/</g, "\\u003c");
  return `
    (function () {
      if (window.KidarioMobileBridge && typeof window.KidarioMobileBridge.receiveUploadResult === "function") {
        window.KidarioMobileBridge.receiveUploadResult(${payload});
      }
    })();
    true;
  `;
}

export function createUploadSuccessResult(
  requestId: string | undefined,
  files: UploadBridgeFile[],
): UploadBridgeResult {
  return {
    type: "pick-document-result",
    requestId: requestId ?? null,
    canceled: false,
    files,
  };
}

export function createUploadCanceledResult(requestId: string | undefined): UploadBridgeResult {
  return {
    type: "pick-document-result",
    requestId: requestId ?? null,
    canceled: true,
    files: [],
  };
}

export function createUploadErrorResult(requestId: string | undefined, error: string): UploadBridgeResult {
  return {
    type: "pick-document-result",
    requestId: requestId ?? null,
    canceled: false,
    files: [],
    error,
  };
}

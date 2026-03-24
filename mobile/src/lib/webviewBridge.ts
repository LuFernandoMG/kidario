const BRIDGE_READY_EVENT = "kidario-mobile-bridge-ready";
const UPLOAD_RESULT_EVENT = "kidario-mobile-upload";

export interface PickDocumentBridgeMessage {
  type: "pick-document";
  requestId?: string;
  allowMultiple?: boolean;
  accept?: string[];
}

interface UploadBridgeFile {
  name: string;
  uri: string;
  mimeType: string | null;
  size: number | null;
}

interface UploadBridgeResult {
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

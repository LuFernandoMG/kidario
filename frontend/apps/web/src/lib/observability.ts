const REQUEST_ID_HEADER = "X-Request-ID";

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `kidario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildRequestIdHeader(): Record<string, string> {
  return {
    [REQUEST_ID_HEADER]: generateRequestId(),
  };
}

export function getRequestIdHeaderName(): string {
  return REQUEST_ID_HEADER;
}

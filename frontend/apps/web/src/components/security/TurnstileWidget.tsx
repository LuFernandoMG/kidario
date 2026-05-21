import { useCallback, useEffect, useRef, useState } from "react";

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenChange: (token: string) => void;
  onError?: (errorCode?: string) => void;
}

interface TurnstileInstance {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: (errorCode?: string) => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
    __kidarioTurnstileLoadPromise?: Promise<void>;
  }
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__kidarioTurnstileLoadPromise) return window.__kidarioTurnstileLoadPromise;

  window.__kidarioTurnstileLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Erro ao carregar Turnstile.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Erro ao carregar Turnstile."));
    document.head.appendChild(script);
  });

  return window.__kidarioTurnstileLoadPromise;
}

export function TurnstileWidget({ siteKey, onTokenChange, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
    onErrorRef.current = onError;
  }, [onTokenChange, onError]);

  const handleChallengeError = useCallback((errorCode?: string) => {
    const suffix = errorCode ? ` (${errorCode})` : "";
    console.warn(`[Turnstile] challenge error${suffix}`);
    onTokenChangeRef.current("");
    onErrorRef.current?.(errorCode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenChangeRef.current(token),
          "expired-callback": () => onTokenChangeRef.current(""),
          "error-callback": (errorCode) => handleChallengeError(errorCode),
          "timeout-callback": () => handleChallengeError("timeout-or-duplicate"),
          theme: "light",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar validação anti-spam.");
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, handleChallengeError]);

  if (loadError) {
    return <p className="text-xs text-destructive">{loadError}</p>;
  }

  return <div ref={containerRef} />;
}

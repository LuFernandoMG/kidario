const DEFAULT_BACKEND_API_URL = "http://localhost:8000/api/v1";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function requiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppEnv(): string {
  return readEnv("EXPO_PUBLIC_APP_ENV") || "development";
}

export function getBackendApiUrl(): string {
  return readEnv("EXPO_PUBLIC_BACKEND_API_URL") || DEFAULT_BACKEND_API_URL;
}

export function getSupabaseUrl(): string {
  return requiredEnv("EXPO_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

export function isSignupCaptchaEnabled(): boolean {
  return readEnv("EXPO_PUBLIC_SIGNUP_CAPTCHA_ENABLED") === "true";
}

export function isNativeEntryFlowEnabled(): boolean {
  return readEnv("EXPO_PUBLIC_NATIVE_ENTRY_FLOW_ENABLED") !== "false";
}

import type { ParentProfilePatchPayload, TeacherProfilePatchPayload } from "@/lib/backendProfiles";

export interface AuthSignupRequestPayload {
  email: string;
  password: string;
  full_name?: string;
  role: "parent" | "teacher";
  parent_profile?: ParentProfilePatchPayload;
  teacher_profile?: TeacherProfilePatchPayload;
  metadata?: Record<string, unknown>;
}

export interface AuthSignupResponse {
  status: "ok";
  profile_id: string;
  auth_user_id: string;
  role: "parent" | "teacher";
  email_confirmation_required: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
}

function getBackendApiBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_URL?.trim();
  const baseUrl = configured || "http://localhost:8000/api/v1";
  return baseUrl.replace(/\/+$/, "");
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const firstMessage = detail
      .map((item) => (item && typeof item === "object" ? (item as { msg?: unknown }).msg : null))
      .find((msg) => typeof msg === "string" && msg.trim());
    if (typeof firstMessage === "string") return firstMessage;
  }

  return fallback;
}

export async function signUpWithBackend(payload: AuthSignupRequestPayload): Promise<AuthSignupResponse> {
  const url = `${getBackendApiBaseUrl()}/auth/signup`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("No fue posible conectar con el backend de Kidario.");
  }

  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, "No fue posible crear la cuenta."));
  }

  return parsed as AuthSignupResponse;
}

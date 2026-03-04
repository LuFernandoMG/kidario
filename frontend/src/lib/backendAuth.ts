import type { TeacherProfilePatchPayload } from "@/domains/teacher/api/backendTeacherProfiles";
import type { ParentProfilePatchPayload } from "@/domains/parent/api/backendParentProfiles";
import { extractErrorMessage, getBackendApiBaseUrl } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface AuthSignupRequestPayload {
  email: string;
  password: string;
  full_name?: string;
  role: "parent" | "teacher";
  parent_profile?: ParentProfilePatchPayload;
  teacher_profile?: TeacherProfilePatchPayload;
  metadata?: Record<string, unknown>;
  captcha_token?: string;
  honeypot?: string;
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

export async function signUpWithBackend(payload: AuthSignupRequestPayload): Promise<AuthSignupResponse> {
  const url = `${getBackendApiBaseUrl()}/auth/signup`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildRequestIdHeader(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, "Não foi possível criar a conta."));
  }

  return parsed as AuthSignupResponse;
}

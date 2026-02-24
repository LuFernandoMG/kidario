import type { ParentProfilePatchPayload, TeacherProfilePatchPayload } from "@/lib/backendProfiles";
import { extractErrorMessage, getBackendApiBaseUrl } from "@/lib/backendApi";

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
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, "Não foi possível criar a conta."));
  }

  return parsed as AuthSignupResponse;
}

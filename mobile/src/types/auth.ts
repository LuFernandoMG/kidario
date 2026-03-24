import type { ParentProfilePatchPayload } from "@/types/profiles";
import type { TeacherProfilePatchPayload } from "@/types/teacher";
import type { BackendUserRole, UserRole } from "@/types/common";

export interface AuthSession {
  isAuthenticated: boolean;
  role: UserRole;
  email?: string;
  fullName?: string;
}

export interface SupabaseTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
}

export interface AuthSignupRequestPayload {
  email: string;
  password: string;
  full_name?: string;
  role: BackendUserRole;
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
  role: BackendUserRole;
  email_confirmation_required: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
}

export interface SignInParams {
  email: string;
  password: string;
  roleHint?: UserRole;
}

export interface RecoveryTokens {
  accessToken: string;
  refreshToken?: string;
  type?: string;
}

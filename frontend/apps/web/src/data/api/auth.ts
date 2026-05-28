import { extractErrorMessage, getBackendApiBaseUrl } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

interface AddressInputPayload {
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface ChildSignupPayload {
  name: string;
  gender?: "girl" | "boy" | "other" | "prefer not to disclose" | null;
  birth_month_year?: string | null;
  current_grade?: string | null;
  school?: string | null;
  focus_points?: string | null;
}

interface ParentSignupPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  bio?: string;
  address?: AddressInputPayload;
  children: ChildSignupPayload[];
}

interface TeacherSignupPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  cpf?: string;
  professional_number?: string;
  modality?: "online" | "presencial" | "ambos";
  biography?: string;
  hourly_rate_cents?: number;
  lesson_duration_minutes?: number;
  profile_photo_file_name?: string | null;
  hide_experience?: boolean;
  address?: AddressInputPayload;
  skills_ops?: {
    add: string[];
    remove: string[];
  };
  academic_records_ops?: {
    upsert: Array<{
      degree_type: string;
      course_name: string;
      institution: string;
      completion_year?: string | null;
    }>;
    delete_ids: string[];
  };
  experiences_ops?: {
    upsert: Array<{
      institution: string;
      role: string;
      description: string;
      period_from: string;
      period_to?: string | null;
      current_position: boolean;
    }>;
    delete_ids: string[];
  };
  availability_ops?: {
    upsert: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    delete_ids: string[];
  };
}

export interface AuthSignupRequestPayload {
  email: string;
  password: string;
  full_name?: string;
  role: "parent" | "teacher";
  parent?: ParentSignupPayload;
  teacher?: TeacherSignupPayload;
  metadata?: Record<string, unknown>;
  captcha_token?: string;
  honeypot?: string;
}

export interface AuthSignupResponse {
  status: "ok";
  user_id: string;
  parent_id?: string | null;
  teacher_id?: string | null;
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

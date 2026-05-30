import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface TeacherPayoutProfile {
  id: string;
  teacher_id: string;
  legal_name: string;
  document_type: "cpf" | "cnpj";
  document_number_masked: string;
  bank_code: string;
  branch_number: string;
  branch_check_digit?: string | null;
  account_number_masked: string;
  account_check_digit?: string | null;
  account_type: "checking" | "savings";
  birthdate?: string | null;
  monthly_income_cents?: number | null;
  professional_occupation?: string | null;
  status: "pending" | "active" | "rejected" | "disabled";
  provider?: string | null;
  provider_recipient_id?: string | null;
  recipient_status?: "pending" | "active" | "rejected" | "disabled" | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherPayoutProfilePayload {
  legal_name: string;
  document_type: "cpf" | "cnpj";
  document_number: string;
  bank_code: string;
  branch_number: string;
  branch_check_digit?: string;
  account_number: string;
  account_check_digit?: string;
  account_type: "checking" | "savings";
  birthdate?: string | null;
  monthly_income_cents?: number | null;
  professional_occupation?: string | null;
  current_password?: string;
}

class MissingTeacherPayoutProfileError extends Error {
  status = 404;

  constructor() {
    super("Teacher payout profile not found.");
  }
}

export function isMissingTeacherPayoutProfileError(error: unknown) {
  return error instanceof MissingTeacherPayoutProfileError
    || (error instanceof Error && error.message.toLowerCase().includes("teacher payout profile not found"));
}

async function paymentRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH" | "POST";
  body?: Record<string, unknown>;
}) {
  const { path, accessToken, method = "GET", body } = params;
  const bearerToken = await resolveProtectedAccessToken(accessToken);
  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
      ...buildRequestIdHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && path === "/teachers/me/payout-profile") {
      throw new MissingTeacherPayoutProfileError();
    }

    throwBackendError({
      status: response.status,
      payload,
      fallback: "Não foi possível processar os dados financeiros.",
      authProtected: true,
    });
  }
  return payload as TResponse;
}

export async function getTeacherPayoutProfile(accessToken: string) {
  return paymentRequest<TeacherPayoutProfile>({
    path: "/teachers/me/payout-profile",
    accessToken,
  });
}

export async function getTeacherPayoutProfileOrNull(accessToken: string) {
  try {
    return await getTeacherPayoutProfile(accessToken);
  } catch (error) {
    if (isMissingTeacherPayoutProfileError(error)) return null;
    throw error;
  }
}

export async function patchTeacherPayoutProfile(accessToken: string, payload: TeacherPayoutProfilePayload) {
  return paymentRequest<TeacherPayoutProfile>({
    path: "/teachers/me/payout-profile",
    accessToken,
    method: "PATCH",
    body: payload,
  });
}

export async function syncTeacherPaymentRecipient(accessToken: string) {
  return paymentRequest<{
    status: "ok";
    teacher_id: string;
    provider: string;
    provider_recipient_id: string;
    recipient_status: TeacherPayoutProfile["status"];
  }>({
    path: "/teachers/me/payment-recipient/sync",
    accessToken,
    method: "POST",
  });
}

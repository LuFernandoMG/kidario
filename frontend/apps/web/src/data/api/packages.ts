import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";
import type { PaymentOrder, PaymentMethod } from "@/data/api/bookings";

export interface BookingPackage {
  id: string;
  package_plan_id: string;
  teacher_id: string;
  parent_id: string;
  child_id: string;
  total_sessions: number;
  booked_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
  original_unit_amount_cents: number;
  original_amount_cents: number;
  discount_percent: number;
  discount_amount_cents: number;
  final_amount_cents: number;
  currency: string;
  status: "pending_payment" | "active" | "completed" | "canceled" | "expired";
  valid_from?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  payment_order?: PaymentOrder | null;
}

async function packageRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST";
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
    throwBackendError({
      status: response.status,
      payload,
      fallback: "Não foi possível processar o pacote.",
      authProtected: true,
    });
  }
  return payload as TResponse;
}

export async function createPackagePurchase(
  accessToken: string,
  payload: {
    package_plan_id: string;
    child_id: string;
    payment_method: PaymentMethod;
    card_token?: string;
    card_id?: string;
    installments?: number;
  },
) {
  return packageRequest<BookingPackage>({
    path: "/packages/purchases",
    accessToken,
    method: "POST",
    body: payload,
  });
}

export async function listParentPackages(accessToken: string) {
  return packageRequest<{ packages: BookingPackage[] }>({
    path: "/parents/me/packages",
    accessToken,
  });
}

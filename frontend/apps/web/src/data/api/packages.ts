import { backendJsonRequest } from "@/lib/backendApi";
import type { BookingModality, BookingResponse, PaymentOrder, PaymentMethod } from "@/data/api/bookings";

export interface PackagePlan {
  id: string;
  teacher_id: string;
  code: string;
  name: string;
  description?: string | null;
  sessions_count: number;
  discount_percent: number;
  is_active: boolean;
  estimated_original_amount_cents?: number | null;
  estimated_final_amount_cents?: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PackagePlanPayload {
  code: string;
  name: string;
  description?: string | null;
  sessions_count: number;
  discount_percent: number;
  is_active: boolean;
}

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
  requested_first_booking_starts_at?: string | null;
  requested_first_booking_duration_minutes?: number | null;
  requested_first_booking_modality?: BookingModality | null;
  first_booking_id?: string | null;
  first_booking?: BookingResponse | null;
  created_at: string;
  updated_at: string;
  payment_order?: PaymentOrder | null;
}

async function packageRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
}) {
  const { path, accessToken, method = "GET", body } = params;
  return backendJsonRequest<TResponse>({
    path,
    accessToken,
    method,
    body,
    fallback: "Não foi possível processar o pacote.",
    authProtected: true,
  });
}

export async function listMyPackagePlans(accessToken: string) {
  return packageRequest<{ package_plans: PackagePlan[] }>({
    path: "/teachers/me/package-plans",
    accessToken,
  });
}

export async function createMyPackagePlan(
  accessToken: string,
  payload: PackagePlanPayload,
) {
  return packageRequest<PackagePlan>({
    path: "/teachers/me/package-plans",
    accessToken,
    method: "POST",
    body: payload,
  });
}

export async function updateMyPackagePlan(
  accessToken: string,
  packagePlanId: string,
  payload: Partial<PackagePlanPayload>,
) {
  return packageRequest<PackagePlan>({
    path: `/teachers/me/package-plans/${packagePlanId}`,
    accessToken,
    method: "PATCH",
    body: payload,
  });
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
    first_booking?: {
      starts_at: string;
      duration_minutes?: number;
      modality: BookingModality;
    };
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

export async function listTeacherPackages(accessToken: string) {
  return packageRequest<{ packages: BookingPackage[] }>({
    path: "/teachers/me/packages",
    accessToken,
  });
}

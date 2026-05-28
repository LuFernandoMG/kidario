import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface Review {
  id: string;
  booking_id: string;
  parent_id: string;
  teacher_id: string;
  rating: number;
  comment?: string | null;
  feedback: Record<string, unknown>;
  is_public: boolean;
  status: "published" | "hidden" | "reported" | "removed";
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

async function reviewsRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
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
      fallback: "Não foi possível processar a avaliação.",
      authProtected: true,
    });
  }
  return payload as TResponse;
}

export async function createBookingReview(
  accessToken: string,
  bookingId: string,
  payload: { rating: number; comment?: string; is_public?: boolean; feedback?: Record<string, unknown> },
) {
  return reviewsRequest<Review>({
    path: `/bookings/${bookingId}/review`,
    accessToken,
    method: "POST",
    body: payload,
  });
}

export async function getBookingReview(accessToken: string, bookingId: string) {
  return reviewsRequest<Review>({
    path: `/bookings/${bookingId}/review`,
    accessToken,
  });
}

import { backendJsonRequest } from "@/lib/backendApi";

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
  return backendJsonRequest<TResponse>({
    path,
    accessToken,
    method,
    body,
    fallback: "Não foi possível processar a avaliação.",
    authProtected: true,
  });
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

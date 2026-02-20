import type { Teacher } from "@/components/marketplace/TeacherCard";
import type { DayAvailability } from "@/lib/bookingUtils";

export interface MarketplaceTeacherSummaryResponse {
  id: string;
  name: string;
  avatar_url?: string | null;
  rating: number;
  review_count: number;
  price_per_class: number;
  specialties: string[];
  is_verified: boolean;
  is_online: boolean;
  is_presential: boolean;
  next_availability?: string | null;
  experience_label: string;
  bio_snippet?: string | null;
}

export interface MarketplaceTeachersResponse {
  teachers: MarketplaceTeacherSummaryResponse[];
}

export interface MarketplaceTeacherSlotsDayResponse {
  date_iso: string;
  date_label: string;
  times: string[];
}

export interface MarketplaceTeacherDetailResponse {
  id: string;
  name: string;
  avatar_url?: string | null;
  rating: number;
  review_count: number;
  price_per_class: number;
  specialties: string[];
  is_verified: boolean;
  is_online: boolean;
  is_presential: boolean;
  experience_label: string;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  lesson_duration_minutes: number;
  next_slots: MarketplaceTeacherSlotsDayResponse[];
}

export interface MarketplaceTeacherDetailMapped {
  teacher: Teacher;
  nextSlots: DayAvailability[];
  lessonDurationMinutes: number;
  city?: string | null;
  state?: string | null;
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

async function marketplaceRequest<TResponse>(path: string): Promise<TResponse> {
  const url = `${getBackendApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error("No fue posible conectar con el backend de Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = "No fue posible cargar datos del marketplace.";
    throw new Error(extractErrorMessage(payload, fallback));
  }

  return payload as TResponse;
}

function fallbackAvatar() {
  return "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face";
}

function toTeacherModel(response: MarketplaceTeacherSummaryResponse): Teacher {
  return {
    id: response.id,
    name: response.name,
    avatar: response.avatar_url || fallbackAvatar(),
    rating: response.rating,
    reviewCount: response.review_count,
    pricePerClass: Math.round(response.price_per_class),
    specialties: response.specialties,
    isVerified: response.is_verified,
    isOnline: response.is_online,
    isPresential: response.is_presential,
    nextAvailability: response.next_availability || undefined,
    experience: response.experience_label,
    bio: response.bio_snippet || undefined,
  };
}

export function mapMarketplaceTeacherDetail(
  response: MarketplaceTeacherDetailResponse,
): MarketplaceTeacherDetailMapped {
  return {
    teacher: {
      id: response.id,
      name: response.name,
      avatar: response.avatar_url || fallbackAvatar(),
      rating: response.rating,
      reviewCount: response.review_count,
      pricePerClass: Math.round(response.price_per_class),
      specialties: response.specialties,
      isVerified: response.is_verified,
      isOnline: response.is_online,
      isPresential: response.is_presential,
      nextAvailability: undefined,
      experience: response.experience_label,
      bio: response.bio || undefined,
    },
    nextSlots: response.next_slots.map((slot) => ({
      dateIso: slot.date_iso,
      dateLabel: slot.date_label,
      slots: slot.times,
    })),
    lessonDurationMinutes: response.lesson_duration_minutes,
    city: response.city,
    state: response.state,
  };
}

export async function getMarketplaceTeachers(): Promise<Teacher[]> {
  const response = await marketplaceRequest<MarketplaceTeachersResponse>("/marketplace/teachers");
  return response.teachers.map((teacher) => toTeacherModel(teacher));
}

export async function getMarketplaceTeacherDetail(teacherId: string): Promise<MarketplaceTeacherDetailMapped> {
  const response = await marketplaceRequest<MarketplaceTeacherDetailResponse>(
    `/marketplace/teachers/${teacherId}`,
  );
  return mapMarketplaceTeacherDetail(response);
}

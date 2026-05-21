import type { Teacher } from "@/components/marketplace/TeacherCard";
import type { DayAvailability } from "@/lib/bookingUtils";
import { resolveTeacherAvatarUrl } from "@/lib/avatarUrl";
import { extractErrorMessage, getBackendApiBaseUrl } from "@/lib/backendApi";

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
  request_experience_anonymity: boolean;
  formations: {
    id: string;
    degree_type: string;
    course_name: string;
    institution: string;
    completion_year?: string | null;
  }[];
  experiences: {
    id: string;
    institution: string;
    role: string;
    responsibilities: string;
    period_from: string;
    period_to?: string | null;
    current_position: boolean;
  }[];
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
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = "Não foi possível carregar os dados do marketplace.";
    throw new Error(extractErrorMessage(payload, fallback));
  }

  return payload as TResponse;
}

function toTeacherModel(response: MarketplaceTeacherSummaryResponse): Teacher {
  return {
    id: response.id,
    name: response.name,
    avatar: resolveTeacherAvatarUrl(response.avatar_url),
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
      avatar: resolveTeacherAvatarUrl(response.avatar_url),
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
      requestExperienceAnonymity: response.request_experience_anonymity,
      formationEntries: (response.formations || []).map((formation) => ({
        id: formation.id,
        degreeType: formation.degree_type,
        courseName: formation.course_name,
        institution: formation.institution,
        completionYear: formation.completion_year || undefined,
      })),
      experienceEntries: (response.experiences || []).map((experience) => ({
        id: experience.id,
        institution: experience.institution,
        role: experience.role,
        responsibilities: experience.responsibilities,
        periodFrom: experience.period_from,
        periodTo: experience.period_to || undefined,
        currentPosition: experience.current_position,
      })),
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

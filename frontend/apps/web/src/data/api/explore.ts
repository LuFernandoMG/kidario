import type { Teacher } from "@/components/explore/TeacherCard";
import type { DayAvailability } from "@/lib/bookingUtils";
import { formatRelativeDateLabel, toDateIso } from "@/lib/bookingUtils";
import { resolveTeacherAvatarUrl } from "@/lib/avatarUrl";
import { extractErrorMessage, getBackendApiBaseUrl } from "@/lib/backendApi";

export interface ExploreTeacherSlotResponse {
  starts_at: string;
  duration_minutes: number;
  modality: "online" | "presencial";
}

export interface ExplorePublicReviewPreview {
  id: string;
  rating: number;
  comment?: string | null;
  submitted_at: string;
}

export interface ExplorePackagePlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sessions_count: number;
  discount_percent: number;
  estimated_original_amount_cents?: number | null;
  estimated_final_amount_cents?: number | null;
  currency: string;
  is_active: boolean;
}

export interface ExploreTeacherSummaryResponse {
  teacher_id: string;
  display_name: string;
  biography_preview?: string | null;
  profile_photo_url?: string | null;
  location: {
    city: string;
    state: string;
    country: string;
    distance_km?: number | null;
  };
  modality?: "online" | "presencial" | "ambos" | null;
  hourly_rate_cents?: number | null;
  lesson_duration_minutes?: number | null;
  skills: string[];
  rating_summary: {
    average?: number | null;
    count: number;
  };
  availability_summary: {
    next_available_at?: string | null;
    preview_slots: ExploreTeacherSlotResponse[];
    range_days?: number | null;
  };
  package_summary: {
    has_packages: boolean;
    starting_estimated_amount_cents?: number | null;
    max_discount_percent?: number | null;
  };
  latest_review?: ExplorePublicReviewPreview | null;
}

export interface ExploreTeachersResponse {
  teachers: ExploreTeacherSummaryResponse[];
}

export interface ExploreTeacherDetailResponse extends ExploreTeacherSummaryResponse {
  teacher_id: string;
  biography?: string | null;
  academic_records: {
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
    description: string;
    period_from: string;
    period_to?: string | null;
    current_position: boolean;
  }[];
  package_plans: ExplorePackagePlan[];
  latest_reviews: ExplorePublicReviewPreview[];
}

export interface ExploreTeacherDetailMapped {
  teacher: Teacher;
  nextSlots: DayAvailability[];
  lessonDurationMinutes: number;
  city?: string | null;
  state?: string | null;
  packagePlans: ExplorePackagePlan[];
  latestReviews: ExplorePublicReviewPreview[];
}

export interface ExploreTeacherFilters {
  query?: string;
  modality?: "online" | "presencial" | "all";
  availableFrom?: string;
  availableTo?: string;
  minRating?: number;
  hasReviews?: boolean;
}

async function exploreRequest<TResponse>(path: string): Promise<TResponse> {
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
    throw new Error(extractErrorMessage(payload, "Não foi possível carregar os dados de exploração."));
  }

  return payload as TResponse;
}

function pricePerLessonCents(response: ExploreTeacherSummaryResponse) {
  const hourlyRateCents = Number(response.hourly_rate_cents || 0);
  const durationMinutes = Number(response.lesson_duration_minutes || 60);
  return Math.round(hourlyRateCents * (durationMinutes / 60));
}

function formatNextAvailability(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modalityFlags(modality?: string | null) {
  return {
    isOnline: modality === "online" || modality === "ambos",
    isPresential: modality === "presencial" || modality === "ambos",
  };
}

function experienceLabel(response: ExploreTeacherSummaryResponse) {
  const cityState = [response.location?.city, response.location?.state].filter(Boolean).join(", ");
  const skills = response.skills.slice(0, 2).join(" · ");
  if (skills && cityState) return `${skills} · ${cityState}`;
  if (skills) return skills;
  if (cityState) return cityState;
  return "Experiência validada pela plataforma";
}

function groupAvailabilitySlots(slots: ExploreTeacherSlotResponse[]): DayAvailability[] {
  const grouped = new Map<string, { date: Date; times: string[] }>();
  for (const slot of slots) {
    const date = new Date(slot.starts_at);
    if (Number.isNaN(date.getTime())) continue;
    const dateIso = toDateIso(date);
    const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const current = grouped.get(dateIso) || { date, times: [] };
    if (!current.times.includes(time)) current.times.push(time);
    grouped.set(dateIso, current);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, item]) => {
      const dayStart = new Date(item.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((dayStart.getTime() - today.getTime()) / 86_400_000);
      return {
        dateIso,
        dateLabel: formatRelativeDateLabel(item.date, dayOffset),
        slots: item.times.sort(),
      };
    });
}

function toTeacherModel(response: ExploreTeacherSummaryResponse): Teacher {
  const flags = modalityFlags(response.modality);
  return {
    id: response.teacher_id,
    name: response.display_name || "Professora Kidario",
    avatar: resolveTeacherAvatarUrl(response.profile_photo_url),
    rating: Number(response.rating_summary?.average || 0),
    reviewCount: Number(response.rating_summary?.count || 0),
    pricePerClass: Math.round(pricePerLessonCents(response) / 100),
    specialties: Array.isArray(response.skills) ? response.skills : [],
    isVerified: true,
    isOnline: flags.isOnline,
    isPresential: flags.isPresential,
    nextAvailability: formatNextAvailability(response.availability_summary?.next_available_at),
    experience: experienceLabel(response),
    bio: response.biography_preview || undefined,
  };
}

export function mapExploreTeacherDetail(
  response: ExploreTeacherDetailResponse,
): ExploreTeacherDetailMapped {
  return {
    teacher: {
      ...toTeacherModel(response),
      bio: response.biography || response.biography_preview || undefined,
      requestExperienceAnonymity: false,
      formationEntries: (response.academic_records || []).map((formation) => ({
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
        responsibilities: experience.description,
        periodFrom: experience.period_from,
        periodTo: experience.period_to || undefined,
        currentPosition: experience.current_position,
      })),
    },
    nextSlots: groupAvailabilitySlots(response.availability_summary?.preview_slots || []),
    lessonDurationMinutes: Number(response.lesson_duration_minutes || 60),
    city: response.location?.city,
    state: response.location?.state,
    packagePlans: response.package_plans || [],
    latestReviews: response.latest_reviews || [],
  };
}

export async function getExploreTeachers(filters: ExploreTeacherFilters = {}): Promise<Teacher[]> {
  const query = new URLSearchParams();
  if (filters.query) query.set("query", filters.query);
  if (filters.modality && filters.modality !== "all") query.set("modality", filters.modality);
  if (filters.availableFrom) query.set("available_from", filters.availableFrom);
  if (filters.availableTo) query.set("available_to", filters.availableTo);
  if (filters.minRating) query.set("min_rating", String(filters.minRating));
  if (filters.hasReviews !== undefined) query.set("has_reviews", String(filters.hasReviews));

  const response = await exploreRequest<ExploreTeachersResponse>(
    `/explore/teachers${query.toString() ? `?${query.toString()}` : ""}`,
  );
  return response.teachers.map((teacher) => toTeacherModel(teacher));
}

export async function getExploreTeacherDetail(teacherId: string): Promise<ExploreTeacherDetailMapped> {
  const response = await exploreRequest<ExploreTeacherDetailResponse>(
    `/explore/teachers/${teacherId}`,
  );
  return mapExploreTeacherDetail(response);
}

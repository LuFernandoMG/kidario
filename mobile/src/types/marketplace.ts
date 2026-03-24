import type { DayAvailability } from "@/types/common";

export interface MarketplaceTeacherCard {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  pricePerClass: number;
  specialties: string[];
  isVerified: boolean;
  isOnline: boolean;
  isPresential: boolean;
  nextAvailability?: string;
  experience: string;
  bio?: string;
}

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
  teacher: MarketplaceTeacherCard;
  nextSlots: DayAvailability[];
  lessonDurationMinutes: number;
  city?: string | null;
  state?: string | null;
}

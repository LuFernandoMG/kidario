export type BookingModality = "online" | "presencial";

export interface DayAvailability {
  dateIso: string;
  dateLabel: string;
  slots: string[];
}

interface BuildAvailabilityOptions {
  days?: number;
  baseSlots?: string[];
  maxSlotsPerDay?: number;
}

const defaultBaseSlots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "18:00"];

export function buildTeacherAvailability(
  teacherId: string,
  options: BuildAvailabilityOptions = {},
): DayAvailability[] {
  const teacherSeed = Number(teacherId) || 1;
  const days = options.days ?? 7;
  const baseSlots = options.baseSlots ?? defaultBaseSlots;
  const maxSlotsPerDay = options.maxSlotsPerDay ?? 4;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const slots = baseSlots
      .filter((_, slotIndex) => (slotIndex + teacherSeed + index) % 2 === 0)
      .slice(0, maxSlotsPerDay);

    return {
      dateIso: toDateIso(date),
      dateLabel: formatRelativeDateLabel(date, index),
      slots,
    };
  });
}

export function toDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRelativeDateLabel(date: Date, dayOffset: number) {
  if (dayOffset === 0) return "Hoje";
  if (dayOffset === 1) return "Amanha";

  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatDateLong(dateIso: string) {
  if (!dateIso) return "-";

  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);

  if (Number.isNaN(date.getTime())) return dateIso;

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

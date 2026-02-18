export type BookingStatus = "confirmada" | "pendente" | "cancelada" | "concluida";

export interface StoredBooking {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar: string;
  specialty: string;
  dateLabel: string;
  dateIso: string;
  time: string;
  modality: "online" | "presencial";
  status: BookingStatus;
  createdAtIso: string;
}

const BOOKINGS_STORAGE_KEY = "kidario_parent_bookings_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredBookings(): StoredBooking[] {
  if (!canUseStorage()) return [];

  const rawValue = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as StoredBooking[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveStoredBookings(bookings: StoredBooking[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
}

export function appendStoredBooking(booking: StoredBooking) {
  const previousBookings = getStoredBookings();
  saveStoredBookings([booking, ...previousBookings]);
}

export function getStoredBookingById(bookingId: string) {
  return getStoredBookings().find((booking) => booking.id === bookingId);
}

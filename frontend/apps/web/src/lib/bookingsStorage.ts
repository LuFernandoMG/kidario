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
  updatedAtIso?: string;
  cancellationReason?: string;
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

export function updateStoredBooking(bookingId: string, updates: Partial<StoredBooking>) {
  const previousBookings = getStoredBookings();
  const targetIndex = previousBookings.findIndex((booking) => booking.id === bookingId);

  if (targetIndex === -1) return null;

  const updatedBooking: StoredBooking = {
    ...previousBookings[targetIndex],
    ...updates,
    id: previousBookings[targetIndex].id,
  };

  const nextBookings = [...previousBookings];
  nextBookings[targetIndex] = updatedBooking;
  saveStoredBookings(nextBookings);

  return updatedBooking;
}

export type ApiStatus = "ok";

export type UserRole = "parent" | "teacher" | "admin" | null;
export type BackendUserRole = "parent" | "teacher";

export type BookingStatus = "pendente" | "confirmada" | "cancelada" | "concluida";
export type BookingModality = "online" | "presencial";
export type PaymentMethod = "cartao" | "pix";
export type PaymentStatus = "pendente" | "pago" | "falhou";
export type ObjectiveFulfilmentLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type ChildGender = "girl" | "boy" | "other" | "prefer not to disclose";

export interface DayAvailability {
  dateIso: string;
  dateLabel: string;
  slots: string[];
}

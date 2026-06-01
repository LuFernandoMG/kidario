export type CardBrand = {
  key: "amex" | "diners" | "discover" | "elo" | "hipercard" | "mastercard" | "visa";
  label: string;
};

const CARD_BRANDS: CardBrand[] = [
  { key: "elo", label: "Elo" },
  { key: "hipercard", label: "Hipercard" },
  { key: "amex", label: "Amex" },
  { key: "diners", label: "Diners" },
  { key: "discover", label: "Discover" },
  { key: "mastercard", label: "Mastercard" },
  { key: "visa", label: "Visa" },
];

export const CARD_EXPIRATION_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => (
  String(index + 1).padStart(2, "0")
));

export const MAX_CARD_EXPIRATION_YEAR = 2050;

export function buildCardExpirationYearOptions(currentYear = new Date().getFullYear()) {
  const optionCount = Math.max(MAX_CARD_EXPIRATION_YEAR - currentYear, 0);
  return Array.from({ length: optionCount }, (_, index) => String(currentYear + index + 1));
}

export function cardDigitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCardNumber(value: string) {
  return cardDigitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function formatCardExpirationMonth(value: string) {
  const digits = cardDigitsOnly(value).slice(0, 2);
  if (!digits) return "";
  if (digits.length === 1) return digits;

  const month = Number(digits);
  if (month >= 1 && month <= 12) return digits;
  if (digits.startsWith("0")) return "";
  return digits.slice(0, 1);
}

export function normalizeCardExpirationMonth(value: string) {
  const month = formatCardExpirationMonth(value);
  if (!month) return "";
  return month.padStart(2, "0");
}

export function isValidCardExpirationMonth(value: string) {
  const digits = cardDigitsOnly(value);
  const month = Number(digits);
  return digits.length === 2 && month >= 1 && month <= 12;
}

export function formatCardExpirationYear(value: string, currentValue = "", currentYear = new Date().getFullYear()) {
  const digits = cardDigitsOnly(value).slice(0, 4);
  if (digits.length < 4) return digits;
  return Number(digits) > currentYear ? digits : currentValue;
}

export function isFutureCardExpirationYear(
  value: string,
  currentYear = new Date().getFullYear(),
  maxYear = MAX_CARD_EXPIRATION_YEAR,
) {
  const digits = cardDigitsOnly(value);
  const year = Number(digits);
  return digits.length === 4 && year > currentYear && year <= maxYear;
}

export function formatCardCvv(value: string) {
  return cardDigitsOnly(value).slice(0, 4);
}

export function detectCardBrand(value: string): CardBrand | null {
  const digits = cardDigitsOnly(value);
  if (!digits) return null;

  if (/^(4011(78|79)|431274|438935|451416|457393|457631|457632|504175|5067|506699|506770|509|627780|636297|636368|650|6516|6550)/.test(digits)) {
    return CARD_BRANDS[0];
  }
  if (/^(606282|3841)/.test(digits)) return CARD_BRANDS[1];
  if (/^3[47]/.test(digits)) return CARD_BRANDS[2];
  if (/^3(0[0-5]|[68])/.test(digits)) return CARD_BRANDS[3];
  if (/^6(011|5)/.test(digits)) return CARD_BRANDS[4];
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return CARD_BRANDS[5];
  if (/^4/.test(digits)) return CARD_BRANDS[6];

  return null;
}

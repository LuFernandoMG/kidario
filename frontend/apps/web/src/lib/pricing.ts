export const PARENT_SERVICE_FEE_RATE = 0.08;

export function calculateParentServiceFeeCents(amountCents: number) {
  return Math.round(Math.max(amountCents, 0) * PARENT_SERVICE_FEE_RATE);
}

export function calculateParentCheckoutTotalCents(amountCents: number) {
  const normalizedAmountCents = Math.max(amountCents, 0);
  return normalizedAmountCents + calculateParentServiceFeeCents(normalizedAmountCents);
}

export function formatCurrencyCents(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Math.max(amountCents, 0) / 100);
}

export type PagarmeCardTokenizeInput = {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
};

type PagarmeTokenResponse = {
  id?: string;
  token?: {
    id?: string;
  };
};

const PAGARME_V5_BASE_URL = "https://api.pagar.me/core/v5";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function getPagarmeTokenizationBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_PAGARME_BASE_URL?.trim() || PAGARME_V5_BASE_URL).replace(
    /\/+$/,
    "",
  );
  return configuredBaseUrl === "https://sdx-api.pagar.me/core/v5" ? PAGARME_V5_BASE_URL : configuredBaseUrl;
}

export async function tokenizePagarmeCard(input: PagarmeCardTokenizeInput): Promise<string> {
  const appId = import.meta.env.VITE_PAGARME_PUBLIC_KEY?.trim();
  if (!appId) {
    throw new Error("Configure VITE_PAGARME_PUBLIC_KEY para tokenizar cartões no checkout.");
  }
  const pagarmeBaseUrl = getPagarmeTokenizationBaseUrl();

  const number = digitsOnly(input.number);
  const cvv = digitsOnly(input.cvv);
  const expMonth = Number(digitsOnly(input.expMonth));
  const expYearRaw = digitsOnly(input.expYear);
  const expYear = Number(expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw);

  if (!number || !cvv || !expMonth || !expYear || !input.holderName.trim()) {
    throw new Error("Preencha os dados do cartão para gerar o token.");
  }

  const response = await fetch(`${pagarmeBaseUrl}/tokens?appId=${encodeURIComponent(appId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "card",
      card: {
        number,
        holder_name: input.holderName.trim(),
        exp_month: expMonth,
        exp_year: expYear,
        cvv,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as PagarmeTokenResponse & { message?: string; errors?: unknown };
  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível tokenizar o cartão na Pagar.me.");
  }

  const tokenId = payload.id || payload.token?.id;
  if (!tokenId) {
    throw new Error("A resposta da Pagar.me não retornou um token de cartão.");
  }
  return tokenId;
}

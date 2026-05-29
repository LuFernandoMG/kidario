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

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export async function tokenizePagarmeCard(input: PagarmeCardTokenizeInput): Promise<string> {
  const appId = import.meta.env.VITE_PAGARME_PUBLIC_KEY?.trim();
  if (!appId) {
    throw new Error("Configure VITE_PAGARME_PUBLIC_KEY para tokenizar cartões no checkout.");
  }

  const number = digitsOnly(input.number);
  const cvv = digitsOnly(input.cvv);
  const expMonth = Number(digitsOnly(input.expMonth));
  const expYearRaw = digitsOnly(input.expYear);
  const expYear = Number(expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw);

  if (!number || !cvv || !expMonth || !expYear || !input.holderName.trim()) {
    throw new Error("Preencha os dados do cartão para gerar o token.");
  }

  const response = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(appId)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
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

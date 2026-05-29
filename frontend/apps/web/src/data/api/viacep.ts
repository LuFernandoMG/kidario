export interface ViaCepAddress {
  postalCode: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

function extractCepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function cleanText(value?: string) {
  return value?.trim() || "";
}

export async function lookupAddressByCep(
  cep: string,
  options: { signal?: AbortSignal } = {},
): Promise<ViaCepAddress | null> {
  const digits = extractCepDigits(cep);
  if (digits.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP.");
  }

  const payload = (await response.json().catch(() => null)) as ViaCepResponse | null;
  if (!payload || payload.erro) return null;

  return {
    postalCode: extractCepDigits(payload.cep || digits),
    street: cleanText(payload.logradouro),
    district: cleanText(payload.bairro),
    city: cleanText(payload.localidade),
    state: cleanText(payload.uf).toUpperCase(),
  };
}

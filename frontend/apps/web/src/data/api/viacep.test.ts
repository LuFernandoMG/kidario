import { beforeEach, describe, expect, it, vi } from "vitest";

import { lookupAddressByCep } from "@/data/api/viacep";

describe("ViaCEP API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps a found CEP response to signup address fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: "01001-000",
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupAddressByCep("01001-000")).resolves.toEqual({
      postalCode: "01001000",
      street: "Praça da Sé",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/01001000/json/",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns null when ViaCEP marks the CEP as missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erro: true }),
      }),
    );

    await expect(lookupAddressByCep("99999999")).resolves.toBeNull();
  });
});

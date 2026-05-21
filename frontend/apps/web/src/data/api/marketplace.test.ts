import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backendApi", () => ({
  extractErrorMessage: (payload: unknown, fallback: string) => {
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
    return fallback;
  },
  getBackendApiBaseUrl: () => "https://backend.test/api/v1",
}));

import { getMarketplaceTeachers } from "@/data/api/marketplace";

describe("marketplace api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps wrapped marketplace teachers response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          teachers: [
            {
              id: "teacher-1",
              name: "Ana Carolina",
              avatar_url: "https://example.com/avatar.jpg",
              rating: 4.8,
              review_count: 21,
              price_per_class: 120,
              specialties: ["Alfabetizacao"],
              is_verified: true,
              is_online: true,
              is_presential: false,
              next_availability: "Hoje, 14h",
              experience_label: "Experiência validada",
              bio_snippet: "Pedagoga.",
            },
          ],
        }),
      }),
    );

    await expect(getMarketplaceTeachers()).resolves.toEqual([
      expect.objectContaining({
        id: "teacher-1",
        name: "Ana Carolina",
        rating: 4.8,
        reviewCount: 21,
        pricePerClass: 120,
        specialties: ["Alfabetizacao"],
        isVerified: true,
        isOnline: true,
        isPresential: false,
        nextAvailability: "Hoje, 14h",
        experience: "Experiência validada",
        bio: "Pedagoga.",
      }),
    ]);
  });

  it("rejects invalid marketplace teachers response instead of throwing in page code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      }),
    );

    await expect(getMarketplaceTeachers()).rejects.toThrow("Resposta inválida");
  });
});

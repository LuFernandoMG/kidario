import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backendApi", () => ({
  extractErrorMessage: (payload: unknown, fallback: string) => {
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
    return fallback;
  },
  getBackendApiBaseUrl: () => "https://backend.test/api/v2",
}));

import { getExploreTeachers } from "@/data/api/explore";

describe("explore api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps v2 explore teachers response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          teachers: [
            {
              teacher_id: "teacher-1",
              display_name: "Ana Carolina",
              profile_photo_url: "https://example.com/avatar.jpg",
              biography_preview: "Pedagoga.",
              location: { city: "São Paulo", state: "SP", country: "BR" },
              modality: "online",
              hourly_rate_cents: 12000,
              lesson_duration_minutes: 60,
              skills: ["Alfabetizacao"],
              rating_summary: { average: 4.8, count: 21 },
              availability_summary: {
                next_available_at: "2026-02-20T17:00:00Z",
                preview_slots: [],
              },
              package_summary: { has_packages: false },
            },
          ],
        }),
      }),
    );

    await expect(getExploreTeachers()).resolves.toEqual([
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
        experience: "Alfabetizacao · São Paulo, SP",
        bio: "Pedagoga.",
      }),
    ]);
  });
});

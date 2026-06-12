import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_BACKEND_API_URL", "https://backend.test/api/v2");

vi.mock("@/lib/authSession", () => ({
  getValidSupabaseAccessToken: async () => "resolved-token",
  handleExpiredSessionRedirect: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  buildRequestIdHeader: () => ({ "X-Request-ID": "test-request" }),
}));

import {
  createMyPackagePlan,
  listMyPackagePlans,
  updateMyPackagePlan,
} from "@/data/api/packages";

describe("packages api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls teacher package plan endpoints with protected auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "plan-1",
        teacher_id: "teacher-1",
        code: "PACK4",
        name: "Pacote 4 aulas",
        sessions_count: 4,
        discount_percent: 10,
        is_active: true,
        currency: "BRL",
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createMyPackagePlan("token", {
      code: "PACK4",
      name: "Pacote 4 aulas",
      description: null,
      sessions_count: 4,
      discount_percent: 10,
      is_active: true,
    });
    await updateMyPackagePlan("token", "plan-1", { is_active: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://backend.test/api/v2/teachers/me/package-plans",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer resolved-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://backend.test/api/v2/teachers/me/package-plans/plan-1",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("lists current teacher package plans", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          package_plans: [
            {
              id: "plan-1",
              teacher_id: "teacher-1",
              code: "PACK4",
              name: "Pacote 4 aulas",
              sessions_count: 4,
              discount_percent: 10,
              is_active: true,
              currency: "BRL",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
            },
          ],
        }),
      }),
    );

    await expect(listMyPackagePlans("token")).resolves.toEqual({
      package_plans: [
        expect.objectContaining({
          code: "PACK4",
          sessions_count: 4,
        }),
      ],
    });
  });
});

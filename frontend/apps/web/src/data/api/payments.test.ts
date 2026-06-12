import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_BACKEND_API_URL", "https://backend.test/api/v2");

vi.mock("@/lib/authSession", () => ({
  getValidSupabaseAccessToken: async () => "token",
  handleExpiredSessionRedirect: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  buildRequestIdHeader: () => ({}),
}));

import { getTeacherPayoutProfileOrNull } from "@/data/api/payments";

describe("payments api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes payout profile 404 responses to null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => {
          throw new Error("plain text response");
        },
      }),
    );

    await expect(getTeacherPayoutProfileOrNull("token")).resolves.toBeNull();
  });
});

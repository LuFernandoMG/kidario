import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backendApi", () => ({
  getBackendApiBaseUrl: () => "https://backend.test/api/v2",
  resolveProtectedAccessToken: vi.fn(async (token: string) => token),
  throwBackendError: ({ fallback }: { fallback: string }) => {
    throw new Error(fallback);
  },
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

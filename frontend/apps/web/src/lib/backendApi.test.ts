import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHandleExpiredSessionRedirect = vi.fn();
const mockGetValidSupabaseAccessToken = vi.fn();

vi.mock("@/lib/authSession", () => ({
  handleExpiredSessionRedirect: () => mockHandleExpiredSessionRedirect(),
  getValidSupabaseAccessToken: () => mockGetValidSupabaseAccessToken(),
}));

import { throwBackendError } from "@/lib/backendApi";

describe("backendApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetValidSupabaseAccessToken.mockResolvedValue(null);
  });

  it("invalidates session on unauthorized protected requests", () => {
    expect(() =>
      throwBackendError({
        status: 401,
        payload: { detail: "JWT expired" },
        fallback: "fallback",
        authProtected: true,
      }),
    ).toThrow("Sua sessão expirou");
    expect(mockHandleExpiredSessionRedirect).toHaveBeenCalledTimes(1);
  });
});

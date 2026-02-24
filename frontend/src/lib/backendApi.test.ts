import { describe, expect, it, vi } from "vitest";

const mockHandleExpiredSessionRedirect = vi.fn();

vi.mock("@/lib/authSession", () => ({
  handleExpiredSessionRedirect: () => mockHandleExpiredSessionRedirect(),
}));

import { throwBackendError } from "@/lib/backendApi";

describe("backendApi", () => {
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

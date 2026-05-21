import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearClientCache, getValidSupabaseAccessToken } from "@/lib/authSession";

describe("authSession refresh manager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearClientCache();
  });

  it("returns current token when it is still valid", async () => {
    const now = Math.floor(Date.now() / 1000);
    window.localStorage.setItem(
      "kidario_supabase_tokens_v1",
      JSON.stringify({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: now + 3600,
      }),
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const token = await getValidSupabaseAccessToken();

    expect(token).toBe("valid-token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes expiring token and persists new values", async () => {
    const now = Math.floor(Date.now() / 1000);
    window.localStorage.setItem(
      "kidario_supabase_tokens_v1",
      JSON.stringify({
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now + 5,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "new-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const token = await getValidSupabaseAccessToken();
    expect(token).toBe("new-token");

    const storedRaw = window.localStorage.getItem("kidario_supabase_tokens_v1");
    const stored = storedRaw ? (JSON.parse(storedRaw) as { accessToken: string; refreshToken: string }) : null;
    expect(stored?.accessToken).toBe("new-token");
    expect(stored?.refreshToken).toBe("new-refresh-token");
  });

  it("coalesces parallel refresh requests into one network call", async () => {
    const now = Math.floor(Date.now() / 1000);
    window.localStorage.setItem(
      "kidario_supabase_tokens_v1",
      JSON.stringify({
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now + 5,
      }),
    );

    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = getValidSupabaseAccessToken();
    const second = getValidSupabaseAccessToken();

    resolveFetch?.(
      new Response(
        JSON.stringify({
          access_token: "new-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const [firstToken, secondToken] = await Promise.all([first, second]);
    expect(firstToken).toBe("new-token");
    expect(secondToken).toBe("new-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

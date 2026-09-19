/**
 * Unit tests for `createSupabaseServerClient`'s own env-var validation and
 * cookie-wiring logic. `next/headers`'s `cookies()` and `@supabase/ssr`'s
 * `createServerClient` are both mocked — `cookies()` has no meaningful
 * behavior outside a real Next.js request context, and mocking it is the
 * standard way to unit-test server-side Next.js code in isolation. No
 * real network Auth call anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

const fakeCookieStore = {
  getAll: vi.fn(() => [{ name: "sb-access-token", value: "token-value" }]),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => fakeCookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((url: string, key: string, options: unknown) => ({
    mocked: "server-client",
    url,
    key,
    options,
  })),
}));

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../server-client";

interface CookiesToSet {
  name: string;
  value: string;
  options: Record<string, unknown>;
}
interface ServerClientOptions {
  cookies: {
    getAll: () => unknown;
    setAll: (cookiesToSet: CookiesToSet[], headers: Record<string, string>) => void;
  };
}

function lastCallOptions(): ServerClientOptions {
  const mocked = vi.mocked(createServerClient);
  const call = mocked.mock.calls.at(-1);
  if (!call) throw new Error("createServerClient was never called");
  return call[2] as unknown as ServerClientOptions;
}

describe("createSupabaseServerClient", () => {
  it("throws a clear error when required env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined as unknown as string);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    await expect(createSupabaseServerClient()).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );

    vi.unstubAllEnvs();
  });

  it("reads cookies once per call via next/headers and passes url/key/cookies to createServerClient", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    await createSupabaseServerClient();

    expect(cookies).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );

    vi.unstubAllEnvs();
  });

  it("getAll delegates directly to the request cookie store", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    await createSupabaseServerClient();
    const result = lastCallOptions().cookies.getAll();

    expect(fakeCookieStore.getAll).toHaveBeenCalled();
    expect(result).toEqual([{ name: "sb-access-token", value: "token-value" }]);

    vi.unstubAllEnvs();
  });

  it("setAll writes each cookie via the store when mutation is allowed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    fakeCookieStore.set.mockClear();

    await createSupabaseServerClient();
    lastCallOptions().cookies.setAll(
      [{ name: "sb-access-token", value: "new-value", options: {} }],
      {},
    );

    expect(fakeCookieStore.set).toHaveBeenCalledWith("sb-access-token", "new-value", {});

    vi.unstubAllEnvs();
  });

  it("setAll silently no-ops (does not throw) when the store rejects mutation — the Server Component read-only case", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const throwingStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error("Cookies can only be modified in a Server Action or Route Handler");
      }),
    };
    vi.mocked(cookies).mockResolvedValueOnce(throwingStore as never);

    await createSupabaseServerClient();

    expect(() =>
      lastCallOptions().cookies.setAll([{ name: "a", value: "b", options: {} }], {}),
    ).not.toThrow();
    expect(throwingStore.set).toHaveBeenCalledTimes(1);

    vi.unstubAllEnvs();
  });
});

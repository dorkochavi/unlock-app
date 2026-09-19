/**
 * Unit tests for `createSupabaseBrowserClient`'s own env-var validation
 * logic. `@supabase/ssr`'s `createBrowserClient` is mocked — this file
 * tests OUR factory's behavior, not `@supabase/ssr`'s internals, and
 * makes no real network Auth call.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ mocked: "browser-client" })),
}));

import { createBrowserClient } from "@supabase/ssr";
import { createSupabaseBrowserClient } from "../browser-client";

describe("createSupabaseBrowserClient", () => {
  it("throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined as unknown as string);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(() => createSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    vi.unstubAllEnvs();
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined as unknown as string);

    expect(() => createSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);

    vi.unstubAllEnvs();
  });

  it("constructs a client via createBrowserClient once both env vars are present", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const client = createSupabaseBrowserClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
    );
    expect(client).toEqual({ mocked: "browser-client" });

    vi.unstubAllEnvs();
  });
});

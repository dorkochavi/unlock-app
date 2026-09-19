/**
 * Unit tests for `requireAuthenticatedUser` against a fake/mock Supabase
 * auth client shape — no real network Auth call anywhere in this file.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { requireAuthenticatedUser } from "../require-authenticated-user";

function makeFakeSupabaseClient(overrides: {
  getUser?: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  getSession?: () => Promise<unknown>;
}): SupabaseClient {
  return {
    auth: {
      getUser:
        overrides.getUser ??
        vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession:
        overrides.getSession ??
        vi.fn(async () => {
          throw new Error("getSession must never be called by requireAuthenticatedUser");
        }),
    },
  } as unknown as SupabaseClient;
}

describe("requireAuthenticatedUser", () => {
  it("A. authenticated: calls getUser and returns AUTHENTICATED with the Supabase user.id", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: "supabase-user-1" } },
      error: null,
    }));
    const supabase = makeFakeSupabaseClient({ getUser });

    const result = await requireAuthenticatedUser(supabase);

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ outcome: "AUTHENTICATED", userId: "supabase-user-1" });
  });

  it("B. unauthenticated: getUser resolves with a null user and returns UNAUTHENTICATED", async () => {
    const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));
    const supabase = makeFakeSupabaseClient({ getUser });

    const result = await requireAuthenticatedUser(supabase);

    expect(result).toEqual({ outcome: "UNAUTHENTICATED" });
  });

  it("C. getUser returns an error (e.g. expired/invalid token): returns UNAUTHENTICATED, not a thrown exception", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: null },
      error: { message: "invalid or expired token" },
    }));
    const supabase = makeFakeSupabaseClient({ getUser });

    const result = await requireAuthenticatedUser(supabase);

    expect(result).toEqual({ outcome: "UNAUTHENTICATED" });
  });

  it("D. getSession is never called — proven, not just unasserted", async () => {
    const getSession = vi.fn(async () => ({ data: { session: null }, error: null }));
    const getUser = vi.fn(async () => ({
      data: { user: { id: "supabase-user-1" } },
      error: null,
    }));
    const supabase = makeFakeSupabaseClient({ getUser, getSession });

    await requireAuthenticatedUser(supabase);

    expect(getSession).not.toHaveBeenCalled();
  });

  it("an unexpected thrown error from getUser (not a returned `error` field) propagates rather than being swallowed", async () => {
    const getUser = vi.fn(async () => {
      throw new Error("unexpected SDK/network failure");
    });
    const supabase = makeFakeSupabaseClient({ getUser });

    await expect(requireAuthenticatedUser(supabase)).rejects.toThrow(
      "unexpected SDK/network failure",
    );
  });
});

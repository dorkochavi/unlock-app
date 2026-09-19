/**
 * Unit tests for `handleSetUserTimezone` — the testable core of
 * `POST /api/user/timezone`. Every dependency is faked; no real
 * Supabase/network/Postgres connection anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

import type { SetUserTimezoneResult } from "../../../../../application/user/set-user-timezone";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";
import { handleSetUserTimezone } from "../handle-set-user-timezone";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

describe("handleSetUserTimezone", () => {
  it("A. unauthenticated: returns 401 and never calls persistTimezone", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const persistTimezone = vi.fn();

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(persistTimezone).not.toHaveBeenCalled();
  });

  it("B. non-string timezone body: 400 INVALID_TIMEZONE, never calls persistTimezone (validation before persistence)", async () => {
    const authenticate = authenticated();
    const persistTimezone = vi.fn();

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: undefined,
      persistTimezone,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_TIMEZONE" } });
    expect(persistTimezone).not.toHaveBeenCalled();
  });

  it("C. UPDATED: uses the authenticated userId, returns 200 with the canonical timezone", async () => {
    const authenticate = authenticated("supabase-user-1");
    const persistTimezone = vi.fn(
      async (): Promise<SetUserTimezoneResult> => ({
        outcome: "UPDATED",
        timezone: "Asia/Jerusalem",
      }),
    );

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(persistTimezone).toHaveBeenCalledWith({
      actorUserId: "supabase-user-1",
      timezone: "Asia/Jerusalem",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ timezone: "Asia/Jerusalem" });
  });

  it("D. INVALID_TIMEZONE from the application layer: 400, same stable code", async () => {
    const authenticate = authenticated();
    const persistTimezone = vi.fn(
      async (): Promise<SetUserTimezoneResult> => ({ outcome: "INVALID_TIMEZONE" }),
    );

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Not/A_Real_Zone",
      persistTimezone,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_TIMEZONE" } });
  });

  it("E. USER_NOT_FOUND: mapped to a server-side provisioning-inconsistency 500, never an ordinary 404", async () => {
    const authenticate = authenticated();
    const persistTimezone = vi.fn(
      async (): Promise<SetUserTimezoneResult> => ({ outcome: "USER_NOT_FOUND" }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(response.status).toBe(500);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual({ error: { code: "USER_PROVISIONING_INCONSISTENT" } });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("F. unexpected thrown error from persistTimezone: stable 500, no raw error/database details leaked", async () => {
    const authenticate = authenticated();
    const persistTimezone = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");
    expect(JSON.stringify(response.body)).not.toContain("ECONNREFUSED");

    consoleErrorSpy.mockRestore();
  });

  it("unexpected thrown error from authenticate itself: also mapped to a stable 500, not left to propagate", async () => {
    const authenticate = vi.fn(async () => {
      throw new Error("unexpected Supabase SDK failure");
    });
    const persistTimezone = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(persistTimezone).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("G. never accepts/consumes a client-supplied userId — the ONLY userId reaching persistTimezone is authResult.userId", async () => {
    const authenticate = authenticated("the-real-authenticated-user");
    const persistTimezone = vi.fn(
      async (command: { actorUserId: string; timezone: string }): Promise<SetUserTimezoneResult> => {
        void command; // asserted from persistTimezone.mock.calls below, not here
        return { outcome: "UPDATED", timezone: "Asia/Jerusalem" };
      },
    );

    await handleSetUserTimezone({
      authenticate,
      timezone: "Asia/Jerusalem",
      persistTimezone,
    });

    expect(persistTimezone).toHaveBeenCalledTimes(1);
    const [command] = persistTimezone.mock.calls[0];
    expect(Object.keys(command)).toEqual(["actorUserId", "timezone"]);
    expect(command.actorUserId).toBe("the-real-authenticated-user");
  });
});

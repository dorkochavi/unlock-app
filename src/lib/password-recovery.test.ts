import { describe, expect, it, vi } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  RECOVERY_DESTINATION,
  buildPasswordRecoveryRedirectTo,
  hasRecoverySession,
  recoveryRequestMessageKey,
  requestPasswordRecovery,
  resolveLoginSurfaceMode,
  updatePasswordFromRecovery,
  validateNewPassword,
} from "./password-recovery";

const ORIGIN = "https://app.example.org";

describe("buildPasswordRecoveryRedirectTo", () => {
  it("is the fixed same-origin /login?mode=recovery", () => {
    expect(buildPasswordRecoveryRedirectTo(ORIGIN)).toBe(`${ORIGIN}/login?mode=recovery`);
    expect(buildPasswordRecoveryRedirectTo("http://localhost:3000")).toBe(
      "http://localhost:3000/login?mode=recovery",
    );
  });
  it("drops path/query/userinfo of the origin input (no open redirect)", () => {
    expect(buildPasswordRecoveryRedirectTo("https://app.example.org/evil?next=//x#h")).toBe(
      `${ORIGIN}/login?mode=recovery`,
    );
    expect(buildPasswordRecoveryRedirectTo("https://user:pw@app.example.org")).toBe(
      `${ORIGIN}/login?mode=recovery`,
    );
  });
  it.each([null, "", "not a url", "javascript:alert(1)", "data:text/html,x", "ftp://x"])(
    "returns null for unusable origin %s",
    (o) => {
      expect(buildPasswordRecoveryRedirectTo(o)).toBeNull();
    },
  );
});

describe("resolveLoginSurfaceMode", () => {
  it("recognises only mode=recovery", () => {
    expect(resolveLoginSurfaceMode("?mode=recovery&code=abc")).toBe("recovery");
    expect(resolveLoginSurfaceMode("?mode=other")).toBe("sign-in");
    expect(resolveLoginSurfaceMode("?next=/today")).toBe("sign-in");
    expect(resolveLoginSurfaceMode("")).toBe("sign-in");
  });
});

describe("validateNewPassword", () => {
  it("matches the current signup policy (min 6, no stronger)", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(validateNewPassword("12345", "12345")).toBe("too-short");
    expect(validateNewPassword("123456", "123456")).toBeNull();
    expect(validateNewPassword("abcdef", "abcdef")).toBeNull();
  });
  it("detects mismatch", () => {
    expect(validateNewPassword("123456", "1234567")).toBe("mismatch");
  });
});

describe("requestPasswordRecovery", () => {
  const client = (result: unknown, throws = false) => ({
    auth: {
      resetPasswordForEmail: vi.fn(async () => {
        if (throws) throw new Error("secret stack");
        return result as { error: null };
      }),
    },
  });

  it("calls resetPasswordForEmail with the fixed redirect and trimmed email", async () => {
    const c = client({ error: null });
    expect(await requestPasswordRecovery(c, " a@b.co ", ORIGIN)).toBe("sent");
    expect(c.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", {
      redirectTo: `${ORIGIN}/login?mode=recovery`,
    });
  });
  it("omits redirectTo for an unusable origin", async () => {
    const c = client({ error: null });
    await requestPasswordRecovery(c, "a@b.co", null);
    expect(c.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", undefined);
  });
  it("returns the same outcome for any successful response (no enumeration)", async () => {
    expect(await requestPasswordRecovery(client({ error: null }), "known@x.co", ORIGIN)).toBe(
      await requestPasswordRecovery(client({ error: null }), "unknown@x.co", ORIGIN),
    );
  });
  it("maps rate limit and other errors to coarse outcomes without raw detail", async () => {
    expect(await requestPasswordRecovery(client({ error: { status: 429 } }), "a@b.co", ORIGIN)).toBe(
      "rate-limited",
    );
    expect(
      await requestPasswordRecovery(
        client({ error: { code: "over_email_send_rate_limit" } }),
        "a@b.co",
        ORIGIN,
      ),
    ).toBe("rate-limited");
    expect(await requestPasswordRecovery(client({ error: { status: 500 } }), "a@b.co", ORIGIN)).toBe(
      "error",
    );
    expect(await requestPasswordRecovery(client(null, true), "a@b.co", ORIGIN)).toBe("error");
  });
});

describe("hasRecoverySession", () => {
  it("is true only with a session; false for none or thrown", async () => {
    expect(
      await hasRecoverySession({ auth: { getSession: async () => ({ data: { session: {} } }) } }),
    ).toBe(true);
    expect(
      await hasRecoverySession({ auth: { getSession: async () => ({ data: { session: null } }) } }),
    ).toBe(false);
    expect(
      await hasRecoverySession({
        auth: {
          getSession: async () => {
            throw new Error("x");
          },
        },
      }),
    ).toBe(false);
  });
});

describe("updatePasswordFromRecovery", () => {
  const upd = (error: unknown, throws = false) => ({
    auth: {
      updateUser: vi.fn(async () => {
        if (throws) throw new Error("boom");
        return { error };
      }),
    },
  });

  it("updates on valid matching input", async () => {
    const c = upd(null);
    expect(await updatePasswordFromRecovery(c, "123456", "123456")).toBe("updated");
    expect(c.auth.updateUser).toHaveBeenCalledWith({ password: "123456" });
    expect(RECOVERY_DESTINATION).toBe("/today");
  });
  it("does not call Supabase on mismatch or too-short", async () => {
    const c = upd(null);
    expect(await updatePasswordFromRecovery(c, "123456", "654321")).toBe("mismatch");
    expect(await updatePasswordFromRecovery(c, "123", "123")).toBe("too-short");
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });
  it("reports failure (e.g. missing/expired session) as a coarse outcome only", async () => {
    const out1 = await updatePasswordFromRecovery(
      upd({ message: "Auth session missing!", stack: "at secret" }),
      "123456",
      "123456",
    );
    const out2 = await updatePasswordFromRecovery(upd(null, true), "123456", "123456");
    expect(out1).toBe("failed");
    expect(out2).toBe("failed");
  });
});

describe("recovery hardening (security review M1/L1)", () => {
  it("rate-limited and sent map to the same UI message (no enumeration via 429)", () => {
    expect(recoveryRequestMessageKey("rate-limited")).toBe(recoveryRequestMessageKey("sent"));
    expect(recoveryRequestMessageKey("error")).toBe("genericError");
  });
  it("revokes other sessions after a successful update; signOut failure does not fail the flow", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("boom"));
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    expect(await updatePasswordFromRecovery({ auth: { updateUser, signOut } }, "secret1", "secret1")).toBe("updated");
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });
  it("does not revoke sessions when the update fails", async () => {
    const signOut = vi.fn();
    const updateUser = vi.fn().mockResolvedValue({ error: { message: "x" } });
    expect(await updatePasswordFromRecovery({ auth: { updateUser, signOut } }, "secret1", "secret1")).toBe("failed");
    expect(signOut).not.toHaveBeenCalled();
  });
});

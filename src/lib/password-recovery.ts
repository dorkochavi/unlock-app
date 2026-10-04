/**
 * Password-recovery logic (Run PILOT-CLOSURE-OVERNIGHT-001 Slice B). Pure /
 * client-injected so it is testable in the node test environment; the login
 * page only wires these to React state.
 *
 * Flow: Supabase PKCE (`@supabase/ssr` browser client). The recovery email
 * link returns to the fixed app-owned `/login?mode=recovery` with `?code=...`
 * appended by Supabase; the browser client exchanges the code on init and
 * establishes a session, after which `updateUser({ password })` is allowed.
 * No server route is involved: Supabase itself requires that session.
 */
/** Mirrors the current signup policy (`minLength={6}` on the login form). */
export const MIN_PASSWORD_LENGTH = 6;

export type RecoveryRequestOutcome = "sent" | "rate-limited" | "error";
export type PasswordValidationError = "too-short" | "mismatch";
export type UpdatePasswordOutcome = "updated" | PasswordValidationError | "failed";

/** Minimal structural client types (a real SupabaseClient satisfies them). */
export interface RecoveryRequestClient {
  auth: {
    resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string },
    ): Promise<{ error: { status?: number; code?: string } | null }>;
  };
}
export interface UpdatePasswordClient {
  auth: {
    updateUser(attrs: { password: string }): Promise<{ error: unknown | null }>;
    signOut?(options: { scope: "others" }): Promise<unknown>;
  };
}
export interface RecoverySessionClient {
  auth: {
    getSession(): Promise<{ data: { session: unknown | null } }>;
  };
}

/**
 * Fixed same-origin recovery landing URL, built like `buildSignUpEmailRedirectTo`:
 * only a normalized http(s) origin + the fixed `/login?mode=recovery`. Never
 * derived from request data. `null` for an unusable origin (option omitted).
 */
export function buildPasswordRecoveryRedirectTo(origin: string | null): string | null {
  try {
    const url = new URL(origin ?? "");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}/login?mode=recovery`;
  } catch {
    return null;
  }
}

export type LoginSurfaceMode = "sign-in" | "recovery";

/** `/login?mode=recovery` selects the update-password surface; anything else is sign-in. */
export function resolveLoginSurfaceMode(search: string): LoginSurfaceMode {
  return new URLSearchParams(search).get("mode") === "recovery" ? "recovery" : "sign-in";
}

export function validateNewPassword(
  password: string,
  confirmation: string,
): PasswordValidationError | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too-short";
  if (password !== confirmation) return "mismatch";
  return null;
}

/**
 * Requests a recovery email. Success is reported identically whether or not
 * the account exists (Supabase does not distinguish). Raw errors are never
 * returned: only a coarse outcome.
 */
export async function requestPasswordRecovery(
  client: RecoveryRequestClient,
  email: string,
  origin: string | null,
): Promise<RecoveryRequestOutcome> {
  try {
    const redirectTo = buildPasswordRecoveryRedirectTo(origin);
    const { error } = await client.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo === null ? undefined : { redirectTo },
    );
    if (!error) return "sent";
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return "rate-limited";
    }
    return "error";
  } catch {
    return "error";
  }
}

/**
 * UI message key for a recovery request. The per-user resend cooldown (429) can
 * only be hit for an existing account, so it must look identical to "sent"
 * (otherwise a repeated request is an account-existence oracle).
 */
export function recoveryRequestMessageKey(
  outcome: RecoveryRequestOutcome,
): "forgotSent" | "genericError" {
  return outcome === "sent" || outcome === "rate-limited" ? "forgotSent" : "genericError";
}

/** True only when a recovery/auth session exists (the code exchange succeeded). */
export async function hasRecoverySession(client: RecoverySessionClient): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession();
    return data.session !== null && data.session !== undefined;
  } catch {
    return false;
  }
}

/** Validates, then updates the password for the current (recovery) session. */
export async function updatePasswordFromRecovery(
  client: UpdatePasswordClient,
  password: string,
  confirmation: string,
): Promise<UpdatePasswordOutcome> {
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return invalid;
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) return "failed";
  } catch {
    return "failed";
  }
  // Best-effort: a password change invalidates other sessions (e.g. an attacker's).
  try {
    await client.auth.signOut?.({ scope: "others" });
  } catch {
    /* the password is already changed; do not fail the flow */
  }
  return "updated";
}

/** Post-recovery destination: the fixed default landing. */
export const RECOVERY_DESTINATION = "/today";

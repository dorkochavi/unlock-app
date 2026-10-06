"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Field } from "@/components/field";
import { Input } from "@/components/input";
import { Notice } from "@/components/notice";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";
import { buildSignUpEmailRedirectTo } from "@/lib/auth-redirect";
import {
  RECOVERY_DESTINATION,
  hasRecoverySession,
  requestPasswordRecovery,
  recoveryRequestMessageKey,
  resolveLoginSurfaceMode,
  updatePasswordFromRecovery,
} from "@/lib/password-recovery";
import { resolveNextPathFromSearch } from "@/lib/safe-redirect";

type Mode = "sign-in" | "sign-up" | "forgot" | "recovery";

export default function LoginPage() {
  const messages = getMessages();
  const router = useRouter();
  // `next` is read from the browser's own location AT SUBMIT TIME (see
  // `handleSubmit`), not during render: on a client-side navigation from
  // /join/:id the URL is not updated until after this page renders, so a
  // render-time read would lose the join destination (regression fixed in
  // Run 009 S2 Preview). Always validated through the explicit allowlist
  // (`resolveNextPathFromSearch` -> `resolveSafeNextPath`) — never trusted as
  // a raw redirect target.
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Password-recovery landing (/login?mode=recovery&code=...): the Supabase
  // browser client (PKCE) exchanges the code on init; the update form is shown
  // only if that produced a session.
  const [recoveryState, setRecoveryState] = useState<"checking" | "ready" | "invalid">("checking");

  function goTo(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    try {
      const nextPath = resolveNextPathFromSearch(window.location.search);
      const supabase = createSupabaseBrowserClient();

      if (mode === "forgot") {
        // Same neutral confirmation whether or not the account exists.
        const outcome = await requestPasswordRecovery(supabase, email, window.location.origin);
        if (recoveryRequestMessageKey(outcome) === "forgotSent") setInfo(messages.auth.forgotSent);
        else setError(messages.auth.genericError);
        return;
      }

      if (mode === "recovery") {
        const outcome = await updatePasswordFromRecovery(supabase, password, confirmPassword);
        if (outcome === "updated") {
          router.push(RECOVERY_DESTINATION);
          router.refresh();
          return;
        }
        setError(
          outcome === "too-short"
            ? messages.auth.passwordTooShort
            : outcome === "mismatch"
              ? messages.auth.passwordMismatch
              : messages.auth.recoveryFailed,
        );
        return;
      }

      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(messages.auth.invalidCredentials);
          return;
        }
        router.push(nextPath);
        router.refresh();
        return;
      }

      // FUB-027: return the confirmation link to /login carrying the
      // validated `next` (join intent). `null` (unusable origin) omits the
      // option, falling back to Supabase's Site URL instead of failing.
      const emailRedirectTo = buildSignUpEmailRedirectTo(window.location.origin, nextPath);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        ...(emailRedirectTo === null ? {} : { options: { emailRedirectTo } }),
      });
      if (signUpError) {
        setError(messages.auth.genericError);
        return;
      }
      if (data.session) {
        router.push(nextPath);
        router.refresh();
        return;
      }
      setInfo(messages.auth.signUpCheckEmail);
    } catch {
      setError(messages.auth.genericError);
    } finally {
      setPending(false);
    }
  }

  // Recovery landing detection runs after the submit handler is declared and
  // reads the URL only inside an effect (never during render). The first
  // statement of the async body is an `await` (react-hooks/set-state-in-effect);
  // the microtask resolves before paint, so no sign-in flash is visible.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled || resolveLoginSurfaceMode(window.location.search) !== "recovery") return;
      setMode("recovery");
      let ready = false;
      try {
        ready = await hasRecoverySession(createSupabaseBrowserClient());
      } catch {
        ready = false;
      }
      if (!cancelled) setRecoveryState(ready ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isRecovery = mode === "recovery";
  const isForgot = mode === "forgot";
  const heading = isRecovery
    ? messages.auth.recoveryHeading
    : isForgot
      ? messages.auth.forgotHeading
      : mode === "sign-in"
        ? messages.auth.signInHeading
        : messages.auth.signUpHeading;
  const submitLabel = isRecovery
    ? pending
      ? messages.auth.recoveryPending
      : messages.auth.recoverySubmit
    : isForgot
      ? pending
        ? messages.auth.forgotPending
        : messages.auth.forgotSubmit
      : pending
        ? mode === "sign-in"
          ? messages.auth.signInPending
          : messages.auth.signUpPending
        : mode === "sign-in"
          ? messages.auth.signInSubmit
          : messages.auth.signUpSubmit;

  return (
    <main className="page-container flex flex-1 flex-col items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-page font-extrabold text-primary">{messages.shell.heading}</p>
        <Card as="section" variant="raised" className="p-6">
          <h1 className="mb-5 text-title font-bold">{heading}</h1>
          {isRecovery && recoveryState === "checking" ? (
            <Notice tone="info">{messages.auth.recoveryChecking}</Notice>
          ) : isRecovery && recoveryState === "invalid" ? (
            <div className="flex flex-col gap-4">
              <Notice tone="error">{messages.auth.recoveryInvalidLink}</Notice>
              <Button onClick={() => goTo("forgot")} fullWidth size="lg">
                {messages.auth.recoveryRequestNewLink}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {isForgot ? <p className="text-secondary text-muted">{messages.auth.forgotIntro}</p> : null}
              {!isRecovery ? (
                <Field id="login-email" label={messages.auth.emailLabel}>
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  )}
                </Field>
              ) : null}
              {!isForgot ? (
                <Field
                  id="login-password"
                  label={isRecovery ? messages.auth.newPasswordLabel : messages.auth.passwordLabel}
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  )}
                </Field>
              ) : null}
              {isRecovery ? (
                <Field id="login-confirm-password" label={messages.auth.confirmPasswordLabel}>
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  )}
                </Field>
              ) : null}

              {error ? <Notice tone="error">{error}</Notice> : null}
              {info ? <Notice tone="success">{info}</Notice> : null}

              <Button type="submit" disabled={pending} fullWidth size="lg" className="mt-1">
                {submitLabel}
              </Button>
            </form>
          )}
        </Card>

        <div className="mt-3 flex flex-col items-center gap-1">
          {mode === "sign-in" ? (
            <Button variant="tertiary" onClick={() => goTo("forgot")} fullWidth>
              {messages.auth.forgotPassword}
            </Button>
          ) : null}
          {isForgot || (isRecovery && recoveryState === "invalid") ? (
            <Button variant="tertiary" onClick={() => goTo("sign-in")} fullWidth>
              {messages.auth.backToSignIn}
            </Button>
          ) : null}
          {mode === "sign-in" || mode === "sign-up" ? (
            <Button
              variant="tertiary"
              onClick={() => goTo(mode === "sign-in" ? "sign-up" : "sign-in")}
              fullWidth
            >
              {mode === "sign-in" ? messages.auth.switchToSignUp : messages.auth.switchToSignIn}
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

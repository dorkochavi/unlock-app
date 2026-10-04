"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Label } from "@/components/input";
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
    <main className="flex flex-1 items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">{heading}</h1>
        <Card as="section">
          {isRecovery && recoveryState === "checking" ? (
            <p className="text-sm text-muted">{messages.auth.recoveryChecking}</p>
          ) : isRecovery && recoveryState === "invalid" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-danger">{messages.auth.recoveryInvalidLink}</p>
              <Button onClick={() => goTo("forgot")} fullWidth>
                {messages.auth.recoveryRequestNewLink}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {isForgot ? <p className="text-sm text-muted">{messages.auth.forgotIntro}</p> : null}
              {!isRecovery ? (
                <label className="block">
                  <Label>{messages.auth.emailLabel}</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              ) : null}
              {!isForgot ? (
                <label className="block">
                  <Label>
                    {isRecovery ? messages.auth.newPasswordLabel : messages.auth.passwordLabel}
                  </Label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              ) : null}
              {isRecovery ? (
                <label className="block">
                  <Label>{messages.auth.confirmPasswordLabel}</Label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              ) : null}

              {error ? <p className="text-sm text-danger">{error}</p> : null}
              {info ? <p className="text-sm text-state-solid">{info}</p> : null}

              <Button type="submit" disabled={pending} fullWidth>
                {submitLabel}
              </Button>
            </form>
          )}
        </Card>

        {mode === "sign-in" ? (
          <Button variant="tertiary" onClick={() => goTo("forgot")} fullWidth className="mt-4">
            {messages.auth.forgotPassword}
          </Button>
        ) : null}
        {isForgot || (isRecovery && recoveryState === "invalid") ? (
          <Button variant="tertiary" onClick={() => goTo("sign-in")} fullWidth className="mt-4">
            {messages.auth.backToSignIn}
          </Button>
        ) : null}
        {mode === "sign-in" || mode === "sign-up" ? (
          <Button
            variant="tertiary"
            onClick={() => goTo(mode === "sign-in" ? "sign-up" : "sign-in")}
            fullWidth
            className="mt-4"
          >
            {mode === "sign-in" ? messages.auth.switchToSignUp : messages.auth.switchToSignIn}
          </Button>
        ) : null}
      </div>
    </main>
  );
}

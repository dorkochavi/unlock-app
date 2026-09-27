"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Label } from "@/components/input";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";
import { buildSignUpEmailRedirectTo } from "@/lib/auth-redirect";
import { resolveNextPathFromSearch } from "@/lib/safe-redirect";

type Mode = "sign-in" | "sign-up";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchMode() {
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    try {
      const nextPath = resolveNextPathFromSearch(window.location.search);
      const supabase = createSupabaseBrowserClient();

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

  return (
    <main className="flex flex-1 items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? messages.auth.signInHeading : messages.auth.signUpHeading}
        </h1>
        <Card as="section">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <label className="block">
              <Label>{messages.auth.passwordLabel}</Label>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {info ? <p className="text-sm text-state-solid">{info}</p> : null}

            <Button type="submit" disabled={pending} fullWidth>
              {pending
                ? mode === "sign-in"
                  ? messages.auth.signInPending
                  : messages.auth.signUpPending
                : mode === "sign-in"
                  ? messages.auth.signInSubmit
                  : messages.auth.signUpSubmit}
            </Button>
          </form>
        </Card>

        <Button variant="tertiary" onClick={switchMode} fullWidth className="mt-4">
          {mode === "sign-in" ? messages.auth.switchToSignUp : messages.auth.switchToSignIn}
        </Button>
      </div>
    </main>
  );
}

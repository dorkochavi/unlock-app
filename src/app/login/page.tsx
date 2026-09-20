"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";
import { resolveSafeNextPath } from "@/lib/safe-redirect";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const messages = getMessages();
  const router = useRouter();
  // Read `next` directly from the browser's own location rather than
  // `useSearchParams()` — this page is entirely client-rendered, and this
  // avoids Next.js's Suspense-boundary requirement for that hook with no
  // behavioral difference. Validated through an explicit allowlist
  // (`resolveSafeNextPath`) — never trusted as a raw redirect target.
  const [nextPath] = useState(() =>
    resolveSafeNextPath(
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("next"),
    ),
  );
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

      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
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
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? messages.auth.signInHeading : messages.auth.signUpHeading}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {messages.auth.emailLabel}
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {messages.auth.passwordLabel}
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-600">{info}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending
              ? mode === "sign-in"
                ? messages.auth.signInPending
                : messages.auth.signUpPending
              : mode === "sign-in"
                ? messages.auth.signInSubmit
                : messages.auth.signUpSubmit}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-4 w-full text-center text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          {mode === "sign-in" ? messages.auth.switchToSignUp : messages.auth.switchToSignIn}
        </button>
      </div>
    </div>
  );
}

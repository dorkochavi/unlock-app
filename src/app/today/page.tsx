"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";
import type { DailyPlanDto, DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "settingUpTimezone" }
  | { kind: "timezoneError" }
  | { kind: "error" }
  | { kind: "ready"; plan: DailyPlanDto };

async function fetchTodayPlan(): Promise<
  { outcome: "READY"; plan: DailyPlanDto } | { outcome: "UNAUTHENTICATED" } | { outcome: "TIMEZONE_NOT_SET" } | { outcome: "ERROR" }
> {
  const response = await fetch("/api/daily-plan/today", { method: "GET" });
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 422) {
    return { outcome: "TIMEZONE_NOT_SET" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  const body = (await response.json()) as { plan: DailyPlanDto };
  return { outcome: "READY", plan: body.plan };
}

async function persistDetectedTimezone(): Promise<boolean> {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch("/api/user/timezone", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ timezone: detected }),
  });
  return response.ok;
}

export default function TodayPage() {
  const messages = getMessages();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  // Effects must not call setState synchronously as their first action
  // (react-hooks/set-state-in-effect) — `run`'s first statement is always
  // an `await`, never a synchronous setState. The initial "loading" state
  // already comes from `useState`'s own initializer above; a retry sets
  // "loading" itself (from an event handler, not an effect) before
  // bumping `reloadToken`.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const first = await fetchTodayPlan();
      if (cancelled) return;

      if (first.outcome === "UNAUTHENTICATED") {
        setState({ kind: "signed-out" });
        return;
      }
      if (first.outcome === "ERROR") {
        setState({ kind: "error" });
        return;
      }
      if (first.outcome === "READY") {
        setState({ kind: "ready", plan: first.plan });
        return;
      }

      // TIMEZONE_NOT_SET: this is a first-login-only path — the timezone
      // is only ever WRITTEN here because the server just told us none is
      // persisted yet; an already-set timezone is never silently
      // overwritten.
      setState({ kind: "settingUpTimezone" });
      const persisted = await persistDetectedTimezone();
      if (cancelled) return;
      if (!persisted) {
        setState({ kind: "timezoneError" });
        return;
      }

      const second = await fetchTodayPlan();
      if (cancelled) return;
      if (second.outcome === "READY") {
        setState({ kind: "ready", plan: second.plan });
      } else if (second.outcome === "UNAUTHENTICATED") {
        setState({ kind: "signed-out" });
      } else {
        setState({ kind: "error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setState({ kind: "signed-out" });
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.today.heading}</h1>
        {state.kind === "ready" ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            {messages.today.signOut}
          </button>
        ) : null}
      </header>

      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" || state.kind === "settingUpTimezone" ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            {state.kind === "settingUpTimezone"
              ? messages.today.settingUpTimezone
              : messages.today.loading}
          </p>
        ) : null}

        {state.kind === "signed-out" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.today.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.today.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "timezoneError" || state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">
              {state.kind === "timezoneError"
                ? messages.today.timezoneErrorTitle
                : messages.today.genericErrorTitle}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.today.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" ? <TodayPlanView plan={state.plan} /> : null}
      </main>
    </div>
  );
}

function TodayPlanView({ plan }: { plan: DailyPlanDto }) {
  const messages = getMessages();

  if (plan.items.length === 0) {
    return (
      <div className="text-center">
        <p className="mb-2 text-lg">{messages.today.emptyTitle}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{messages.today.emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{plan.plannedForDate}</p>
      <h2 className="mb-4 text-lg font-medium">{messages.today.itemsHeading}</h2>
      <ol className="flex flex-col gap-3">
        {plan.items.map((item) => (
          <TodayItemCard key={item.id} item={item} />
        ))}
      </ol>
    </div>
  );
}

function TodayItemCard({ item }: { item: DailyPlanItemDto }) {
  const messages = getMessages();
  const actionLabel =
    messages.today.actionType[item.actionType as keyof typeof messages.today.actionType] ??
    item.actionType;
  const statusLabel =
    messages.today.status[item.status as keyof typeof messages.today.status] ?? item.status;

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="font-medium">{actionLabel}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {messages.today.statusLabel}: {statusLabel}
        </span>
      </div>
    </li>
  );
}

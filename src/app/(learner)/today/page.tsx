"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";
import { selectDisplayedItem, type AnswerFeedback } from "./select-displayed-item";
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

type SubmitAnswerOutcome =
  | { outcome: "ACCEPTED"; isCorrect: boolean }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "ALREADY_RESOLVED" }
  | { outcome: "ERROR" };

async function submitDailyPlanItemAnswer(
  itemId: string,
  body: { submissionId: string; selectedAnswer: string | string[] | null },
): Promise<SubmitAnswerOutcome> {
  let response: Response;
  try {
    response = await fetch(`/api/daily-plan/items/${itemId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 409) {
    return { outcome: "ALREADY_RESOLVED" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const json = (await response.json()) as { isCorrect: boolean };
    return { outcome: "ACCEPTED", isCorrect: json.isCorrect };
  } catch {
    return { outcome: "ERROR" };
  }
}

type SkipOutcome =
  | { outcome: "SKIPPED" }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "ALREADY_RESOLVED" }
  | { outcome: "ERROR" };

async function skipDailyPlanItem(itemId: string): Promise<SkipOutcome> {
  let response: Response;
  try {
    response = await fetch(`/api/daily-plan/items/${itemId}/skip`, { method: "POST" });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 409) {
    return { outcome: "ALREADY_RESOLVED" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  return { outcome: "SKIPPED" };
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

        {state.kind === "ready" ? (
          <TodayPlanView
            plan={state.plan}
            onUnauthenticated={() => setState({ kind: "signed-out" })}
          />
        ) : null}
      </main>
    </div>
  );
}

function progressLabel(template: string, resolved: number, total: number): string {
  return template.replace("{resolved}", String(resolved)).replace("{total}", String(total));
}

function generateSubmissionId(): string {
  // crypto.randomUUID() is available in every browser this app targets
  // (secure context, modern evergreen browsers) — no polyfill needed.
  return crypto.randomUUID();
}

type Feedback = AnswerFeedback;

/**
 * Stateful Today answering session (Night-Run Slice 2). Reuses the exact
 * `DailyPlanItemDto[]` the server already returned — no separate fetch, no
 * client-side ranking/selection logic (all of that stays server-side, per
 * `.claude/rules/learning-engine.md`). This component only tracks:
 * - a local COPY of item resolution status (updated optimistically after a
 *   successful submit, so the just-answered item stops being "the active
 *   one" without a full page refetch);
 * - the in-progress selection/submission state for whichever ONE item is
 *   currently active.
 *
 * A page reload discards all of this local state and reconstructs from the
 * server's real `GET /api/daily-plan/today` response, per Slice 2's own
 * "page reload must reconstruct state from server" requirement — nothing
 * here is persisted client-side.
 */
function TodayPlanView({
  plan,
  onUnauthenticated,
}: {
  plan: DailyPlanDto;
  onUnauthenticated: () => void;
}) {
  const messages = getMessages();
  const [items, setItems] = useState<DailyPlanItemDto[]>(plan.items);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyResolvedNotice, setAlreadyResolvedNotice] = useState(false);

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p className="mb-2 text-lg">{messages.today.emptyTitle}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{messages.today.emptyBody}</p>
      </div>
    );
  }

  const total = items.length;
  const resolvedCount = items.filter((item) => item.status !== "pending").length;
  const { item: current, feedback: activeFeedback } = selectDisplayedItem(items, feedback);

  async function handleAnswer(itemId: string, selectedAnswer: string | string[] | null) {
    setSubmitError(null);
    const result = await submitDailyPlanItemAnswer(itemId, {
      submissionId: generateSubmissionId(),
      selectedAnswer,
    });

    if (result.outcome === "UNAUTHENTICATED") {
      onUnauthenticated();
      return;
    }
    if (result.outcome === "ALREADY_RESOLVED") {
      // Another tab/device already resolved this exact item — the local
      // copy is stale. Refetch the real plan rather than guessing at
      // correctness we were never told.
      setAlreadyResolvedNotice(true);
      const refreshed = await fetchTodayPlan();
      if (refreshed.outcome === "READY") {
        setItems(refreshed.plan.items);
      } else if (refreshed.outcome === "UNAUTHENTICATED") {
        onUnauthenticated();
      }
      setAlreadyResolvedNotice(false);
      return;
    }
    if (result.outcome === "ERROR") {
      setSubmitError(messages.today.submitError);
      return;
    }

    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, status: "completed" } : item)),
    );
    setFeedback({ itemId, isCorrect: result.isCorrect });
  }

  async function handleSkip(itemId: string) {
    setSubmitError(null);
    const result = await skipDailyPlanItem(itemId);

    if (result.outcome === "UNAUTHENTICATED") {
      onUnauthenticated();
      return;
    }
    if (result.outcome === "ALREADY_RESOLVED") {
      setAlreadyResolvedNotice(true);
      const refreshed = await fetchTodayPlan();
      if (refreshed.outcome === "READY") {
        setItems(refreshed.plan.items);
      } else if (refreshed.outcome === "UNAUTHENTICATED") {
        onUnauthenticated();
      }
      setAlreadyResolvedNotice(false);
      return;
    }
    if (result.outcome === "ERROR") {
      setSubmitError(messages.today.skipError);
      return;
    }

    // Skip is not an answer — no correctness feedback, no continue step
    // (`.claude/rules/learning-engine.md` "Item resolution"). Resolving it
    // locally immediately advances `current` to the next pending item.
    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, status: "skipped" } : item)),
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>{plan.plannedForDate}</span>
        <span>{progressLabel(messages.today.progressLabel, resolvedCount, total)}</span>
      </div>

      {alreadyResolvedNotice ? (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {messages.today.alreadyResolvedError}
        </p>
      ) : null}

      {current === null ? (
        <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <p className="mb-2 text-lg font-medium">{messages.today.completionTitle}</p>
          <p className="text-zinc-600 dark:text-zinc-400">{messages.today.completionBody}</p>
        </div>
      ) : (
        <TodayAnswerCard
          key={current.id}
          item={current}
          feedback={activeFeedback}
          submitError={submitError}
          onSubmit={(selectedAnswer) => handleAnswer(current.id, selectedAnswer)}
          onContinue={() => setFeedback(null)}
          onSkip={() => handleSkip(current.id)}
        />
      )}
    </div>
  );
}

function TodayAnswerCard({
  item,
  feedback,
  submitError,
  onSubmit,
  onContinue,
  onSkip,
}: {
  item: DailyPlanItemDto;
  feedback: Feedback | null;
  submitError: string | null;
  onSubmit: (selectedAnswer: string | string[] | null) => Promise<void>;
  onContinue: () => void;
  onSkip: () => Promise<void>;
}) {
  const messages = getMessages();
  const isMultiple = item.questionType === "MULTIPLE_CHOICE";
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const busy = submitting || skipping;

  const actionLabel =
    messages.today.actionType[item.actionType as keyof typeof messages.today.actionType] ??
    item.actionType;

  function toggleOption(optionId: string) {
    if (feedback !== null || busy) return;
    if (isMultiple) {
      setSelected((previous) =>
        previous.includes(optionId)
          ? previous.filter((id) => id !== optionId)
          : [...previous, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  }

  async function handleSubmit() {
    if (selected.length === 0 || busy) return;
    setSubmitting(true);
    const selectedAnswer = isMultiple ? selected : (selected[0] ?? null);
    await onSubmit(selectedAnswer);
    setSubmitting(false);
  }

  async function handleSkipClick() {
    if (busy) return;
    setSkipping(true);
    await onSkip();
    setSkipping(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-3 font-medium">{item.prompt}</p>
      <ul className="mb-3 flex flex-col gap-2">
        {item.answerOptions.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => toggleOption(option.id)}
                disabled={feedback !== null || busy}
                aria-pressed={isSelected}
                className={`w-full rounded-md border px-3 py-3 text-start text-sm transition disabled:opacity-60 ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {option.content}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{actionLabel}</div>

      {submitError ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{submitError}</p>
      ) : null}

      {feedback === null ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.length === 0 || busy}
            className="w-full rounded-md bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? messages.today.submitting : messages.today.submit}
          </button>
          {/* Visually secondary, per Slice 3: Skip is not an answer and
              must not compete with the primary submit action. */}
          <button
            type="button"
            onClick={handleSkipClick}
            disabled={busy}
            className="w-full rounded-md px-4 py-2 text-sm text-zinc-500 underline disabled:opacity-50 dark:text-zinc-400"
          >
            {skipping ? messages.today.skipping : messages.today.skip}
          </button>
        </div>
      ) : (
        <div>
          <p
            className={`mb-3 font-medium ${
              feedback.isCorrect
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {feedback.isCorrect ? messages.today.correct : messages.today.incorrect}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-md border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-700"
          >
            {messages.today.continueAction}
          </button>
        </div>
      )}
    </div>
  );
}

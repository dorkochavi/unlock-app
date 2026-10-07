"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { ToneIcon } from "@/components/icons";
import { ExitIcon, LearnHeader } from "@/components/learn-header";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Skeleton } from "@/components/skeleton";
import { StateBlock } from "@/components/state-block";
import { interpolate } from "@/lib/interpolate";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";
import { useIsLearnMode, useLearnMode } from "../learn-mode";
import { QuestionCard } from "./question-card";
import { selectDisplayedItem, type AnswerFeedback } from "./select-displayed-item";
import { fetchTodayPlan, persistDetectedTimezone } from "./fetch-today-plan";
import type { DailyPlanDto, DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";
import type { ConfidenceLevel } from "@/domain/learning/types";

type ViewState =
  | { kind: "loading" }
  // `answerNotSaved`: the session expired DURING an Answer submit, so the
  // learner's selection was not recorded (Slice B recovery gap (c)).
  | { kind: "signed-out"; answerNotSaved?: boolean }
  | { kind: "settingUpTimezone" }
  | { kind: "timezoneError" }
  | { kind: "error" }
  | { kind: "ready"; plan: DailyPlanDto };

type SubmitAnswerOutcome =
  | {
      outcome: "ACCEPTED";
      isCorrect: boolean;
      correctOptionIds: string[];
      explanation: string | null;
    }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "ALREADY_RESOLVED" }
  | { outcome: "ERROR" };

async function submitDailyPlanItemAnswer(
  itemId: string,
  body: {
    submissionId: string;
    selectedAnswer: string | string[] | null;
    confidenceLevel: ConfidenceLevel | null;
  },
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
    const json = (await response.json()) as {
      isCorrect: boolean;
      correctOptionIds?: unknown;
      explanation?: unknown;
    };
    const correctOptionIds =
      Array.isArray(json.correctOptionIds) &&
      json.correctOptionIds.every((id) => typeof id === "string")
        ? json.correctOptionIds
        : [];
    const explanation = typeof json.explanation === "string" ? json.explanation : null;
    return { outcome: "ACCEPTED", isCorrect: json.isCorrect, correctOptionIds, explanation };
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
  const learnMode = useIsLearnMode();

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

  return (
    <>
      {/* Learn Mode replaces the Browse header with its own minimal context bar. */}
      {/* UX-03-QA1 Finding 12: sign-out moved to the shared LearnerUtilityBar
          (layout.tsx), rendered above every learner page — no longer local
          to Today's own PageHeader trailing slot. */}
      {learnMode ? null : <PageHeader title={messages.today.heading} />}

      {state.kind === "loading" || state.kind === "settingUpTimezone" ? (
        <TodayLoading
          label={
            state.kind === "settingUpTimezone"
              ? messages.today.settingUpTimezone
              : messages.today.loading
          }
        />
      ) : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={
            state.answerNotSaved ? messages.today.answerNotSavedTitle : messages.today.signedOutTitle
          }
          body={state.answerNotSaved ? messages.today.answerNotSavedBody : undefined}
          action={
            <ButtonLink href={buildSignInHref("/today")}>{messages.today.signedOutAction}</ButtonLink>
          }
        />
      ) : null}

      {state.kind === "timezoneError" || state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={
            state.kind === "timezoneError"
              ? messages.today.timezoneErrorTitle
              : messages.today.genericErrorTitle
          }
          action={
            <Button variant="secondary" onClick={retry}>
              {messages.today.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" ? (
        <TodayPlanView
          plan={state.plan}
          onUnauthenticated={(answerNotSaved) => setState({ kind: "signed-out", answerNotSaved })}
        />
      ) : null}
    </>
  );
}

/** "YYYY-MM-DD" learner-local plan date -> "יום רביעי, 7 באוקטובר"; null when unparseable. */
function formatPlanDate(plannedForDate: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plannedForDate ?? "");
  if (match === null) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function SmallCheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * Today's queue: the plan's own items in plan order with their selection
 * reason and status (presentation only — uses only fields the DTO carries; no
 * ranking, no new fetch). The first pending item is marked "next".
 */
function TodayQueue({ items }: { items: DailyPlanItemDto[] }) {
  const messages = getMessages().today;
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const nextId = ordered.find((item) => item.status === "pending")?.id ?? null;

  return (
    <section aria-labelledby="today-queue-heading" className="mt-6">
      <h2 id="today-queue-heading" className="mb-3 text-section font-bold">
        {messages.itemsHeading}
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {ordered.map((item, index) => {
          const pending = item.status === "pending";
          const reason =
            messages.actionType[item.actionType as keyof typeof messages.actionType] ?? null;
          const statusLabel =
            messages.status[item.status as keyof typeof messages.status] ?? null;
          const isNext = item.id === nextId;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-card px-4 py-3 ${
                isNext ? "surface-raised ring-2 ring-primary-soft-border" : "border border-border bg-surface"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-secondary font-bold ${
                  item.status === "completed"
                    ? "bg-state-solid-soft text-state-solid"
                    : pending
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "bg-surface-muted text-muted"
                }`}
              >
                {item.status === "completed" ? <SmallCheckIcon /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${pending ? "text-foreground" : "text-muted"}`}>
                  {messages.queueItemLabel.replace("{n}", String(index + 1))}
                </p>
                {reason !== null ? <p className="mt-0.5 text-secondary text-muted">{reason}</p> : null}
              </div>
              {isNext ? (
                <span className="chip shrink-0 bg-primary-soft text-primary-soft-foreground">
                  {messages.queueNext}
                </span>
              ) : !pending && statusLabel !== null ? (
                <span
                  className={`chip shrink-0 ${
                    item.status === "completed" ? "bg-state-solid-soft text-state-solid" : ""
                  }`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Loading skeleton shaped like the Today home (hero + queue), announced once. */
function TodayLoading({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <Skeleton className="h-64 w-full rounded-surface md:h-52" />
        <Skeleton className="mb-3 mt-6 h-6 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-card" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Today landing (Run UX-01 UX-1, docs/UX_SPEC.md §2 items 13–14): answers
 * "where am I / what do I do / how far / what's next" with one hero surface and
 * one primary CTA before the question flow. Uses only the plan's own data.
 */
function TodayLanding({
  plan,
  items,
  focusOnMount,
  onStart,
}: {
  plan: DailyPlanDto;
  items: DailyPlanItemDto[];
  focusOnMount: boolean;
  onStart: () => void;
}) {
  const messages = getMessages().today;
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount) startRef.current?.focus();
  }, [focusOnMount]);
  const total = items.length;
  const resolved = items.filter((item) => item.status !== "pending").length;
  const remaining = total - resolved;
  const date = formatPlanDate(plan.plannedForDate);
  const title =
    resolved === 0
      ? messages.landingStartTitle
      : remaining === 1
        ? interpolate(messages.landingContinueTitleOne, { total })
        : interpolate(messages.landingContinueTitle, { remaining, total });

  return (
    <>
      <Card
        variant="hero"
        className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:gap-10"
      >
        <div className="min-w-0 flex-1">
          {date !== null ? <p className="text-meta font-semibold text-hero-muted">{date}</p> : null}
          <p className="mt-1 break-words text-[1.625rem] font-extrabold leading-tight sm:text-[1.875rem]">
            {title}
          </p>
          <p className="mt-2 text-body text-hero-muted">
            {total === 1 ? messages.landingBodyOne : interpolate(messages.landingBody, { total })}
          </p>
          <div className="mt-5">
            <ProgressBar
              fraction={total === 0 ? 0 : resolved / total}
              segments={total}
              size="lg"
              tone="hero"
              className="mb-2"
            />
            <p className="text-secondary font-semibold text-hero-muted">
              {interpolate(messages.landingProgress, { resolved, total })}
            </p>
          </div>
        </div>
        <button
          ref={startRef}
          type="button"
          onClick={onStart}
          className="inline-flex min-h-control-lg w-full items-center justify-center rounded-control bg-white px-6 text-body font-bold text-hero shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)] transition duration-150 hover:bg-hero-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:w-60 md:shrink-0"
        >
          {resolved === 0 ? messages.startAction : messages.continueLearning}
        </button>
      </Card>
      <TodayQueue items={items} />
    </>
  );
}

/**
 * Today Complete (docs/UX_SPEC.md §2 items 15–18): a success state, not an
 * empty state. The summary uses only the plan's own item statuses — no
 * correctness counts or other metrics the DTO does not carry. Calm, no
 * celebration effects.
 *
 * TEMPORARY BRIDGE (UX_SPEC §9): "המשך ללמוד" routes to `/courses` until
 * Course Practice exists (UX-3); it must be replaced then, not extended.
 */
function TodayComplete({
  items,
  focusOnMount,
}: {
  items: DailyPlanItemDto[];
  focusOnMount: boolean;
}) {
  const messages = getMessages().today;
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);
  const answered = items.filter((item) => item.status === "completed").length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  const summary = [
    answered === 1
      ? messages.completionAnsweredOne
      : answered > 1
        ? interpolate(messages.completionAnswered, { count: answered })
        : null,
    skipped > 0 ? interpolate(messages.completionSkipped, { count: skipped }) : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <>
      <Card
        variant="hero"
        className="flex flex-col items-center gap-5 p-7 text-center sm:p-10"
      >
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-hero-soft text-hero-foreground"
        >
          <ToneIcon tone="success" className="size-7" />
        </span>
        <div role="status">
          <p
            ref={titleRef}
            tabIndex={-1}
            className="text-[1.625rem] font-extrabold leading-tight focus:outline-none sm:text-[1.875rem]"
          >
            {messages.completionTitle}
          </p>
          <p className="mt-2 text-body text-hero-muted">{messages.completionBody}</p>
        </div>
        {summary.length > 0 ? (
          <p className="flex flex-wrap justify-center gap-2">
            {summary.map((part) => (
              <span key={part} className="chip bg-hero-soft text-hero-foreground">
                {part}
              </span>
            ))}
          </p>
        ) : null}
        <div className="mt-1 flex w-full flex-col gap-2 sm:max-w-xs">
          <Link
            href="/courses"
            className="inline-flex min-h-control-lg w-full items-center justify-center rounded-control bg-white px-6 text-body font-bold text-hero shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)] transition duration-150 hover:bg-hero-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {messages.completionContinue}
          </Link>
          <Link
            href="/progress"
            className="inline-flex min-h-control w-full items-center justify-center rounded-control px-5 font-semibold text-hero-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {messages.completionViewProgress}
          </Link>
        </div>
      </Card>
      <TodayQueue items={items} />
    </>
  );
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
  onUnauthenticated: (answerNotSaved?: boolean) => void;
}) {
  const messages = getMessages();
  const [items, setItems] = useState<DailyPlanItemDto[]>(plan.items);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyResolvedNotice, setAlreadyResolvedNotice] = useState(false);
  // Landing gate (UX-1): the question flow starts on an explicit CTA. Local
  // only — a reload shows the landing again, with "continue" wording.
  const [started, setStarted] = useState(false);
  // Set once the learner leaves Learn Mode via "exit", so the landing takes focus.
  const [exited, setExited] = useState(false);
  // An Answer/Skip request is in flight: Exit is disabled so a late result
  // can never land on the landing screen.
  const [pending, setPending] = useState(false);

  const total = items.length;
  const resolvedCount = items.filter((item) => item.status !== "pending").length;
  const { item: current, feedback: activeFeedback } = selectDisplayedItem(items, feedback);

  // Learn Mode (UX-2): only while a question is actually on screen.
  useLearnMode(started && current !== null);

  if (items.length === 0) {
    return (
      <StateBlock
        title={messages.today.emptyTitle}
        body={messages.today.emptyBody}
        action={
          <ButtonLink href="/courses" variant="secondary">
            {messages.today.emptyAction}
          </ButtonLink>
        }
      />
    );
  }

  if (current === null) {
    // The learner just finished (or exited on the last answered item) in this
    // session — move focus to the success state, not a removed control.
    return <TodayComplete items={items} focusOnMount={started || exited} />;
  }

  if (!started) {
    return (
      <TodayLanding
        plan={plan}
        items={items}
        focusOnMount={exited}
        onStart={() => setStarted(true)}
      />
    );
  }

  async function whilePending(request: Promise<void>) {
    setPending(true);
    try {
      await request;
    } finally {
      setPending(false);
    }
  }

  function exitLearnMode() {
    setFeedback(null);
    setSubmitError(null);
    setExited(true);
    setStarted(false);
  }

  async function handleAnswer(
    itemId: string,
    selectedAnswer: string | string[] | null,
    confidenceLevel: ConfidenceLevel | null,
  ) {
    setSubmitError(null);
    const result = await submitDailyPlanItemAnswer(itemId, {
      submissionId: generateSubmissionId(),
      selectedAnswer,
      confidenceLevel,
    });

    if (result.outcome === "UNAUTHENTICATED") {
      // The selection was NOT recorded — say so explicitly (Slice B gap (c)).
      onUnauthenticated(true);
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
    setFeedback({
      itemId,
      isCorrect: result.isCorrect,
      correctOptionIds: result.correctOptionIds,
      explanation: result.explanation,
    });
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

  // While feedback shows, the answered item is already counted as resolved.
  const position = Math.min(total, activeFeedback ? resolvedCount : resolvedCount + 1);

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Learn Mode context bar: minimal chrome (UX_SPEC §5 item 24). */}
      <LearnHeader
        title={messages.today.heading}
        position={interpolate(messages.today.questionPosition, { current: position, total })}
        action={
          <Button
            variant="tertiary"
            onClick={exitLearnMode}
            disabled={pending}
            className="-me-3 shrink-0"
          >
            <ExitIcon />
            {messages.today.exitLearn}
          </Button>
        }
      />
      <ProgressBar fraction={resolvedCount / total} segments={total} className="mb-6" />

      {alreadyResolvedNotice ? (
        <Notice tone="info" role="status" className="mb-4">
          {messages.today.alreadyResolvedError}
        </Notice>
      ) : null}

      <QuestionCard
        key={current.id}
        item={current}
        feedback={activeFeedback}
        submitError={submitError}
        onSubmit={(selectedAnswer, confidenceLevel) =>
          whilePending(handleAnswer(current.id, selectedAnswer, confidenceLevel))
        }
        onContinue={() => setFeedback(null)}
        onSkip={() => whilePending(handleSkip(current.id))}
        onSelectionChange={() => setSubmitError(null)}
      />
    </div>
  );
}

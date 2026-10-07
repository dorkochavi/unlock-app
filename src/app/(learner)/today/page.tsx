"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/button";
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
import { TodayComplete, TodayLanding } from "./today-home";
import { selectDisplayedItem, type AnswerFeedback } from "./select-displayed-item";
import { fetchTodayPlan, persistDetectedTimezone } from "./fetch-today-plan";
import type { DailyPlanDto, DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";
import type { TodayLearningRecap } from "@/application/dailyPlan/derive-learning-recap";
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

/** Loading skeleton shaped like the Today home (hero + one quiet line), announced once. */
function TodayLoading({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <Skeleton className="h-64 w-full rounded-surface md:h-52" />
        <Skeleton className="mt-4 h-5 w-2/3" />
      </div>
    </div>
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
  // Server-derived recap (present only once >= 1 item is completed). Refreshed
  // from the existing GET /today after the LAST resolution and when leaving
  // Learn Mode; a reload gets it straight from the initial GET.
  const [recap, setRecap] = useState<TodayLearningRecap | undefined>(plan.learningRecap);
  // Latest-wins guard: only the newest recap request may write the recap.
  const recapRequestRef = useRef(0);
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
    return <TodayComplete items={items} recap={recap} focusOnMount={started || exited} />;
  }

  if (!started) {
    return (
      <TodayLanding
        plan={plan}
        items={items}
        recap={recap}
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

  /** Re-read the recap via the existing GET /today (no new endpoint); latest request wins; failure clears it. */
  async function refreshRecap() {
    const request = ++recapRequestRef.current;
    const refreshed = await fetchTodayPlan();
    if (request !== recapRequestRef.current) return;
    // A failed/non-READY refresh clears the recap rather than leaving a stale one
    // beside newer item counts.
    setRecap(refreshed.outcome === "READY" ? refreshed.plan.learningRecap : undefined);
  }

  function exitLearnMode() {
    if (resolvedCount > 0) void refreshRecap();
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
        recapRequestRef.current += 1;
        setRecap(refreshed.plan.learningRecap);
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
    if (!items.some((item) => item.id !== itemId && item.status === "pending")) {
      void refreshRecap();
    }
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
        recapRequestRef.current += 1;
        setRecap(refreshed.plan.learningRecap);
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
    if (!items.some((item) => item.id !== itemId && item.status === "pending")) {
      void refreshRecap();
    }
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

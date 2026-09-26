"use client";

/**
 * Course / Topic Practice screen (Run UX-02 P4, docs/UX_SPEC.md §10).
 *
 * Learn Mode throughout; reuses Today's `QuestionCard`. No second
 * Question/answer engine: batches, eligibility, exclusions and grading are all
 * server-side (ADR-020, LEARNING_ENGINE §39A); this file owns presentation and
 * the current Practice RUN only (a continuous visit here — NOT the learning-day
 * session). Nothing is persisted client-side: a refresh starts a new run and
 * may clear the skipped-Question exclusions (accepted V1 behavior).
 *
 * Practice Skip is presentation-only: no request, no Attempt, no learning-state
 * change; the id is only added to the run's exclusion hint sent with "עוד 10".
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { LoadingState, StateBlock } from "@/components/state-block";
import { interpolate } from "@/lib/interpolate";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";

import { useLearnMode } from "../../../learn-mode";
import { persistDetectedTimezone } from "../../../today/fetch-today-plan";
import { QuestionCard } from "../../../today/question-card";
import {
  fetchPracticeBatch,
  parsePracticeFrom,
  parsePracticeTopicId,
  practiceOriginHref,
  practicePath,
  submitPracticeAnswer,
  type FetchPracticeBatchOutcome,
  type PracticeBatchDto,
  type PracticeFrom,
  type PracticeItemDto,
} from "./practice-api";

type Stage = "question" | "feedback" | "batchComplete" | "noMore";

interface RunState {
  scope: PracticeBatchDto["scope"];
  items: PracticeItemDto[];
  index: number;
  answered: number;
  skipped: number;
  hasMore: boolean;
  stage: Stage;
  isCorrect: boolean | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out"; answerNotSaved?: boolean }
  | { kind: "error" }
  | { kind: "unavailable" }
  | { kind: "ready"; run: RunState };

function viewFromResult(result: FetchPracticeBatchOutcome): ViewState {
  switch (result.outcome) {
    case "READY":
      return { kind: "ready", run: runFromBatch(result.batch) };
    case "UNAUTHENTICATED":
      return { kind: "signed-out" };
    case "UNAVAILABLE":
      return { kind: "unavailable" };
    default:
      return { kind: "error" };
  }
}

/**
 * Loads a batch; on the first-login-only TIMEZONE_NOT_SET the detected
 * timezone is persisted once and the batch retried once, exactly as Today.
 */
async function loadPracticeBatch(
  courseId: string,
  topicId: string | null,
  skipped: readonly string[],
): Promise<FetchPracticeBatchOutcome> {
  const first = await fetchPracticeBatch(courseId, topicId, skipped);
  if (first.outcome !== "TIMEZONE_NOT_SET") return first;
  if (!(await persistDetectedTimezone())) return { outcome: "ERROR" };
  const second = await fetchPracticeBatch(courseId, topicId, skipped);
  return second.outcome === "TIMEZONE_NOT_SET" ? { outcome: "ERROR" } : second;
}

function runFromBatch(batch: PracticeBatchDto): RunState {
  return {
    scope: batch.scope,
    items: batch.items,
    index: 0,
    answered: 0,
    skipped: 0,
    hasMore: batch.hasMore,
    stage: batch.items.length === 0 ? "noMore" : "question",
    isCorrect: null,
  };
}

export default function PracticePage() {
  return (
    <Suspense fallback={<LoadingState label={getMessages().practice.loading} />}>
      <PracticeScreen />
    </Suspense>
  );
}

function PracticeScreen() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId);
  const search = useSearchParams();
  const topicId = parsePracticeTopicId(search.get("topic"));
  const from = parsePracticeFrom(search.get("from"));
  const originHref = practiceOriginHref(courseId, from);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Skipped Question ids for THIS Practice run only (never persisted).
  const skippedIds = useRef<string[]>([]);

  // Learn Mode throughout the Practice screen (UX_SPEC §10).
  useLearnMode(true);

  // First statement of the async body is an `await` (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result = await loadPracticeBatch(courseId, topicId, skippedIds.current);
      if (cancelled) return;
      setState(viewFromResult(result));
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, topicId, reloadToken]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  function loadMore() {
    setNotice(false);
    setState({ kind: "loading" });
    setReloadToken((token) => token + 1);
  }

  const signInHref = buildSignInHref(practicePath(courseId, topicId, from));

  if (state.kind === "loading") {
    return <LoadingState label={messages.practice.loading} />;
  }
  if (state.kind === "signed-out") {
    return (
      <StateBlock
        title={
          state.answerNotSaved
            ? messages.today.answerNotSavedTitle
            : messages.practice.signedOutTitle
        }
        body={state.answerNotSaved ? messages.today.answerNotSavedBody : undefined}
        action={<ButtonLink href={signInHref}>{messages.practice.signedOutAction}</ButtonLink>}
      />
    );
  }
  if (state.kind === "error") {
    return (
      <StateBlock
        tone="error"
        title={messages.practice.genericErrorTitle}
        action={
          <div className="flex flex-col items-center gap-2">
            <Button variant="secondary" onClick={retry}>
              {messages.practice.retry}
            </Button>
            <ButtonLink href={originHref} variant="tertiary">
              {backLabel(from)}
            </ButtonLink>
          </div>
        }
      />
    );
  }
  if (state.kind === "unavailable") {
    return (
      <StateBlock
        title={messages.practice.unavailableTitle}
        body={messages.practice.unavailableBody}
        action={
          <ButtonLink href={originHref} variant="secondary">
            {backLabel(from)}
          </ButtonLink>
        }
      />
    );
  }

  const run = state.run;
  const current = run.items[run.index];
  const total = run.items.length;

  function update(patch: Partial<RunState>) {
    setState((previous) =>
      previous.kind === "ready" ? { kind: "ready", run: { ...previous.run, ...patch } } : previous,
    );
  }

  function advance(nextIndex: number, counts: { answered: number; skipped: number }) {
    update({
      ...counts,
      index: nextIndex,
      isCorrect: null,
      stage: nextIndex >= total ? "batchComplete" : "question",
    });
  }

  async function handleAnswer(selectedAnswer: string | string[] | null) {
    setSubmitError(null);
    setNotice(false);
    const result = await submitPracticeAnswer(courseId, {
      questionId: current.questionId,
      questionVersionId: current.questionVersionId,
      submissionId: crypto.randomUUID(),
      selectedAnswer,
      topicId,
    });
    switch (result.outcome) {
      case "ACCEPTED":
        update({ answered: run.answered + 1, stage: "feedback", isCorrect: result.isCorrect });
        return;
      case "UNAUTHENTICATED":
        // The selection was NOT recorded — say so explicitly (as on Today).
        setState({ kind: "signed-out", answerNotSaved: true });
        return;
      case "UNAVAILABLE":
        setState({ kind: "unavailable" });
        return;
      case "QUESTION_UNAVAILABLE":
        // Neutral: nothing recorded, move on without counting it.
        setNotice(true);
        advance(run.index + 1, { answered: run.answered, skipped: run.skipped });
        return;
      default:
        setSubmitError(messages.today.submitError);
    }
  }

  function handleSkip() {
    // Practice Skip: no request, no evidence; excluded for the rest of this run.
    setNotice(false);
    setSubmitError(null);
    if (!skippedIds.current.includes(current.questionId)) {
      skippedIds.current = [...skippedIds.current, current.questionId];
    }
    advance(run.index + 1, { answered: run.answered, skipped: run.skipped + 1 });
    return Promise.resolve();
  }

  function handleContinue() {
    advance(run.index + 1, { answered: run.answered, skipped: run.skipped });
  }

  const position =
    run.stage === "feedback" ? run.index + 1 : Math.min(total, run.index + 1);
  const scopeLabel =
    run.scope.kind === "TOPIC" ? messages.practice.scopeTopic : messages.practice.scopeCourse;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Learn Mode context bar: scope (Course or Topic) + progress, minimal chrome. */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-subtle">{scopeLabel}</p>
          <p className="break-words font-medium">{run.scope.title}</p>
          {run.stage === "question" || run.stage === "feedback" ? (
            <p className="text-sm text-muted">
              {interpolate(messages.today.questionPosition, { current: position, total })}
            </p>
          ) : null}
        </div>
        <ButtonLink href={originHref} variant="tertiary" className="-me-3 shrink-0">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          {messages.today.exitLearn}
        </ButtonLink>
      </div>
      <div aria-hidden="true" className="mb-8 h-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width:
              run.stage === "batchComplete"
                ? "100%"
                : `${total === 0 ? 0 : ((run.stage === "feedback" ? run.index + 1 : run.index) / total) * 100}%`,
          }}
        />
      </div>

      {notice ? (
        <p role="status" className="mb-4 text-sm text-muted">
          {messages.practice.questionUnavailable}
        </p>
      ) : null}

      {run.stage === "question" || run.stage === "feedback" ? (
        <QuestionCard
          key={current.questionId}
          item={current}
          feedback={
            run.stage === "feedback" && run.isCorrect !== null
              ? { itemId: current.questionId, isCorrect: run.isCorrect }
              : null
          }
          submitError={submitError}
          onSubmit={handleAnswer}
          onContinue={handleContinue}
          onSkip={handleSkip}
          onSelectionChange={() => setSubmitError(null)}
        />
      ) : null}

      {run.stage === "batchComplete" ? (
        <BatchComplete
          answered={run.answered}
          skipped={run.skipped}
          hasMore={run.hasMore}
          originHref={originHref}
          from={from}
          onMore={loadMore}
        />
      ) : null}

      {run.stage === "noMore" ? <NoMore originHref={originHref} from={from} /> : null}
    </div>
  );
}

function backLabel(from: PracticeFrom): string {
  const messages = getMessages().practice;
  return from === "progress" ? messages.backToProgress : messages.backToCourse;
}

/** Counts only — no correct count, score or percentage (UX_SPEC §10). */
function BatchComplete({
  answered,
  skipped,
  hasMore,
  originHref,
  from,
  onMore,
}: {
  answered: number;
  skipped: number;
  hasMore: boolean;
  originHref: string;
  from: PracticeFrom;
  onMore: () => void;
}) {
  const messages = getMessages();
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const summary = [
    answered === 1
      ? messages.today.completionAnsweredOne
      : answered > 1
        ? interpolate(messages.today.completionAnswered, { count: answered })
        : null,
    skipped > 0 ? interpolate(messages.today.completionSkipped, { count: skipped }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <div role="status">
        <p ref={titleRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          {messages.practice.batchCompleteTitle}
        </p>
      </div>
      {summary ? <p className="text-sm text-muted">{summary}</p> : null}
      <div className="mt-2 flex w-full flex-col gap-2">
        {hasMore ? (
          <Button fullWidth onClick={onMore}>
            {messages.practice.more}
          </Button>
        ) : null}
        <ButtonLink href={originHref} variant={hasMore ? "tertiary" : "secondary"} fullWidth>
          {backLabel(from)}
        </ButtonLink>
      </div>
    </Card>
  );
}

/** Honest, neutral end state — not styled as an error, no primary action. */
function NoMore({ originHref, from }: { originHref: string; from: PracticeFrom }) {
  const messages = getMessages().practice;
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <div role="status">
        <p ref={titleRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          {messages.noMoreTitle}
        </p>
        <p className="mt-2 text-muted">{messages.noMoreBody}</p>
      </div>
      <ButtonLink href={originHref} variant="secondary" fullWidth>
        {backLabel(from)}
      </ButtonLink>
    </Card>
  );
}

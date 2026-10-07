"use client";

/**
 * Presentational Today home states (landing before/while in progress, and the
 * completed state with its learning recap). Split out of `page.tsx` so they
 * can be rendered in isolation. No queue/checklist of questions lives on the
 * Today home (product decision, Run TODAY-LEARNING-RECAP-004).
 */
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Card } from "@/components/card";
import { ToneIcon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";
import {
  capTopics,
  confidenceInsight,
  hasRecapContent,
  orientationLine,
  recapOverview,
  soFarLine,
} from "./recap-presentation";
import type { DailyPlanDto, DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";
import type { TodayLearningRecap } from "@/application/dailyPlan/derive-learning-recap";

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

/** Quiet one-line note under the hero (orientation before starting, "so far" while in progress). */
function QuietLine({ children }: { children: string }) {
  return <p className="mt-4 px-1 text-secondary text-muted">{children}</p>;
}

function TopicList({ heading, names }: { heading: string; names: string[] }) {
  const { shown, moreLabel } = capTopics(names);
  return (
    <div className="mt-4">
      <p className="eyebrow">{heading}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map((name, index) => (
          <li
            key={`${index}-${name}`}
            className="max-w-full break-words rounded-xl bg-surface px-3 py-1 text-secondary font-semibold text-foreground"
          >
            {name}
          </li>
        ))}
        {moreLabel !== null ? (
          <li className="px-1 py-1 text-secondary text-muted">{moreLabel}</li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Done-state learning recap: a quiet panel derived server-side from today's own
 * answers (never persisted, never a mastery claim). Every block hides itself
 * when it has no content; the whole panel is omitted without any answers.
 */
function LearningRecapSurface({ recap }: { recap: TodayLearningRecap }) {
  const messages = getMessages().today.recap;
  const overview = recapOverview(recap);
  const insight = confidenceInsight(recap);
  const overviewLines = [overview.correctOfAnswered, overview.topicsWorked].filter(
    (line): line is string => line !== null,
  );

  return (
    <Card variant="quiet" className="mt-4 p-5 sm:p-6" aria-labelledby="today-recap-heading">
      <h2 id="today-recap-heading" className="text-body font-bold">
        {messages.title}
      </h2>
      {overviewLines.length > 0 ? (
        <p className="mt-1 text-secondary text-muted">{overviewLines.join(" · ")}</p>
      ) : null}
      {recap.strongTopics.length > 0 ? (
        <TopicList heading={messages.strongHeading} names={recap.strongTopics} />
      ) : null}
      {recap.revisitTopics.length > 0 ? (
        <TopicList heading={messages.revisitHeading} names={recap.revisitTopics} />
      ) : null}
      {insight !== null ? <p className="mt-4 text-secondary text-muted">{insight}</p> : null}
    </Card>
  );
}

/**
 * Today landing (Run UX-01 UX-1, docs/UX_SPEC.md §2 items 13–14): answers
 * "where am I / what do I do / how far / what's next" with one hero surface and
 * one primary CTA before the question flow. Uses only the plan's own data.
 */
export function TodayLanding({
  plan,
  items,
  recap,
  focusOnMount,
  onStart,
}: {
  plan: DailyPlanDto;
  items: DailyPlanItemDto[];
  recap: TodayLearningRecap | undefined;
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
  // One quiet line only: orientation before starting, "so far" once in progress.
  const quietLine = resolved === 0 ? orientationLine(items) : soFarLine(recap);
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
      {quietLine !== null ? <QuietLine>{quietLine}</QuietLine> : null}
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
export function TodayComplete({
  items,
  recap,
  focusOnMount,
}: {
  items: DailyPlanItemDto[];
  recap: TodayLearningRecap | undefined;
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
      {hasRecapContent(recap) ? <LearningRecapSurface recap={recap} /> : null}
    </>
  );
}


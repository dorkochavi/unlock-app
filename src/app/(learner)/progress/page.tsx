"use client";

/**
 * Learner Progress (Run 009 S2) — a simple, read-only, DESCRIPTIVE view of
 * the learner's own Courses. Composed from existing read models (see
 * `load-progress.ts`); no percentages, scores, readiness, streaks, ranking,
 * or Topic practice controls.
 *
 * Diagnosis → action (Run UX-01 UX-1, docs/UX_SPEC.md §1.5, §9): each Course
 * heading links to its existing Course page, and a SECONDARY navigation link
 * goes to Today — deliberately not a primary "continue learning" promise,
 * since Today may already be complete. No page-level primary learning action is
 * invented.
 *
 * UX-03-QA1 Findings 10/11 (product-owner Preview QA): with several
 * Courses/Topics this page became visually heavy — each Course used to
 * expand into its full `TopicList` inline. Topic-level detail now lives only
 * on the Course page (`CourseTopics`, which already renders the same
 * `TopicList`); this page stays Course-level and scannable, and each
 * Course's card shows only a real, evidence-only activity summary
 * (`summarizeCourseActivity`) — never a new mastery/percentage claim.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

import {
  loadProgress,
  summarizeCourseActivity,
  type CourseProgress,
  type ProgressLoadResult,
  type TopicProgressDto,
} from "./load-progress";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; courses: Extract<ProgressLoadResult, { outcome: "READY" }>["courses"] };

function CourseSection({
  id,
  title,
  progress,
}: {
  id: string;
  title: string;
  progress: CourseProgress;
}) {
  const messages = getMessages().progress;
  return (
    <Card>
      <h2 className="mb-1 break-words text-lg font-semibold">
        <Link
          href={`/courses/${id}`}
          className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {title}
        </Link>
      </h2>

      {progress.kind === "unavailable" ? (
        <p className="pt-2 text-sm text-muted">{messages.courseUnavailable}</p>
      ) : null}

      {progress.kind === "error" ? (
        <p className="pt-2 text-sm text-muted">{messages.courseError}</p>
      ) : null}

      {progress.kind === "ready" && progress.topics.length === 0 ? (
        <p className="pt-2 text-sm text-muted">{messages.courseNoTopics}</p>
      ) : null}

      {progress.kind === "ready" && progress.topics.length > 0 ? (
        <CourseActivitySummary topics={progress.topics} />
      ) : null}
    </Card>
  );
}

/**
 * UX-03-QA1 Finding 10: real activity, visible immediately; no mastery claim
 * (see `summarizeCourseActivity`'s own doc comment for why no aggregate
 * qualitative state is computed here). Topic-level detail lives on the
 * Course page, reached via this same Card's heading link above.
 */
function CourseActivitySummary({ topics }: { topics: TopicProgressDto[] }) {
  const messages = getMessages().progress;
  const summary = summarizeCourseActivity(topics);

  if (summary.attempted === 0) {
    return <p className="pt-2 text-sm text-muted">{messages.courseNotStartedYet}</p>;
  }

  return (
    <div className="pt-2">
      <p className="text-sm text-muted">
        {interpolate(messages.coverage, { attempted: summary.attempted, total: summary.total })}
      </p>
      {summary.topicsWithActivity > 1 ? (
        <p className="text-sm text-muted">
          {interpolate(messages.courseTopicsTouched, { count: summary.topicsWithActivity })}
        </p>
      ) : null}
      <p className="mt-1 text-sm font-medium text-foreground">{messages.courseActivityEncouragement}</p>
    </div>
  );
}

export default function LearnerProgressPage() {
  const messages = getMessages().progress;
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await loadProgress((url, init) => fetch(url, init));
      if (cancelled) return;
      if (result.outcome === "UNAUTHENTICATED") {
        setState({ kind: "signed-out" });
      } else if (result.outcome === "ERROR") {
        setState({ kind: "error" });
      } else {
        setState({ kind: "ready", courses: result.courses });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  return (
    <>
      <PageHeader title={messages.heading} subtitle={messages.subheading} />

      {state.kind === "loading" ? <LoadingState label={messages.loading} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.signedOutTitle}
          action={<ButtonLink href={buildSignInHref("/progress")}>{messages.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.genericErrorTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
            >
              {messages.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.courses.length === 0 ? (
        <StateBlock
          title={messages.emptyTitle}
          body={messages.emptyBody}
          action={
            <ButtonLink href="/today" variant="secondary">
              {messages.backToToday}
            </ButtonLink>
          }
        />
      ) : null}

      {state.kind === "ready" && state.courses.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            {state.courses.map((course) => (
              <CourseSection
                key={course.id}
                id={course.id}
                title={course.title}
                progress={course.progress}
              />
            ))}
          </div>
          <div className="mt-8">
            <ButtonLink href="/today" variant="secondary" fullWidth>
              {messages.goToToday}
            </ButtonLink>
          </div>
        </>
      ) : null}
    </>
  );
}

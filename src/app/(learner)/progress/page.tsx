"use client";

/**
 * Learner Progress (Run 009 S2) — a simple, read-only, DESCRIPTIVE view of
 * the learner's own Topic states, grouped by their active Courses. Composed
 * from existing read models (see `load-progress.ts`); no percentages, scores,
 * readiness, streaks, ranking, or Topic practice controls.
 *
 * Diagnosis → action (Run UX-01 UX-1, docs/UX_SPEC.md §1.5, §9): each Course
 * heading links to its existing Course page, and a SECONDARY navigation link
 * goes to Today — deliberately not a primary "continue learning" promise,
 * since Today may already be complete. No replacement primary learning action
 * is invented until Topic/Course Practice exists (UX-3). Topic rows stay
 * informational.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";

import { TopicList } from "../topic-list";
import { loadProgress, type CourseProgress, type ProgressLoadResult } from "./load-progress";

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
        <TopicList topics={progress.topics} />
      ) : null}
    </Card>
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
          <div className="flex flex-col gap-4">
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

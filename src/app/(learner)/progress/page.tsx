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
 *
 * QA2-B (product-owner Preview QA "Progress needs visual states, not
 * decoration"): the whole Course card is now one real navigation `Link`
 * (list semantics, no nested interactive controls — the card previously only
 * made its title text clickable) with visible hover/focus/pressed states.
 * The one visual accent this page adds is a left-border tone drawn from the
 * SAME already-computed attempted/not-attempted signal the text above already
 * shows (`summarizeCourseActivity`) — never a new derived mastery/qualitative
 * claim, just a visual echo of data already rendered.
 */
import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";

import { CourseSection } from "./course-section";
import { loadProgress, type ProgressLoadResult } from "./load-progress";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; courses: Extract<ProgressLoadResult, { outcome: "READY" }>["courses"] };

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
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            {state.courses.map((course) => (
              <CourseSection
                key={course.id}
                id={course.id}
                title={course.title}
                progress={course.progress}
              />
            ))}
          </ul>
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

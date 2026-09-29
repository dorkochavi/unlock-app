/**
 * The Progress page's per-Course card (Run 009 S2 / UX-03-QA1 Findings
 * 10/11). Split out of `page.tsx` because a Next.js `page.tsx` may only
 * export the framework's own reserved names (`default`, `metadata`, ...) —
 * any other named export fails Next's generated route-type check — and this
 * component needs to be independently importable for QA2-B's targeted markup
 * test.
 *
 * QA2-B (product-owner Preview QA "Progress needs visual states, not
 * decoration"): the whole Course card is one real navigation `Link` (list
 * semantics, no nested interactive controls — the card previously only made
 * its title text clickable) with visible hover/focus/pressed states. The one
 * visual accent this page adds is a left-border tone drawn from the SAME
 * already-computed attempted/not-attempted signal the text already shows
 * (`summarizeCourseActivity`) — never a new derived mastery/qualitative
 * claim, just a visual echo of data already rendered.
 */
import Link from "next/link";

import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

import { summarizeCourseActivity, type CourseProgress, type TopicProgressDto } from "./load-progress";

/**
 * The only per-Course visual state this page infers — reusing the exact
 * boolean the text summary already branches on (`summarizeCourseActivity` /
 * `courseNotStartedYet`), never a new aggregate mastery label. `unavailable`
 * / `error` / no-Topics cases get a transparent accent (RUN010-I: same
 * reserved 4px width, no color) — there is no real evidence to color-code
 * for them, but every card still aligns its content at an identical
 * x-offset (consistent card status-placement).
 */
export function courseCardAccentClass(progress: CourseProgress): string {
  if (progress.kind === "ready" && progress.topics.length > 0) {
    const hasActivity = progress.topics.some((topic) => topic.attemptedCount > 0);
    return hasActivity ? "border-l-4 border-l-state-progress" : "border-l-4 border-l-state-not-started";
  }
  return "border-l-4 border-l-transparent";
}

/**
 * The entire card is one real `Link` (no nested interactive controls —
 * `CourseActivitySummary` below is plain text). Hover uses the same
 * `bg-surface-muted` treatment as the Course page's Topic rows (visually
 * related, not copied) instead of a border-color hover, so it never fights
 * the left accent border above.
 *
 * RUN010-I: a shared `min-h-36` floor plus `flex flex-col` keeps every
 * card's padding and status-block starting position consistent regardless
 * of how much body text a given state renders (a one-line "not started"
 * card no longer looks visually orphaned next to a multi-line activity
 * summary card) — no new color/state, purely a layout floor.
 */
export function CourseSection({
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
    <li>
      <Link
        href={`/courses/${id}`}
        className={`flex min-h-36 flex-col rounded-xl border border-border bg-surface p-5 transition hover:bg-surface-muted active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${courseCardAccentClass(progress)}`}
      >
        <h2 className="mb-1 break-words text-lg font-semibold">{title}</h2>

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
      </Link>
    </li>
  );
}

/**
 * UX-03-QA1 Finding 10: real activity, visible immediately; no mastery claim
 * (see `summarizeCourseActivity`'s own doc comment for why no aggregate
 * qualitative state is computed here). Topic-level detail lives on the
 * Course page, reached via this same card's Link above.
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

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
 * visual accent this page adds is an inline-start (logical) border tone drawn from the SAME
 * already-computed attempted/not-attempted signal the text already shows
 * (`summarizeCourseActivity`) — never a new derived mastery/qualitative
 * claim, just a visual echo of data already rendered.
 */
import { LinkRow } from "@/components/link-row";
import { StatusPill } from "@/components/status-pill";
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
    return hasActivity ? "border-s-4 border-s-state-progress" : "border-s-4 border-s-state-not-started";
  }
  return "border-s-4 border-s-transparent";
}

/**
 * The entire card is one real `Link` (no nested interactive controls —
 * `CourseActivitySummary` below is plain text). Hover uses the same
 * `bg-surface-muted` treatment as the Course page's Topic rows (visually
 * related, not copied) instead of a border-color hover, so it never fights
 * the accent border above.
 *
 * VISUAL-SYSTEM-RUN-001 H: the card is the shared `LinkRow` (accent via the
 * logical `border-s-4`); a `min-h-24` floor keeps short states (one-line
 * unavailable/error/no-Topics) from looking orphaned next to activity cards.
 * The Course title stays an `h2` for heading navigation.
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
      <LinkRow
        href={`/courses/${id}`}
        accentClassName={courseCardAccentClass(progress)}
        className="min-h-24 items-start"
      >
        <h2 className="break-words text-section font-semibold">{title}</h2>

        {progress.kind === "unavailable" ? (
          <span className="mt-2 block text-secondary text-muted">{messages.courseUnavailable}</span>
        ) : null}

        {progress.kind === "error" ? (
          <span className="mt-2 block text-secondary text-muted">{messages.courseError}</span>
        ) : null}

        {progress.kind === "ready" && progress.topics.length === 0 ? (
          <span className="mt-2 block text-secondary text-muted">{messages.courseNoTopics}</span>
        ) : null}

        {progress.kind === "ready" && progress.topics.length > 0 ? (
          <CourseActivitySummary topics={progress.topics} />
        ) : null}
      </LinkRow>
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
    return (
      <span className="mt-2 flex">
        <StatusPill tone="neutral">{messages.courseNotStartedYet}</StatusPill>
      </span>
    );
  }

  return (
    <span className="mt-2 block">
      <span className="flex">
        <StatusPill tone="progress">{messages.courseActivityEncouragement}</StatusPill>
      </span>
      <span className="mt-2 block text-secondary text-muted">
        {interpolate(messages.coverage, { attempted: summary.attempted, total: summary.total })}
      </span>
      {summary.topicsWithActivity > 1 ? (
        <span className="block text-secondary text-muted">
          {interpolate(messages.courseTopicsTouched, { count: summary.topicsWithActivity })}
        </span>
      ) : null}
    </span>
  );
}

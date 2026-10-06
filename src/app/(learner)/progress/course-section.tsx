/**
 * The Progress page's per-Course card (Run 009 S2 / UX-03-QA1 Findings
 * 10/11). Split out of `page.tsx` because a Next.js `page.tsx` may only
 * export the framework's own reserved names (`default`, `metadata`, ...) —
 * any other named export fails Next's generated route-type check — and this
 * component needs to be independently importable for a targeted markup test.
 *
 * Soft Premium Canvas redesign (visual only): one raised card per Course. The
 * header is the ONE real navigation `Link` to the Course page (no nested
 * interactive controls anywhere in the card); below it the same informational
 * `TopicList` the Course page uses shows each Topic's state pill + coverage bar.
 * Every figure/label is already-loaded data (`summarizeCourseActivity`, Topic
 * counts/state) — no new mastery/percentage claim and no heavy accent border.
 */
import { Card } from "@/components/card";
import { Chevron, LinkRow } from "@/components/link-row";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

import { TopicList } from "../topic-list";
import { summarizeCourseActivity, type CourseProgress, type TopicProgressDto } from "./load-progress";

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
      <Card as="div" raised className="p-3 sm:p-4">
        <LinkRow variant="inline" href={`/courses/${id}`} showChevron={false} className="min-h-16 items-start">
          <span className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 break-words text-title font-bold leading-snug">{title}</h2>
            <Chevron className="mt-1 text-muted" />
          </span>

          {progress.kind === "unavailable" ? (
            <span className="mt-1 block text-secondary font-normal text-muted">{messages.courseUnavailable}</span>
          ) : null}

          {progress.kind === "error" ? (
            <span className="mt-1 block text-secondary font-normal text-muted">{messages.courseError}</span>
          ) : null}

          {progress.kind === "ready" && progress.topics.length === 0 ? (
            <span className="mt-1 block text-secondary font-normal text-muted">{messages.courseNoTopics}</span>
          ) : null}

          {progress.kind === "ready" && progress.topics.length > 0 ? (
            <CourseActivitySummary topics={progress.topics} />
          ) : null}
        </LinkRow>

        {progress.kind === "ready" && progress.topics.length > 0 ? (
          <CourseCoverageBar topics={progress.topics} />
        ) : null}

        {progress.kind === "ready" && progress.topics.length > 0 ? (
          <div className="mt-3 border-t border-border pt-1">
            <TopicList topics={progress.topics} />
          </div>
        ) : null}
      </Card>
    </li>
  );
}

/** Real activity only (no aggregate mastery label): status pill + count chips + one coverage bar. */
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
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusPill tone="progress">{messages.courseActivityEncouragement}</StatusPill>
        <span className="chip">
          {interpolate(messages.coverage, { attempted: summary.attempted, total: summary.total })}
        </span>
        {summary.topicsWithActivity > 1 ? (
          <span className="chip">
            {interpolate(messages.courseTopicsTouched, { count: summary.topicsWithActivity })}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Course-wide coverage bar (attempted / total from the same counts), full card width below the header link. */
function CourseCoverageBar({ topics }: { topics: TopicProgressDto[] }) {
  const summary = summarizeCourseActivity(topics);
  if (summary.attempted === 0 || summary.total === 0) return null;
  return <ProgressBar fraction={summary.attempted / summary.total} className="mb-0 mt-1 h-2" />;
}

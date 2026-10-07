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
  const hasTopics = progress.kind === "ready" && progress.topics.length > 0;
  return (
    <li>
      <Card as="div" raised className="p-4 sm:p-5">
        <LinkRow variant="inline" href={`/courses/${id}`} showChevron={false} className="min-h-14 items-start py-2">
          <span className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 break-words text-section font-bold leading-snug">{title}</h2>
            <Chevron className="mt-0.5 text-muted" />
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

        {progress.kind === "ready" && hasTopics ? <CourseCoverageBar topics={progress.topics} /> : null}

        {progress.kind === "ready" && hasTopics ? (
          <div className="mt-3">
            <TopicList topics={progress.topics} />
          </div>
        ) : null}
      </Card>
    </li>
  );
}

/** Real activity only (no aggregate mastery label): ONE quiet text line, merged from the same counts. */
function CourseActivitySummary({ topics }: { topics: TopicProgressDto[] }) {
  const messages = getMessages().progress;
  const summary = summarizeCourseActivity(topics);

  if (summary.attempted === 0) {
    return <span className="mt-1 block text-secondary font-normal text-muted">{messages.courseNotStartedYet}</span>;
  }

  const parts = [
    messages.courseActivityEncouragement,
    interpolate(messages.coverage, { attempted: summary.attempted, total: summary.total }),
    ...(summary.topicsWithActivity > 1
      ? [interpolate(messages.courseTopicsTouched, { count: summary.topicsWithActivity })]
      : []),
  ];
  return (
    <span className="mt-1 block text-secondary font-normal text-muted">
      {parts.map((part, index) => (
        <span key={part}>
          <span className="whitespace-nowrap">{part}</span>
          {index < parts.length - 1 ? <span aria-hidden="true">{" · "}</span> : null}
        </span>
      ))}
    </span>
  );
}

/** Course-wide coverage bar (attempted / total from the same counts) — the ONE bar at Course level. */
function CourseCoverageBar({ topics }: { topics: TopicProgressDto[] }) {
  const summary = summarizeCourseActivity(topics);
  if (summary.attempted === 0 || summary.total === 0) return null;
  return <ProgressBar fraction={summary.attempted / summary.total} className="mb-0 mt-2 h-1.5" />;
}

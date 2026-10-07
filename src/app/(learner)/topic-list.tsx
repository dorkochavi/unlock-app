/**
 * A Course's Topic rows with their qualitative learner state (Run 009 D2
 * vocabulary, docs/UX_SPEC.md §4) — shared by Progress and the Course page.
 *
 * Rows are informational by default. With `practice` (Run UX-02, UX_SPEC §10)
 * each Topic that has published Questions becomes ONE accessible link to Topic
 * Practice — name, coverage text, a quiet state label (dot + text, no per-Topic bar) and a quiet trailing "תרגול" in the primary
 * color; the caller passes `practice` only when the server says the Course is
 * practiceable. There is no separate Topic page.
 */
import { LinkRow } from "@/components/link-row";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

import type { LearnerTopicState, TopicProgressDto } from "./progress/load-progress";

const TONE_BY_STATE: Record<LearnerTopicState, StatusTone> = {
  SOLID: "solid",
  NEEDS_REINFORCEMENT: "reinforce",
  IN_PROGRESS: "progress",
  NOT_STARTED: "neutral",
};

export function TopicList({
  topics,
  practice,
}: {
  topics: TopicProgressDto[];
  /** Present only when Practice is available for this Course (server-decided). */
  practice?: { courseId: string; from: "course" | "progress" };
}) {
  const messages = getMessages().progress;
  return (
    <ul className="divide-y divide-border">
      {topics.map((topic) => {
        const practiceable = practice !== undefined && topic.totalCount > 0;
        const content = (
          <span className="block">
            <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <span className="min-w-0 basis-[55%] flex-1 break-words text-body font-semibold">{topic.name}</span>
              <StatusPill quiet tone={TONE_BY_STATE[topic.state]}>{messages.state[topic.state]}</StatusPill>
            </span>
            <span className="mt-0.5 block text-secondary font-normal text-muted">
              {interpolate(messages.coverage, {
                attempted: topic.attemptedCount,
                total: topic.totalCount,
              })}
            </span>
          </span>
        );
        return (
          <li key={topic.topicId}>
            {practiceable ? (
              <LinkRow
                variant="inline"
                href={`/courses/${practice.courseId}/practice?topic=${topic.topicId}&from=${practice.from}`}
                aria-label={interpolate(messages.practiceTopicLabel, {
                  name: topic.name,
                  state: messages.state[topic.state],
                })}
                trailing={<span className="text-meta font-semibold text-primary">{messages.practiceTopic}</span>}
              >
                {content}
              </LinkRow>
            ) : (
              <div className="-mx-2 min-h-14 px-2 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

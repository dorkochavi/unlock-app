/**
 * A Course's Topic rows with their qualitative learner state (Run 009 D2
 * vocabulary, docs/UX_SPEC.md §4) — shared by Progress and the Course page.
 *
 * Rows are informational by default. With `practice` (Run UX-02, UX_SPEC §10)
 * each Topic that has published Questions becomes ONE accessible link to Topic
 * Practice — name, coverage, state pill and a trailing "תרגול" in the primary
 * color; the caller passes `practice` only when the server says the Course is
 * practiceable. There is no separate Topic page.
 */
import Link from "next/link";

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
          <>
            <div className="min-w-0">
              <p className="break-words font-medium">{topic.name}</p>
              <p className="text-sm text-muted">
                {interpolate(messages.coverage, {
                  attempted: topic.attemptedCount,
                  total: topic.totalCount,
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill tone={TONE_BY_STATE[topic.state]}>
                {messages.state[topic.state]}
              </StatusPill>
              {practiceable ? (
                <span className="flex items-center gap-0.5 text-sm font-medium text-primary">
                  {messages.practiceTopic}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4 rtl:-scale-x-100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </span>
              ) : null}
            </div>
          </>
        );
        return (
          <li key={topic.topicId}>
            {practiceable ? (
              <Link
                href={`/courses/${practice.courseId}/practice?topic=${topic.topicId}&from=${practice.from}`}
                aria-label={interpolate(messages.practiceTopicLabel, {
                  name: topic.name,
                  state: messages.state[topic.state],
                })}
                className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-surface-muted active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start justify-between gap-3 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

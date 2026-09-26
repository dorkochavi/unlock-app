/**
 * A Course's Topic rows with their qualitative learner state (Run 009 D2
 * vocabulary, docs/UX_SPEC.md §4) — shared by Progress and the Course page.
 *
 * Rows are informational only: no per-Topic action exists yet (Topic
 * Practice is deferred, UX_SPEC §9), so rows are NOT links or buttons.
 */
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

export function TopicList({ topics }: { topics: TopicProgressDto[] }) {
  const messages = getMessages().progress;
  return (
    <ul className="divide-y divide-border">
      {topics.map((topic) => (
        <li key={topic.topicId} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="break-words font-medium">{topic.name}</p>
            <p className="text-sm text-muted">
              {interpolate(messages.coverage, {
                attempted: topic.attemptedCount,
                total: topic.totalCount,
              })}
            </p>
          </div>
          <StatusPill tone={TONE_BY_STATE[topic.state]}>{messages.state[topic.state]}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

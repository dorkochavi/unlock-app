/**
 * Qualitative learner Topic state pill (docs/UX_SPEC.md §4, §6 item 35):
 * green = SOLID, amber = NEEDS_REINFORCEMENT, primary = IN_PROGRESS,
 * gray = NOT_STARTED. Never red — red is reserved for real errors.
 */
import type { ReactNode } from "react";

export type StatusTone = "solid" | "reinforce" | "progress" | "neutral";

const TONES: Record<StatusTone, string> = {
  solid: "bg-state-solid-soft text-state-solid",
  reinforce: "bg-state-reinforce-soft text-state-reinforce",
  progress: "bg-state-progress-soft text-state-progress",
  neutral: "bg-state-not-started-soft text-state-not-started",
};

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-meta font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

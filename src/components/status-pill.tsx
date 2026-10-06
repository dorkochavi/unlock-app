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

/** Small leading dot (shape cue alongside the text label; text always remains). */
const DOT: Record<StatusTone, string> = {
  solid: "bg-state-solid",
  reinforce: "bg-state-reinforce",
  progress: "bg-state-progress",
  neutral: "bg-state-not-started",
};

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-meta font-semibold ${TONES[tone]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

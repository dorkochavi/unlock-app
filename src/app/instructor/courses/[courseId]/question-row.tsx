/**
 * A single row in the instructor Question Management list. Split out of
 * `page.tsx` (same reason as the learner-side `CourseRow`, QA2-B: a Next.js
 * `page.tsx` may only export the framework's own reserved names, and this
 * component needs to be independently importable for a small, targeted
 * markup test) and so this list can reuse an already-established shared
 * primitive instead of a hand-rolled boxed row.
 *
 * QA2-C (bounded visual polish only — no new list-scale infrastructure):
 * the previous per-row markup drew every row as its own bordered box
 * (`rounded-lg border border-border`) with the Draft/Published/
 * "published with draft changes" state rendered as plain gray text. That
 * made a long Question list read as flat, undifferentiated boxes with no
 * visual signal for which rows still need attention. This row now reuses
 * the exact shared `StatusPill` primitive the learner-side Topic list
 * already uses for qualitative state (`src/app/(learner)/topic-list.tsx`),
 * and the divider-row layout (`divide-y` on the parent `<ul>`, `-mx-2`
 * hover inset) that same surface already established, so the two parts of
 * the product read as one system. No selection/publish/edit BEHAVIOR
 * changed — only the visual treatment of state and row separation.
 */
import Link from "next/link";

import { StatusPill, type StatusTone } from "@/components/status-pill";

export type QuestionRowState = "DRAFT_ONLY" | "PUBLISHED" | "PUBLISHED_WITH_DRAFT_CHANGES";

const TONE_BY_QUESTION_STATE: Record<QuestionRowState, StatusTone> = {
  // Not yet visible to learners — same neutral gray the learner-side
  // NOT_STARTED Topic state uses.
  DRAFT_ONLY: "neutral",
  // Live for learners — same green the learner-side SOLID Topic state uses.
  PUBLISHED: "solid",
  // Live, but has unpublished edits an instructor may want to act on — same
  // amber the learner-side NEEDS_REINFORCEMENT Topic state uses for
  // "worth a look," never red (red stays reserved for real errors).
  PUBLISHED_WITH_DRAFT_CHANGES: "reinforce",
};

export function QuestionRow({
  displayPrompt,
  topicLabel,
  state,
  stateLabel,
  selectable,
  selected,
  onToggleSelected,
  selectAriaLabel,
  editHref,
  editLabel,
}: {
  displayPrompt: string;
  topicLabel: string;
  state: QuestionRowState;
  stateLabel: string;
  selectable: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  selectAriaLabel: string;
  editHref: string;
  editLabel: string;
}) {
  return (
    <li className="-mx-2 flex items-start gap-1 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-muted">
      {selectable ? (
        // Roomy 44px hit area around the 20px checkbox (the label forwards taps to it).
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={selectAriaLabel}
            className="size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </label>
      ) : null}
      <div className="min-w-0 flex-1 py-1.5 xl:flex xl:items-center xl:gap-6">
        <p className="line-clamp-2 break-words text-body font-medium xl:min-w-0 xl:flex-1" title={displayPrompt}>
          {displayPrompt}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 xl:mt-0 xl:w-60 xl:shrink-0 xl:flex-col xl:items-start xl:gap-1.5">
          <StatusPill tone={TONE_BY_QUESTION_STATE[state]}>{stateLabel}</StatusPill>
          <span className="chip max-w-full" title={topicLabel}>
            <span className="truncate">{topicLabel}</span>
          </span>
        </div>
      </div>
      <Link
        href={editHref}
        className="inline-flex min-h-control shrink-0 items-center rounded-full px-3 text-secondary font-semibold text-primary-soft-foreground underline-offset-4 hover:bg-primary-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {editLabel}
      </Link>
    </li>
  );
}

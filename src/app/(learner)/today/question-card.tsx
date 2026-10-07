"use client";

/**
 * Learn Mode question card for Today (Run UX-01 UX-2, docs/UX_SPEC.md §5).
 * Split out of `page.tsx`; presentation and interaction only — submission,
 * skip and plan state stay in `TodayPlanView`.
 *
 * State model: default → selected → submitted → feedback (item 25).
 * Feedback is inline (item 26). An incorrect answer is learning feedback,
 * not an error (items 27–28): neutral/reinforce surface, never the `danger`
 * token. A real failure (submit error) is the only red text here.
 *
 * UX-03-QA1 Finding 2/3: after submit, the response now carries
 * `correctOptionIds`/`explanation` (never before submit — see
 * `AnswerFeedback`'s own doc comment and the dedicated POST-submit-only
 * `AnswerFeedbackContentRepository` read path). This card marks every option
 * as selected-correct / selected-incorrect / missed-correct and shows the
 * canonical explanation when the QuestionVersion has one; it never invents
 * explanatory text.
 *
 * UX-03-QA1 Finding 4: options are shuffled ONCE per presentation (on mount,
 * via `useState`'s lazy initializer — never recomputed on re-render), so
 * position never teaches the correct answer. Grading/feedback always compare
 * by option id, never by position, so the shuffle changes nothing else.
 *
 * Accessibility (item 30): the prompt receives focus when the card mounts
 * (start / next question); after a submit, focus moves to "המשך" and the
 * feedback is announced from a persistent `role="status"` region.
 *
 * DESIGN-REFRESH-002 E: post-submit order is Question -> annotated options -> feedback/explanation ->
 * sticky Continue (options stay put). Feedback always renders in normal
 * document flow (never a floating/translucent overlay above the options) so
 * it cannot cover the answer choices; the Continue CTA is instead stabilized
 * independently via the sticky action bar below. Every state pairs color with
 * text/an icon (never color alone): selectedIncorrect uses the calm
 * `state-reinforce` (amber) tokens, not `danger`.
 *
 * RUN010-I (hosted-QA polish): both correct-answer option states
 * (selectedCorrect and missedCorrect) now share the same light
 * `state-solid-soft` green background plus a check icon, in addition to
 * their existing distinct text labels ("בחרת נכון" vs. "התשובה הנכונה") — a
 * missed-correct answer previously carried only a colored border with no
 * background tint or icon. The top-level correct `FeedbackBlock` banner
 * already had a light green background + check icon + "נכון!" label before
 * this Slice; unchanged here. Skip is now a locally-sized, self-centered
 * secondary touch target (not full-width), so Submit stays the one visually
 * dominant primary action on this screen (docs/UX_SPEC.md §1 item 8 / §11
 * item 3).
 *
 * RUN010-G / OQ-014: confidence capture. UNLOCK_V1_SCOPE.md's "Confidence
 * Gap" section requires V1 to capture confidence with answers and derive a
 * basic mismatch signal (high confidence + incorrect; low confidence +
 * correct) — "confidence is evidence, not truth". OQ-014 itself is still
 * OPEN on the full interaction model, but lists three candidate
 * representations and a constraint against false precision. This card uses
 * the smallest of the three: a binary "sure / not sure" toggle, shown only
 * pre-submit, never blocking Submit (optional-feeling, not a gate) — a
 * learner who does not tap either sends no confidence signal at all
 * (`confidenceLevel: null`), which is more honest than guessing a default on
 * their behalf ("confidence is evidence, not truth" cuts both ways: absence
 * of a signal must not be manufactured into one). The binary choice maps
 * onto the existing ternary `ConfidenceLevel` domain type (already wired
 * through persistence/misconception.ts) at its two extremes only — "בטוח"
 * (sure) -> "high", "לא בטוח" (not sure) -> "low" — which is exactly the
 * pair UNLOCK_V1_SCOPE.md's two named mismatch signals need; "medium"
 * remains a valid domain value simply not reachable from this input surface
 * yet. The exact learner-facing wording/placement is PROVISIONAL pending
 * product-owner confirmation (same flag pattern as OQ-018's labels).
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/button";
import { ToneIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { getMessages } from "@/messages";
import type { ConfidenceLevel } from "@/domain/learning/types";
import type { AnswerFeedback } from "./select-displayed-item";

/**
 * The shape the card needs. Today's `DailyPlanItemDto` and a Practice item
 * both satisfy it; `actionType` (Today's "why this question" label) is
 * optional — Practice has no such label.
 */
export interface QuestionCardItem {
  questionType: string;
  prompt: string;
  answerOptions: Array<{ id: string; content: string }>;
  actionType?: string;
}

/** Fisher–Yates — pure, does not mutate `options`. */
function shuffleOptions<T>(options: readonly T[]): T[] {
  const result = [...options];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type OptionFeedbackState = "selectedCorrect" | "selectedIncorrect" | "missedCorrect" | null;

/**
 * RUN010-G / OQ-014: the binary chip-to-domain-value mapping, named and
 * exported as the single source of truth so it is directly unit-testable
 * (this repo's Vitest env has no jsdom/click-interaction harness, so the
 * wiring itself cannot be exercised by firing a real click — see
 * `question-card.test.tsx`'s header). Both the "which value does this chip
 * toggle" and "is this chip currently selected" logic below read from these
 * same two constants, so a silent swap (which would silently invert
 * misconception.ts's escalation gate) can only happen by editing this one
 * clearly-named pair, not by two literals drifting independently.
 */
export const SURE_CONFIDENCE_LEVEL: ConfidenceLevel = "high";
export const UNSURE_CONFIDENCE_LEVEL: ConfidenceLevel = "low";

/** Exported for direct unit coverage (QA2-A) — pure, no component state involved. */
export function optionFeedbackState(
  optionId: string,
  selected: boolean,
  feedback: AnswerFeedback | null,
): OptionFeedbackState {
  if (feedback === null) return null;
  const isCorrectOption = feedback.correctOptionIds.includes(optionId);
  if (selected && isCorrectOption) return "selectedCorrect";
  if (selected && !isCorrectOption) return "selectedIncorrect";
  if (!selected && isCorrectOption) return "missedCorrect";
  return null;
}

export function QuestionCard({
  item,
  feedback,
  submitError,
  onSubmit,
  onContinue,
  onSkip,
  onSelectionChange,
}: {
  item: QuestionCardItem;
  feedback: AnswerFeedback | null;
  submitError: string | null;
  onSubmit: (
    selectedAnswer: string | string[] | null,
    confidenceLevel: ConfidenceLevel | null,
  ) => Promise<void>;
  onContinue: () => void;
  onSkip: () => Promise<void>;
  onSelectionChange: () => void;
}) {
  const messages = getMessages().today;
  const isMultiple = item.questionType === "MULTIPLE_CHOICE";
  // Finding 4: shuffled once, on mount, never recomputed for this
  // presentation — the parent always remounts this component (via a `key`
  // on the question id) for the next Question, so this naturally reshuffles
  // per presentation without reshuffling mid-question.
  const [shuffledOptions] = useState(() => shuffleOptions(item.answerOptions));
  const [selected, setSelected] = useState<string[]>([]);
  // RUN010-G / OQ-014: null until the learner explicitly taps a chip — never
  // defaulted, since an unexpressed confidence is not the same evidence as
  // an explicit low one.
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const busy = submitting || skipping;
  const locked = feedback !== null || busy;
  const promptRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // RUN010-E / OQ-018: honest, non-numeric per-item selection reason. Never
  // falls back to the raw internal `actionType` string (e.g. "NEW_LEARNING")
  // when no learner-facing label is mapped for it — an unmapped/unknown
  // actionType renders NO label rather than leaking an internal code,
  // matching OQ-018's "avoid exposing internal scores"/no-false-certainty
  // constraints. See messages/he.ts's `today.actionType` map for the
  // currently-mapped set (all 4 NBA action types + the ADR-017 New Material
  // fallback's "NEW_LEARNING").
  const actionLabel =
    item.actionType === undefined
      ? null
      : (messages.actionType[item.actionType as keyof typeof messages.actionType] ??
        null);

  useEffect(() => {
    promptRef.current?.focus();
  }, []);

  useEffect(() => {
    if (feedback === null) return;
    // On a long question the feedback can render off-screen (e.g. below a long
    // prompt): bring it into view, then move focus to "המשך" without scrolling
    // it away again.
    feedbackRef.current?.scrollIntoView({ block: "nearest" });
    continueRef.current?.focus({ preventScroll: true });
  }, [feedback]);

  function toggleOption(optionId: string) {
    if (locked) return;
    onSelectionChange();
    if (isMultiple) {
      setSelected((previous) =>
        previous.includes(optionId)
          ? previous.filter((id) => id !== optionId)
          : [...previous, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  }

  function toggleConfidence(level: ConfidenceLevel) {
    if (locked) return;
    setConfidence((previous) => (previous === level ? null : level));
  }

  async function handleSubmit() {
    if (selected.length === 0 || busy) return;
    setSubmitting(true);
    await onSubmit(isMultiple ? selected : (selected[0] ?? null), confidence);
    setSubmitting(false);
  }

  async function handleSkipClick() {
    if (busy) return;
    setSkipping(true);
    await onSkip();
    setSkipping(false);
  }

  return (
    <div>
      {actionLabel !== null ? (
        <p className="mb-3">
          <span className="chip bg-primary-soft text-primary-soft-foreground">{actionLabel}</span>
        </p>
      ) : null}
      <h2
        ref={promptRef}
        tabIndex={-1}
        className="mb-6 break-words text-[1.375rem] font-bold leading-[1.55] focus:outline-none sm:text-[1.5rem]"
      >
        {item.prompt}
      </h2>

      {isMultiple ? <p className="mb-3 text-secondary text-muted">{messages.multipleHint}</p> : null}

      {/* Options stay in place pre/post answer (no layout jump): post-submit the
          verdict + explanation render AFTER them, in normal flow (never an
          overlay), and the sticky action bar below keeps Continue in a stable
          place. */}
      <ul className="flex flex-col gap-3">
        {shuffledOptions.map((option, index) => {
          const isSelected = selected.includes(option.id);
          const optionState = optionFeedbackState(option.id, isSelected, feedback);
          return (
            <li key={option.id}>
              <QuestionOption
                content={option.content}
                multiple={isMultiple}
                selected={isSelected}
                locked={locked}
                dimmed={feedback !== null && optionState === null}
                state={optionState}
                marker={OPTION_MARKERS[index]}
                onToggle={() => toggleOption(option.id)}
              />
            </li>
          );
        })}
      </ul>

      {/* Persistent live region so the feedback is announced when it appears. */}
      <div ref={feedbackRef} role="status" className={feedback !== null ? "mt-5" : undefined}>
        {feedback !== null ? (
          <FeedbackBlock isCorrect={feedback.isCorrect} explanation={feedback.explanation} />
        ) : null}
      </div>

      {feedback === null ? (
        <div role="group" aria-label={messages.confidenceLabel} className="mt-5">
          <p className="mb-2 text-secondary font-medium text-muted">{messages.confidenceLabel}</p>
          <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-muted p-1">
            <ConfidenceChip
              label={messages.confidenceSure}
              selected={confidence === SURE_CONFIDENCE_LEVEL}
              disabled={locked}
              onClick={() => toggleConfidence(SURE_CONFIDENCE_LEVEL)}
            />
            <ConfidenceChip
              label={messages.confidenceUnsure}
              selected={confidence === UNSURE_CONFIDENCE_LEVEL}
              disabled={locked}
              onClick={() => toggleConfidence(UNSURE_CONFIDENCE_LEVEL)}
            />
          </div>
        </div>
      ) : null}

      {submitError ? (
        <Notice tone="error" role="alert" className="mt-4 font-medium">
          {submitError}
        </Notice>
      ) : null}

      {/* Mobile: the action bar sticks to the viewport bottom (the nav is hidden
          in Learn Mode), keeping the primary action in a stable place. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex items-center gap-3 border-t border-border bg-background/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {feedback === null ? (
          <>
            <Button
              size="lg"
              className="min-w-0 flex-1"
              onClick={handleSubmit}
              disabled={selected.length === 0 || busy}
            >
              {submitting ? messages.submitting : messages.submit}
            </Button>
            {/* RUN010-I: Skip is not an answer and must not compete with
                Submit — a quiet text button (44px target), never full-width. */}
            <Button variant="tertiary" className="shrink-0" onClick={handleSkipClick} disabled={busy}>
              {skipping ? messages.skipping : messages.skip}
            </Button>
          </>
        ) : (
          <Button ref={continueRef} size="lg" fullWidth onClick={onContinue}>
            {messages.continueAction}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Hebrew letter markers shown in each option's tile (presentational only, by display position). */
const OPTION_MARKERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];

const OPTION_STATE_STYLES: Record<
  Exclude<OptionFeedbackState, null>,
  { border: string; indicator: string }
> = {
  selectedCorrect: {
    border: "border-state-solid bg-state-solid-soft",
    indicator: "bg-state-solid text-primary-contrast",
  },
  selectedIncorrect: {
    border: "border-state-reinforce bg-state-reinforce-soft",
    indicator: "bg-state-reinforce text-primary-contrast",
  },
  missedCorrect: {
    // RUN010-I: correctness is never color-only; a missed-correct answer gets
    // the same positive treatment as selectedCorrect plus an icon + text label.
    border: "border-state-solid bg-state-solid-soft",
    indicator: "bg-state-solid text-primary-contrast",
  },
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Exported for direct unit coverage (QA2-A) — pure/presentational, no internal state. */
export function QuestionOption({
  content,
  multiple,
  selected,
  locked,
  dimmed,
  state,
  marker,
  onToggle,
}: {
  content: string;
  multiple: boolean;
  selected: boolean;
  locked: boolean;
  dimmed: boolean;
  /** UX-03-QA1 Finding 3: post-submit correctness state, or null pre-submit/not relevant. */
  state: OptionFeedbackState;
  /** Optional decorative letter shown in the tile while the option is neither selected nor annotated. */
  marker?: string;
  onToggle: () => void;
}) {
  const messages = getMessages().today;
  const stateStyles = state !== null ? OPTION_STATE_STYLES[state] : null;
  const stateLabel = state !== null ? messages.optionState[state] : null;
  const showCheck =
    state === "selectedCorrect" || state === "missedCorrect" || (state === null && selected);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      aria-pressed={selected}
      className={`flex min-h-14 w-full items-center gap-3 rounded-control border-2 px-4 py-3 text-start text-body font-medium leading-snug transition duration-150 enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default ${
        stateStyles !== null
          ? stateStyles.border
          : selected
            ? "border-primary bg-primary-soft ring-2 ring-primary"
            : "border-border bg-surface shadow-raised enabled:hover:border-primary-soft-border enabled:hover:bg-primary-soft"
      } ${dimmed ? "state-disabled" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center text-secondary font-bold ${
          multiple ? "rounded-lg" : "rounded-full"
        } ${
          stateStyles !== null
            ? stateStyles.indicator
            : selected
              ? "bg-primary text-primary-contrast"
              : "bg-surface-muted text-muted"
        }`}
      >
        {showCheck ? <CheckIcon /> : state === "selectedIncorrect" ? <XIcon /> : (marker ?? null)}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {content}
        {stateLabel !== null ? (
          <span
            className={`mt-0.5 block text-secondary font-bold ${
              state === "selectedIncorrect" ? "text-state-reinforce" : "text-state-solid"
            }`}
          >
            {stateLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * RUN010-G / OQ-014: pre-submit, optional confidence toggle. Presentational
 * only — a plain aria-pressed toggle button (one segment of a two-segment
 * control), not a radio group, since either segment (or neither) is a valid,
 * honest state (no forced choice).
 */
function ConfidenceChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`min-h-11 min-w-0 rounded-[0.75rem] px-3 text-secondary font-semibold transition duration-150 disabled:cursor-default ${
        selected
          ? "bg-surface text-primary-soft-foreground shadow-raised ring-2 ring-primary"
          : "text-muted enabled:hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FeedbackBlock({
  isCorrect,
  explanation,
}: {
  isCorrect: boolean;
  /** UX-03-QA1 Finding 2: canonical QuestionVersion explanation, or null when none exists. */
  explanation: string | null;
}) {
  const messages = getMessages().today;
  return (
    <div className="flex flex-col gap-3">
      {isCorrect ? (
        <div className="flex items-center gap-3 rounded-card bg-state-solid-soft p-4 text-state-solid">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-state-solid text-primary-contrast"
          >
            <ToneIcon tone="success" className="size-5" />
          </span>
          <p className="text-title font-extrabold">{messages.correct}</p>
        </div>
      ) : (
        /* Learning feedback, never an error: amber reinforce tokens + icon + text. */
        <div className="flex items-start gap-3 rounded-card bg-state-reinforce-soft p-4">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-state-reinforce text-primary-contrast"
          >
            <ToneIcon tone="info" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-title font-extrabold text-state-reinforce">{messages.incorrect}</p>
            <p className="mt-1 text-secondary text-foreground">{messages.incorrectBody}</p>
          </div>
        </div>
      )}
      {explanation !== null ? (
        <div className="rounded-card border border-primary-soft-border bg-primary-soft p-4">
          <p className="mb-1.5 text-secondary font-bold text-primary-soft-foreground">
            {messages.explanationHeading}
          </p>
          <p className="text-body leading-relaxed text-foreground">{explanation}</p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

/**
 * Learn Mode question card for Today (Run UX-01 UX-2, docs/UX_SPEC.md §5).
 * Split out of `page.tsx`; presentation and interaction only — submission,
 * skip and plan state stay in `TodayPlanView`.
 *
 * State model: default → selected → submitted → feedback (item 25).
 * Feedback is inline (item 26) and uses only what the answer response
 * carries (`isCorrect`); the correct option is never revealed because the
 * client is never told which it is. An incorrect answer is learning feedback,
 * not an error (items 27–28): neutral surface, no red. A real failure (submit
 * error) is the only red text here.
 *
 * Accessibility (item 30): the prompt receives focus when the card mounts
 * (start / next question); after a submit, focus moves to "המשך" and the
 * feedback is announced from a persistent `role="status"` region.
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/button";
import { getMessages } from "@/messages";
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
  onSubmit: (selectedAnswer: string | string[] | null) => Promise<void>;
  onContinue: () => void;
  onSkip: () => Promise<void>;
  onSelectionChange: () => void;
}) {
  const messages = getMessages().today;
  const isMultiple = item.questionType === "MULTIPLE_CHOICE";
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const busy = submitting || skipping;
  const locked = feedback !== null || busy;
  const promptRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const actionLabel =
    item.actionType === undefined
      ? null
      : (messages.actionType[item.actionType as keyof typeof messages.actionType] ??
        item.actionType);

  useEffect(() => {
    promptRef.current?.focus();
  }, []);

  useEffect(() => {
    if (feedback === null) return;
    // On a long question the feedback can render below the fold (behind the
    // sticky mobile action bar): bring it into view, then move focus to
    // "המשך" without scrolling it away again.
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

  async function handleSubmit() {
    if (selected.length === 0 || busy) return;
    setSubmitting(true);
    await onSubmit(isMultiple ? selected : (selected[0] ?? null));
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
      {actionLabel !== null ? <p className="mb-2 text-sm text-subtle">{actionLabel}</p> : null}
      <h2
        ref={promptRef}
        tabIndex={-1}
        className="mb-6 break-words text-xl font-semibold leading-relaxed focus:outline-none"
      >
        {item.prompt}
      </h2>

      {isMultiple ? <p className="mb-3 text-sm text-muted">{messages.multipleHint}</p> : null}

      <ul className="flex flex-col gap-3">
        {item.answerOptions.map((option) => (
          <li key={option.id}>
            <QuestionOption
              content={option.content}
              multiple={isMultiple}
              selected={selected.includes(option.id)}
              locked={locked}
              dimmed={feedback !== null && !selected.includes(option.id)}
              onToggle={() => toggleOption(option.id)}
            />
          </li>
        ))}
      </ul>

      {/* Persistent live region so the feedback is announced when it appears. */}
      {/* scroll-mb keeps it clear of the sticky mobile action bar. */}
      <div ref={feedbackRef} role="status" className="mt-6 scroll-mb-32 sm:scroll-mb-0">
        {feedback !== null ? <FeedbackBlock isCorrect={feedback.isCorrect} /> : null}
      </div>

      {submitError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {submitError}
        </p>
      ) : null}

      {/* Mobile: the action bar sticks to the viewport bottom (the nav is hidden
          in Learn Mode), keeping the primary action in a stable place. */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-1 border-t border-border bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {feedback === null ? (
          <>
            <Button fullWidth onClick={handleSubmit} disabled={selected.length === 0 || busy}>
              {submitting ? messages.submitting : messages.submit}
            </Button>
            {/* Skip is not an answer and must not compete with Submit. */}
            <Button variant="tertiary" fullWidth onClick={handleSkipClick} disabled={busy}>
              {skipping ? messages.skipping : messages.skip}
            </Button>
          </>
        ) : (
          <Button ref={continueRef} fullWidth onClick={onContinue}>
            {messages.continueAction}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionOption({
  content,
  multiple,
  selected,
  locked,
  dimmed,
  onToggle,
}: {
  content: string;
  multiple: boolean;
  selected: boolean;
  locked: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      aria-pressed={selected}
      className={`flex min-h-12 w-full items-start gap-3 rounded-xl border px-4 py-3 text-start text-base leading-relaxed transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default ${
        selected
          ? "border-primary bg-primary-soft"
          : "border-border bg-surface enabled:hover:border-border-strong"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1 flex size-5 shrink-0 items-center justify-center border-2 ${
          multiple ? "rounded-md" : "rounded-full"
        } ${selected ? "border-primary bg-primary text-primary-contrast" : "border-border-strong"}`}
      >
        {selected ? (
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 break-words">{content}</span>
    </button>
  );
}

function FeedbackBlock({ isCorrect }: { isCorrect: boolean }) {
  const messages = getMessages().today;
  if (isCorrect) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-state-solid-soft p-4 text-state-solid">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
        <p className="font-semibold">{messages.correct}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <p className="font-semibold">{messages.incorrect}</p>
      <p className="mt-1 text-sm text-muted">{messages.incorrectBody}</p>
    </div>
  );
}

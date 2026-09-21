/**
 * UNLOCK Structured Import V1 — Run 007 S1. The canonical, format-independent
 * row model every source adapter (JSON, CSV — `src/application/import/adapters/`)
 * normalizes external input into, on top of the existing Question/Answer
 * model (`src/domain/learning/answer.ts`, ADR-014) reused unchanged.
 *
 * `docs/CHATGPT_PLAN.md` §4/§8 draws a deliberate line this module respects:
 * an adapter's own parse-level malformation (bad JSON, missing CSV columns,
 * an option key that doesn't parse as a string, a `correctOptions` entry
 * referencing an option key that was never defined) is THAT adapter's
 * problem, kept out of this file. This file only defines the SHAPE a
 * successfully-parsed row has — Run 007 S2 owns row-CONTENT validation
 * (empty prompt, minimum option count, per-type correct-answer cardinality,
 * real Topic existence) against that shape. Neither adapter constructs a
 * `CanonicalQuestionRow` unless every field below is already well-typed.
 *
 * `topicName` is intentionally a Topic NAME, not an internal `topicId`
 * (`docs/CHATGPT_PLAN.md` §4: "External files never know `topicId`") —
 * resolving it against the target Course's real, active Topics is S2's job,
 * once a DB read is available; this file has no DB dependency.
 *
 * Each option's `id` is the external `key` (e.g. `"A"`), already
 * trimmed/uppercased by the adapter — `AnswerOption.id` only needs to be
 * stable WITHIN one QuestionVersion (`answer.ts`'s own doc comment), so
 * reusing the external key directly avoids inventing a second internal id
 * space import doesn't need.
 */
import { QUESTION_TYPES, type AnswerOption, type QuestionType } from "../learning/answer";

export { QUESTION_TYPES };
export type { AnswerOption, QuestionType };

export interface CanonicalQuestionRow {
  /** 1-based position of this row in its source (JSON array index + 1, CSV data-row number) — for user-facing error reporting only, never persisted. */
  sourceRowNumber: number;
  topicName: string;
  questionType: QuestionType;
  prompt: string;
  answerOptions: AnswerOption[];
  correctOptionIds: string[];
  explanation: string | null;
}

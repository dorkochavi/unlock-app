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
import {
  assertValidQuestionAnswerDefinition,
  InvalidQuestionAnswerDefinitionError,
  QUESTION_TYPES,
  type AnswerOption,
  type QuestionType,
} from "../learning/answer";
import { MIN_PUBLISHABLE_OPTION_COUNT } from "../question/types";

export { QUESTION_TYPES, MIN_PUBLISHABLE_OPTION_COUNT };
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

/**
 * Run 007 S2 — the row-CONTENT validation this file's own module doc
 * comment reserved for S2 (empty prompt, minimum option count, per-type
 * correct-answer cardinality). Reuses `assertValidQuestionAnswerDefinition`
 * (Run 006, `src/domain/learning/answer.ts`) and `MIN_PUBLISHABLE_OPTION_COUNT`
 * (Run 006, `src/domain/question/types.ts`) rather than duplicating either
 * business rule — the Plan's own instruction ("reuse existing Question
 * domain invariants wherever possible").
 *
 * Every S1 adapter already guarantees, by construction, that a
 * `CanonicalQuestionRow` has: at least one option, no duplicate option id,
 * no duplicate/unknown entry in `correctOptionIds`, and at least one
 * correct-option reference (see `adapter-types.ts`'s own doc comment for
 * why that last one is a deliberate parse-level check, not deferred here).
 * What S1 does NOT and cannot check without this domain-level rule: the
 * per-TYPE cardinality (`SINGLE_CHOICE` exactly one correct option,
 * `MULTIPLE_CHOICE` at least one — S1 only enforces "at least one" for
 * both), a non-empty prompt, the meaningful-option-count minimum, and
 * non-empty option content. Collects every violated invariant for this ONE
 * row (does not throw on the first) — matching how every S1 adapter already
 * reports one row's problems, and giving preview an actionable list rather
 * than only the first thing wrong with a row.
 */
export function validateCanonicalQuestionRowContent(
  content: Pick<
    CanonicalQuestionRow,
    "questionType" | "prompt" | "answerOptions" | "correctOptionIds"
  >,
): string[] {
  const errors: string[] = [];

  if (content.prompt.trim().length === 0) {
    errors.push("prompt must not be empty");
  }

  if (content.answerOptions.length < MIN_PUBLISHABLE_OPTION_COUNT) {
    errors.push(`at least ${MIN_PUBLISHABLE_OPTION_COUNT} options are required`);
  }
  for (const option of content.answerOptions) {
    if (option.content.trim().length === 0) {
      errors.push(`option "${option.id}" must not be empty`);
    }
  }

  try {
    assertValidQuestionAnswerDefinition({
      questionType: content.questionType,
      options: content.answerOptions,
      correctOptionIds: content.correctOptionIds,
    });
  } catch (error) {
    if (error instanceof InvalidQuestionAnswerDefinitionError) {
      // Reuses the SAME per-type-cardinality/duplicate/unknown-reference
      // invariants `assertQuestionPublishReady` (Run 006) reuses for manual
      // authoring — one grading vocabulary, not a second one for import.
      errors.push(error.message);
    } else {
      throw error;
    }
  }

  return errors;
}

/** Minimal Topic shape `resolveTopicByName` needs — deliberately structural, not the full application-layer `Topic` type, so this file stays free of any persistence-port dependency. */
export interface NamedTopicRef {
  id: string;
  name: string;
}

export type TopicNameResolution =
  | { outcome: "RESOLVED"; topicId: string }
  | { outcome: "NOT_FOUND" }
  | { outcome: "AMBIGUOUS" };

function normalizeTopicName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Groups Topics by normalized (trimmed, case-insensitive) name once, so
 * resolving many rows against the same Course's Topic list is O(topics) up
 * front instead of O(rows × topics). Callers pass only the Course's ACTIVE
 * Topics (e.g. `TopicRepository.listActiveForCourse`) — this function has
 * no notion of "archived," it simply resolves against whatever list it is
 * given, matching `docs/CHATGPT_PLAN.md` §3's "archived Topics are not
 * eligible matches" via the caller's own selection, not a flag here.
 */
export function buildTopicNameIndex(
  topics: readonly NamedTopicRef[],
): Map<string, NamedTopicRef[]> {
  const index = new Map<string, NamedTopicRef[]>();

  for (const topic of topics) {
    const key = normalizeTopicName(topic.name);
    const matches = index.get(key) ?? [];
    matches.push(topic);
    index.set(key, matches);
  }

  return index;
}

/**
 * Resolves one row's external `topicName` against an index built by
 * `buildTopicNameIndex`. Exactly one normalized match → `RESOLVED`; zero →
 * `NOT_FOUND`; more than one distinct active Topic normalizing to the same
 * name → `AMBIGUOUS`, never chosen arbitrarily (`docs/CHATGPT_PLAN.md` §3).
 */
export function resolveTopicByName(
  topicName: string,
  index: ReadonlyMap<string, NamedTopicRef[]>,
): TopicNameResolution {
  const matches = index.get(normalizeTopicName(topicName)) ?? [];

  if (matches.length === 0) {
    return { outcome: "NOT_FOUND" };
  }
  if (matches.length > 1) {
    return { outcome: "AMBIGUOUS" };
  }
  return { outcome: "RESOLVED", topicId: matches[0].id };
}

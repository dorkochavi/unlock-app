/**
 * UNLOCK Question/Answer Model V1 — ADR-014.
 *
 * The durable contract for a QuestionVersion's answer content, and the pure,
 * deterministic correctness computation over it. This is the ONLY place in
 * the codebase that decides what "correct" means — `PostgresAnswerCorrectnessChecker`
 * (`src/infrastructure/postgres/answer-correctness-checker.ts`) is a thin
 * adapter that loads+validates a persisted definition and delegates here; no
 * correctness logic lives in SQL or is duplicated between layers.
 *
 * V1 supports exactly two question types — SINGLE_CHOICE and
 * MULTIPLE_CHOICE. TRUE_FALSE is deliberately NOT a distinct type: a
 * true/false question is a SINGLE_CHOICE question with exactly two options
 * (conventionally "True"/"False") — representing it as its own type would
 * duplicate every SINGLE_CHOICE rule (exactly one correct option, scalar
 * selectedAnswer, exact-identity comparison) for zero semantic gain. Free
 * text, essay, numeric-tolerance, ordering, matching, and fill-in-the-blank
 * are out of scope for V1 — no committed doc or code requires them yet
 * (`docs/MASTER_SPEC.md` §8: "the initial core question type is multiple
 * choice," described there as one-correct-answer-among-options, i.e. what
 * this file calls SINGLE_CHOICE). MULTIPLE_CHOICE (more than one correct
 * option, learner selects a set) is added because it is a near-zero-cost
 * generalization of the same option/correctness model, not a new subsystem.
 */

export const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * One answer option. `id` is a stable identity WITHIN one QuestionVersion
 * only — it has no meaning across versions (a new QuestionVersion may reuse,
 * change, or drop any option id; see the "immutability implications" note
 * below). `content` is the option's display text.
 */
export interface AnswerOption {
  id: string;
  content: string;
}

/**
 * The durable V1 answer-content contract for one QuestionVersion (ADR-014).
 *
 * Immutability implications (QuestionVersion is immutable, ADR-009): once a
 * QuestionVersion is created, its `options` (identity, content, AND order —
 * order is the frozen, meaningful display order) and `correctOptionIds`
 * never change. Editing a Question's options, correct answer, or question
 * type — even a single option's `content` string — always creates a NEW
 * QuestionVersion; there is no in-place edit of this shape anywhere in this
 * codebase.
 *
 * `correctOptionIds` is deliberately ONE shape for BOTH question types
 * (always an array, order-irrelevant / set semantics) rather than a scalar
 * for SINGLE_CHOICE and an array for MULTIPLE_CHOICE — one canonical shape
 * with a per-type cardinality rule (SINGLE_CHOICE: exactly 1;
 * MULTIPLE_CHOICE: at least 1) is simpler than branching the persisted
 * shape itself on `questionType`. A question with ALL options marked
 * correct is structurally ALLOWED (no rule forbids it) — disallowing it
 * would be an arbitrary content-authoring restriction with no basis in any
 * current product decision. A question with ZERO correct options is NOT
 * allowed for either type — see `assertValidQuestionAnswerDefinition`.
 */
export interface QuestionAnswerDefinition {
  questionType: QuestionType;
  options: AnswerOption[];
  correctOptionIds: string[];
}

/**
 * A learner's submitted answer, referencing option ids from the
 * QuestionVersion being answered:
 * - `string` — one selected option id (SINGLE_CHOICE).
 * - `string[]` — a set of selected option ids (MULTIPLE_CHOICE). Order is
 *   NOT semantically meaningful — `canonicalizeSelectedAnswer` normalizes
 *   it (sorted ascending) so `["a","b"]` and `["b","a"]` are treated, and
 *   PERSISTED, identically. Must not contain duplicates (rejected, not
 *   silently deduplicated — see `canonicalizeSelectedAnswer`).
 * - `null` — no answer was structurally identifiable. There is no
 *   currently-modeled "the learner explicitly skipped this Question via a
 *   null Attempt" flow (skip is tracked on `TodaySessionItem.status`, not
 *   via a null-selectedAnswer Attempt — `docs/DATABASE.md`), so `null`
 *   reaching `evaluateAnswerCorrectness` is treated as a structurally
 *   invalid submission (`InvalidSelectedAnswerError`), never as "wrong."
 *   The type remains nullable for backward compatibility with `Attempt`'s
 *   pre-existing shape and to avoid overclaiming a product decision this
 *   file is not authorized to make (`docs/OPEN_QUESTIONS.md` does not
 *   settle skip semantics).
 */
export type SelectedAnswer = string | string[] | null;

/**
 * Thrown for a structurally malformed PERSISTED `QuestionAnswerDefinition`
 * — a data-corruption / infrastructure error, never a student-facing
 * "incorrect answer". Callers must NOT catch this the way they catch
 * `InvalidSelectedAnswerError`; it should propagate as a genuine unexpected
 * error (see `submit-answer.ts`'s error handling, which deliberately does
 * NOT have a catch clause for this type).
 */
export class InvalidQuestionAnswerDefinitionError extends Error {
  constructor(message: string) {
    super(`Invalid persisted QuestionAnswerDefinition: ${message}`);
    this.name = "InvalidQuestionAnswerDefinitionError";
  }
}

/**
 * Thrown for a structurally malformed CLIENT-submitted `SelectedAnswer` —
 * wrong shape for the question's type, an unknown option id, duplicate
 * option ids, or `null`/empty when a real selection is required. This is a
 * request-validation error, not "the answer was wrong": `submit-answer.ts`
 * catches it explicitly and maps it to its own `SubmitAnswerResult` kind
 * (`INVALID_SELECTED_ANSWER`), never to `isCorrect: false`.
 */
export class InvalidSelectedAnswerError extends Error {
  constructor(message: string) {
    super(`Invalid selected answer: ${message}`);
    this.name = "InvalidSelectedAnswerError";
  }
}

/**
 * Validates a PERSISTED `QuestionAnswerDefinition`'s own structural
 * integrity — called by the infrastructure mapper after parsing raw JSON,
 * BEFORE the definition is trusted by `evaluateAnswerCorrectness` or
 * anything else. Throws `InvalidQuestionAnswerDefinitionError` (never
 * silently repairs or guesses a fix) on:
 * - an empty `options` array;
 * - a duplicate option id;
 * - a `correctOptionIds` entry that does not reference a real option id;
 * - a duplicate entry within `correctOptionIds`;
 * - SINGLE_CHOICE with a `correctOptionIds` length other than exactly 1;
 * - MULTIPLE_CHOICE with an empty `correctOptionIds`.
 *
 * `questionType` itself is validated one layer further out (the
 * infrastructure mapper reads the DB's `question_type` CHECK-constrained
 * column via a closed-enum reader) — by the time a `QuestionAnswerDefinition`
 * reaches this function, `questionType` is already known to be one of
 * `QUESTION_TYPES` at the type level.
 */
export function assertValidQuestionAnswerDefinition(
  definition: QuestionAnswerDefinition,
): void {
  if (definition.options.length === 0) {
    throw new InvalidQuestionAnswerDefinitionError("options must be non-empty");
  }

  const optionIds = new Set<string>();
  for (const option of definition.options) {
    if (optionIds.has(option.id)) {
      throw new InvalidQuestionAnswerDefinitionError(
        `duplicate option id "${option.id}"`,
      );
    }
    optionIds.add(option.id);
  }

  const correctIdsSeen = new Set<string>();
  for (const id of definition.correctOptionIds) {
    if (correctIdsSeen.has(id)) {
      throw new InvalidQuestionAnswerDefinitionError(
        `duplicate entry "${id}" in correctOptionIds`,
      );
    }
    if (!optionIds.has(id)) {
      throw new InvalidQuestionAnswerDefinitionError(
        `correctOptionIds references unknown option id "${id}"`,
      );
    }
    correctIdsSeen.add(id);
  }

  if (
    definition.questionType === "SINGLE_CHOICE" &&
    definition.correctOptionIds.length !== 1
  ) {
    throw new InvalidQuestionAnswerDefinitionError(
      `SINGLE_CHOICE requires exactly one correct option, got ${definition.correctOptionIds.length}`,
    );
  }
  if (
    definition.questionType === "MULTIPLE_CHOICE" &&
    definition.correctOptionIds.length < 1
  ) {
    throw new InvalidQuestionAnswerDefinitionError(
      "MULTIPLE_CHOICE requires at least one correct option, got 0",
    );
  }
}

/**
 * Pure syntactic normalization of a `SelectedAnswer` — independent of any
 * `QuestionAnswerDefinition` (it does not need to know the question's real
 * type). For an array, returns a NEW ascending-sorted copy (never mutates
 * the input) so `["a","b"]` and `["b","a"]` become identical values for
 * every downstream comparison (idempotency-conflict detection, persistence,
 * correctness evaluation) — one normalization point instead of teaching
 * every comparison site to be array-aware. Scalars and `null` pass through
 * unchanged (nothing to normalize).
 *
 * Throws `InvalidSelectedAnswerError` if the array contains a duplicate id
 * — duplicates are REJECTED, never silently deduplicated: a duplicate is
 * far more likely a client bug (e.g. a checkbox double-fired) than a
 * genuine "I meant to pick this twice" intent, and this codebase's
 * established discipline is to fail loudly on ambiguous input rather than
 * guess (see `docs/DECISIONS/010-answer-submission-transaction-model.md`'s
 * own idempotency-conflict design for the same philosophy applied
 * elsewhere).
 *
 * Hostile-review finding: also throws `InvalidSelectedAnswerError` (rather
 * than crashing with an unrelated raw `TypeError`) for any non-array,
 * non-string, non-null value, and for a non-string array ELEMENT. The
 * `SelectedAnswer` parameter type already rules these out for any
 * type-checked caller, but this function is a public export that a future
 * API boundary will call on data straight from `JSON.parse` (`unknown`,
 * before real DTO validation exists — see `docs/API_V1_DRAFT.md`) — a
 * defensive runtime check here costs nothing and turns "the process
 * crashes on `value[Symbol.iterator] is not a function`" into the same
 * clean, typed rejection every other malformed-input case already gets.
 */
export function canonicalizeSelectedAnswer(value: SelectedAnswer): SelectedAnswer {
  if (value === null || typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    throw new InvalidSelectedAnswerError(
      `expected a string, an array of strings, or null, got ${JSON.stringify(value)}`,
    );
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string") {
      throw new InvalidSelectedAnswerError(
        `expected every array element to be a string option id, got ${JSON.stringify(id)}`,
      );
    }
    if (seen.has(id)) {
      throw new InvalidSelectedAnswerError(`duplicate selected option id "${id}"`);
    }
    seen.add(id);
  }
  return [...value].sort();
}

/**
 * The single source of truth for "is this SelectedAnswer correct for this
 * QuestionAnswerDefinition" — pure, deterministic, no DB/network/clock.
 * Depends ONLY on its two arguments: correctness of a historical Attempt
 * can always be recomputed from nothing but its exact frozen QuestionVersion
 * and the Attempt's own `selectedAnswer` (Phase 2 item K/L) — there is no
 * hidden global state (current_version_id, "today's" content, etc.) this
 * function reads.
 *
 * Always canonicalizes `rawSelectedAnswer` itself (does not trust a caller
 * to have already done so) — safe/idempotent to call on an
 * already-canonical value.
 *
 * Throws `InvalidSelectedAnswerError` (never returns `false` for these
 * cases — a malformed submission is not the same fact as "the learner
 * chose wrong") when:
 * - SINGLE_CHOICE and the (canonicalized) selected value is not a string;
 * - SINGLE_CHOICE and the selected option id does not exist among
 *   `definition.options`;
 * - MULTIPLE_CHOICE and the (canonicalized) selected value is not a
 *   non-empty array (this also covers `null` and `[]` uniformly — both
 *   fail the "is a non-empty array" check without needing a separate
 *   null-check);
 * - MULTIPLE_CHOICE and any selected option id does not exist among
 *   `definition.options`.
 *
 * Assumes `definition` has already passed
 * `assertValidQuestionAnswerDefinition` — this function does not re-audit
 * the definition itself (that is the infrastructure mapper's
 * responsibility, once, at load time, not on every correctness check).
 */
export function evaluateAnswerCorrectness(
  definition: QuestionAnswerDefinition,
  rawSelectedAnswer: SelectedAnswer,
): boolean {
  const selected = canonicalizeSelectedAnswer(rawSelectedAnswer);
  const optionIds = new Set(definition.options.map((option) => option.id));

  if (definition.questionType === "SINGLE_CHOICE") {
    if (typeof selected !== "string") {
      throw new InvalidSelectedAnswerError(
        `SINGLE_CHOICE requires a single option id, got ${JSON.stringify(selected)}`,
      );
    }
    if (!optionIds.has(selected)) {
      throw new InvalidSelectedAnswerError(
        `selected option id "${selected}" does not exist on this QuestionVersion`,
      );
    }
    return definition.correctOptionIds.includes(selected);
  }

  // MULTIPLE_CHOICE
  if (!Array.isArray(selected) || selected.length === 0) {
    throw new InvalidSelectedAnswerError(
      `MULTIPLE_CHOICE requires a non-empty array of option ids, got ${JSON.stringify(selected)}`,
    );
  }
  for (const id of selected) {
    if (!optionIds.has(id)) {
      throw new InvalidSelectedAnswerError(
        `selected option id "${id}" does not exist on this QuestionVersion`,
      );
    }
  }

  const correctSorted = [...definition.correctOptionIds].sort();
  return (
    selected.length === correctSorted.length &&
    selected.every((id, index) => id === correctSorted[index])
  );
}

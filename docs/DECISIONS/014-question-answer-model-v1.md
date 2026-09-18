# ADR-014: Question/Answer Model V1

Status: ACCEPTED

## Context

`PostgresAnswerCorrectnessChecker` has been blocked since the first Postgres
infrastructure checkpoint (see `PERSISTENCE_IMPLEMENTATION_REPORT.md`)
because `question_versions.answer_options`/`correct_answer` (`jsonb`,
`supabase/migrations/20260917203000_initial_schema.sql`) were deliberately
left an "UNRESOLVED shape... simplest V1 placeholder" — `docs/DATABASE.md`
§9 and `docs/PERSISTENCE_SCHEMA_V1.md`'s own `question_versions` section
both flag this explicitly as open, and `docs/MASTER_SPEC.md` §8 only says
"the final storage model for answer options — normalized table vs
structured JSON — remains TBD."

Before writing that adapter, this ADR defines the actual V1 content/answer
contract those two JSONB columns hold, so `PostgresAnswerCorrectnessChecker`
implements a real, durable decision rather than guessing a shape.

## Decision

### 1. Two question types in V1: `SINGLE_CHOICE` and `MULTIPLE_CHOICE`

```ts
const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"] as const;
```

`docs/MASTER_SPEC.md` §8/§9 already describes exactly one question type —
a prompt with several options and one correct answer ("Answer A / Answer B
/ Answer C / Answer D / Correct answer") — which this ADR calls
`SINGLE_CHOICE`. `MULTIPLE_CHOICE` (more than one option may be marked
correct; the learner selects a set) is added because it is a near-zero-cost
generalization of the exact same options/correctness model — the same
`options`/`correctOptionIds` shape below, with a different cardinality rule
and a different `selectedAnswer` shape — not a new subsystem, a new
question-authoring workflow, or a new grading mechanism. Free text, essay,
numeric-tolerance, ordering, matching, and fill-in-the-blank remain OUT OF
SCOPE for V1: no committed doc or code path requires any of them, and
`docs/MASTER_SPEC.md` §9.1 itself says "the first implementation should
prioritize high-quality multiple-choice learning."

**`TRUE_FALSE` is deliberately NOT a distinct type.** A true/false question
is representable as a `SINGLE_CHOICE` question with exactly two options
(conventionally "True"/"False") with zero semantic loss — every
`SINGLE_CHOICE` rule (exactly one correct option, a scalar `selectedAnswer`,
exact-identity comparison) already applies unchanged. Introducing a third
`QuestionType` to represent the same rules under a different name would be
duplication for its own sake, which this project's architecture explicitly
discourages (`docs/ARCHITECTURE.md` §35: "favor cheap extension points over
speculative implementation"). If true/false ever needs UI-level
specialization (a toggle instead of a radio list, for example), that is a
presentation-layer concern, not a domain-model one — it does not require a
new `QuestionType`.

### 2. `QuestionAnswerDefinition` — the persisted answer-content contract

```ts
interface AnswerOption {
  id: string;
  content: string;
}

interface QuestionAnswerDefinition {
  questionType: QuestionType;
  options: AnswerOption[];
  correctOptionIds: string[];
}
```

Answering Phase 2's specific questions:

- **(A) Option representation**: an array of `{id, content}`, order
  preserved — see (E).
- **(B) Correctness representation**: `correctOptionIds: string[]`, ONE
  shape for BOTH question types (never a scalar-for-single/array-for-multi
  split) — `SINGLE_CHOICE` requires exactly one entry, `MULTIPLE_CHOICE`
  requires at least one. A single canonical shape with a per-type
  cardinality rule is simpler than branching the persisted shape itself on
  `questionType`.
- **(C) How a selected answer references options**: by `id` — see
  `SelectedAnswer` below.
- **(D) Option id stability**: option ids are stable WITHIN one
  QuestionVersion only, for the QuestionVersion's entire lifetime (it is
  immutable — ADR-009). They have no meaning across versions; a new
  QuestionVersion may reuse, change, or drop any option id.
- **(E) Is display order meaningful?**: YES for `options[]` — it is the
  frozen, meaningful presentation order, never re-shuffled after the
  version is created. NO for `correctOptionIds` or a `MULTIPLE_CHOICE`
  `selectedAnswer` — both are set semantics; order carries no meaning and
  is normalized away (see `SelectedAnswer` below).
- **(F) Can labels/text change without a new QuestionVersion?**: NO.
  Changing ANY part of this shape — an option's `content`, the set of
  options, `correctOptionIds`, or `questionType` itself — requires a new
  QuestionVersion. There is no in-place edit of a QuestionVersion's answer
  content anywhere in this codebase (verified — see Phase 12/§6 below).
- **(G) `MULTIPLE_CHOICE` equality**: set equality (order-irrelevant,
  duplicate-free) between the canonicalized `selectedAnswer` and
  `correctOptionIds`.
- **(H) Are duplicates forbidden?**: YES, everywhere — duplicate option
  ids within `options`, duplicate entries in `correctOptionIds`, and
  duplicate ids in a submitted `selectedAnswer` are all REJECTED (throw),
  never silently deduplicated. A duplicate is far more likely a
  content-authoring or client bug than genuine intent, and this codebase's
  established discipline is to fail loudly on ambiguous input rather than
  guess (the same philosophy ADR-010's idempotency-conflict design already
  applies).
- **(I) Can a question have zero correct options?**: NO, for either type —
  a `SINGLE_CHOICE`/`MULTIPLE_CHOICE` question with zero correct options is
  treated as malformed persisted content
  (`InvalidQuestionAnswerDefinitionError`), not a valid (if unusual)
  product state.
- **(J) Can ALL options be correct?**: YES, allowed — nothing in this
  contract forbids it. Disallowing it would be an arbitrary
  content-authoring restriction with no basis in any current product
  decision.
- **(K) Does correctness depend only on the frozen QuestionVersion?**: YES
  — `evaluateAnswerCorrectness(definition, selectedAnswer)`
  (`src/domain/learning/answer.ts`) is a pure function of exactly those two
  arguments. It never reads `Question.current_version_id` or any other
  mutable state.
- **(L) Can historical Attempts always be re-evaluated against their exact
  version?**: YES, by construction — QuestionVersion rows are immutable and
  never deleted (composite `RESTRICT` FKs throughout the schema), and
  `PostgresAnswerCorrectnessChecker` loads by the Attempt's own frozen
  `questionVersionId`, never via `questions.current_version_id` (see §6).

Persistence note: no schema/column RENAME was needed.
`question_versions.answer_options`/`correct_answer` (already generic
`jsonb`, already `NOT NULL`) hold `AnswerOption[]` and `correctOptionIds`
respectively, unchanged in column identity — only their now-decided
CONTENTS are new. The only new PHYSICAL column is `question_type`
(see §5's migration).

### 3. `SelectedAnswer` — the submitted-answer contract

```ts
type SelectedAnswer = string | string[] | null;
```

- `string` — one selected option id (`SINGLE_CHOICE`).
- `string[]` — a set of selected option ids (`MULTIPLE_CHOICE`).
  `["a","b"]` and `["b","a"]` are the SAME answer: `canonicalizeSelectedAnswer`
  (`src/domain/learning/answer.ts`) sorts ascending before the value is
  compared, evaluated for correctness, OR persisted — one normalization
  point, not per-comparison-site special-casing. A duplicate id in the
  array is REJECTED (`InvalidSelectedAnswerError`), never silently
  deduplicated (see (H) above).
- `null` — **not a valid answer at correctness-evaluation time.** There is
  no currently-modeled "the learner explicitly skipped this Question via a
  null Attempt" flow — skip is tracked on `TodaySessionItem.status`
  (`'skipped'`), not via an Attempt with a null answer
  (`docs/DATABASE.md`). `evaluateAnswerCorrectness` therefore throws
  `InvalidSelectedAnswerError` for `null` (and, for `MULTIPLE_CHOICE`, for
  `[]` too — both fail the same "is a non-empty, correctly-shaped value"
  check uniformly). The type stays nullable at the TypeScript level only
  for backward compatibility with `Attempt`'s pre-existing shape and to
  avoid this ADR overclaiming a skip-semantics decision it is not
  authorized to make.

**`Attempt.selectedAnswer` narrowed from `string | number | null` to
`SelectedAnswer` (`string | string[] | null`).** `number` is REMOVED, not
kept alongside the new shape: it was never part of any decided answer
format (every use of it in the codebase before this ADR was an
incidental placeholder value in unrelated domain tests — verified, not
assumed — grepped every `selectedAnswer` reference in `src/` before
removing it), and keeping two live representations of "a choice" (an
option id, and an arbitrary number) would be exactly the kind of
speculative flexibility this project's architecture avoids. The six
domain test fixtures that used a bare placeholder number were updated to
a placeholder string with no behavior change (none of those tests inspect
`selectedAnswer`'s value).

**Idempotency-comparison correctness fix (found during this
implementation, not merely anticipated).** ADR-010's canonical
command-identity comparison used `===` uniformly across fields
(Date excepted). Since `selectedAnswer` can now be a `string[]`, `===` on
two distinct-but-equal-content arrays is always `false` — this would have
made every legitimate `MULTIPLE_CHOICE` retry look like an idempotency-key
conflict. Fixed in `submit-answer.ts`'s `findConflictingFields` with an
explicit, defensively-sorted array-aware comparison (`valuesEqual`), and by
canonicalizing `command.selectedAnswer` once, at the top of
`submitAnswerInTransaction`, before it is used for ANY comparison,
correctness check, or persistence.

### 4. Validation boundary — fail loudly, never guess

Two distinct validation functions, two distinct error types, deliberately
not merged into one:

- **`assertValidQuestionAnswerDefinition`** (`src/domain/learning/answer.ts`)
  validates a PERSISTED `QuestionAnswerDefinition`'s own structural
  integrity (non-empty options, unique option ids, `correctOptionIds`
  reference real options with no duplicates, per-type cardinality). Throws
  `InvalidQuestionAnswerDefinitionError` — a DATA-CORRUPTION /
  infrastructure error. `question_type` itself is validated one layer
  further out, by the infrastructure mapper reading the DB's
  CHECK-constrained `question_type` column through a closed-enum reader,
  before a `QuestionAnswerDefinition` value even exists.
- **`evaluateAnswerCorrectness`** (same file) validates a CLIENT-submitted
  `SelectedAnswer` against an already-validated definition (shape matches
  `questionType`, every id exists among `options`, no duplicates). Throws
  `InvalidSelectedAnswerError` — a REQUEST-VALIDATION error.

**These two error types are never conflated, and neither is ever
translated into `isCorrect: false`.** A malformed selected answer was
never actually graded; a malformed persisted definition is infrastructure
data corruption, not a fact about any learner's answer.
`submit-answer.ts` catches `InvalidSelectedAnswerError` explicitly and
maps it to a new `SubmitAnswerResult` kind
(`INVALID_SELECTED_ANSWER`) — it does NOT catch
`InvalidQuestionAnswerDefinitionError`, which propagates as a genuine
unexpected error (transaction rolled back, real exception surfaced to the
caller), exactly matching this task's instruction that malformed
persisted content must never quietly become "the student was wrong."

No CHECK constraint validates JSONB internals at the DB level (beyond the
new `question_type` enum CHECK) — deep JSON-shape validation belongs in
application/infrastructure code, matching this schema's already-established
style (CHECK for closed value sets, never for JSON-internal business
rules — see the initial migration's own header comment).

### 5. Schema: one new forward-only migration

`afddd3b`/`f55da33` are already committed and pushed — the initial
migration is NOT edited. A new migration,
`supabase/migrations/20260918000000_question_answer_model_v1.sql`, adds
the one genuinely new physical column:

```sql
alter table question_versions
  add column question_type text
    check (question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE'));

update question_versions set question_type = 'SINGLE_CHOICE'
  where question_type is null;

alter table question_versions
  alter column question_type set not null;
```

(Added nullable, backfilled, then set `NOT NULL` — not a single
`ADD COLUMN ... NOT NULL DEFAULT ...` — specifically so no column default
is left behind afterward: matching `users.id`'s own established precedent
in the initial migration of never leaving a default that could misleadingly
imply an unrequested value, every future insert must supply
`question_type` explicitly.) `answer_options`/`correct_answer` keep their
existing columns/types (already generic `jsonb NOT NULL`) — their
`COMMENT ON COLUMN` text is reissued to describe the now-decided shape,
superseding the initial migration's "UNRESOLVED shape" comment without
editing that file.

### 6. `PostgresAnswerCorrectnessChecker`

Implemented as its OWN narrow read (`src/infrastructure/postgres/
answer-correctness-checker.ts`), not by broadening
`QuestionVersionRepository`'s existing contract — that port intentionally
stays scoped to submitAnswer's own consistency-checking needs
(`getCurrentVersion`, `resolveVersionContext`), a different concern from
loading full answer content. The adapter:

1. Loads `question_type, answer_options, correct_answer` from
   `question_versions` **by the exact `questionVersionId` given** —
   verified: no query anywhere in this adapter or its mapper ever touches
   `questions.current_version_id`. This is what makes (K)/(L) above true
   in the real implementation, not just on paper.
2. Parses+validates the row into a `QuestionAnswerDefinition`
   (`assertValidQuestionAnswerDefinition`) — throws
   `InvalidQuestionAnswerDefinitionError` on malformed persisted content.
3. Delegates to `evaluateAnswerCorrectness` (pure domain function) for the
   actual correctness computation — no correctness logic is duplicated in
   this file or pushed into SQL.

## Consequences

- `PostgresAnswerCorrectnessChecker` is no longer blocked; real-Postgres
  `submitAnswer` integration tests use it directly (no fake) for
  `SINGLE_CHOICE`/`MULTIPLE_CHOICE` correctness scenarios.
- `Attempt.selectedAnswer`/`AnswerCorrectnessChecker.isCorrect`'s type
  narrowed to `SelectedAnswer` — `number` is no longer accepted anywhere.
- A learner's `MULTIPLE_CHOICE` answer is always persisted and compared in
  canonical (sorted, duplicate-free) form, regardless of client submission
  order.
- Editing a Question's options/correct-answer/type always produces a new
  QuestionVersion; a historical Attempt against an old version remains
  correctly, independently re-gradable forever.
- A malformed persisted `QuestionAnswerDefinition` surfaces as a real
  thrown error (never a false "incorrect" grade); a malformed client
  `selectedAnswer` surfaces as a typed `INVALID_SELECTED_ANSWER` result
  (never a false grade either).

## Deferred (explicitly NOT decided here)

- Free text / essay / numeric-tolerance / ordering / matching /
  fill-in-the-blank question types.
- Any free-text or LLM-assisted grading of any kind.
- Partial credit for `MULTIPLE_CHOICE` (a partially-correct set is simply
  `isCorrect: false` in V1 — an all-or-nothing set-equality check; no
  partial-credit pedagogy is decided or implied).
- Skip/unanswered semantics beyond what already exists on
  `TodaySessionItem.status`.
- `Question.verification_state`'s exact enum, `Material.material_type`'s
  exact enum — unrelated open items, untouched by this ADR.
- User↔Course authorization, RLS policies, any Auth/UI behavior.

## Alternatives Considered

### A distinct `TRUE_FALSE` question type

Rejected — see Decision §1. Representable as `SINGLE_CHOICE` with two
options, with zero semantic loss; a third type would duplicate every
`SINGLE_CHOICE` rule under a different name.

### Scalar `correctAnswer` for `SINGLE_CHOICE`, array for `MULTIPLE_CHOICE`

Rejected. Branching the PERSISTED shape itself on `questionType` (rather
than branching only the cardinality RULE applied to one shared shape) means
every reader of `question_versions` needs to know the type before it can
even parse `correct_answer` — strictly more coupling for no benefit over
"always an array, cardinality enforced separately."

### Silently deduplicate a selectedAnswer/option-id list instead of rejecting

Rejected — see Decision §2(H). A duplicate is far more likely a bug than
intent; silently coalescing it would hide that bug instead of surfacing it,
inconsistent with this codebase's established "fail loudly" discipline.

### Treat `null`/`[]` selectedAnswer as automatically incorrect

Rejected. Conflating "no valid selection was made" with "the learner chose
wrong" would misrepresent what happened — no answer was actually graded.
Both are treated as a distinct `INVALID_SELECTED_ANSWER` request-validation
outcome instead.

### Normalize `answer_options`/`correct_answer` into relational tables

Rejected for V1, per the task's own explicit steer and this schema's
established JSONB-for-still-evolving-content precedent (already used for
`scheduler_state`) — no concrete requirement (querying options
independently of their Question, for example) currently justifies the
added complexity. Revisit if such a requirement materializes.

### Broaden `QuestionVersionRepository` to also return answer content

Rejected — see Decision §6. Keeps that port's existing, already-used
contract (submitAnswer's consistency checks) unchanged; `AnswerCorrectnessChecker`
gets its own minimal, purpose-built read instead of forcing every caller of
`QuestionVersionRepository` to pay for a heavier return shape it doesn't need.

## Related Documents

- `docs/DATABASE.md` §9
- `docs/PERSISTENCE_SCHEMA_V1.md` (`question_versions` section)
- `docs/MASTER_SPEC.md` §8, §9.1
- `docs/OPEN_QUESTIONS.md` (answer-format item, resolved by this ADR)
- `docs/DECISIONS/009-question-versioning.md`
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `src/domain/learning/answer.ts`
- `src/application/learning/submit-answer.ts`
- `src/infrastructure/postgres/answer-correctness-checker.ts`
- `supabase/migrations/20260918000000_question_answer_model_v1.sql`

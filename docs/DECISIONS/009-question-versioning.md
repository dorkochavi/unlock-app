# ADR-009: Question Content Requires Versioning (QuestionVersion)

Status: ACCEPTED

## Context

`docs/DATABASE.md` §8 (Question Versioning) has tracked this as OPEN: if a Question's wording, options, or correct answer change after learners have already answered it, a historical Attempt must remain interpretable — it should not silently appear to reference different content than what the learner actually saw.

The domain `Attempt` type (`src/domain/learning/types.ts`) already requires `questionVersionId` on every Attempt. The persistence model has not yet defined what that field points to. Designing the persistence/application layer for `submitAnswer` (learner-answer transaction model, ADR-010) requires resolving this first, since every Attempt insert needs a concrete `question_version_id`.

## Decision

V1 introduces two related but distinct entities:

- **Question** — the stable logical identity of a learning item. Holds `course_id`, a `current_version_id` pointer, and lifecycle/verification metadata. Mutable where safe (the pointer moves; verification state can change).
- **QuestionVersion** — a fully immutable content snapshot: prompt/text, answer options, correct answer, explanation. Created once, never updated after creation.

Editing a Question's content is modeled as: `INSERT` a new `QuestionVersion` row, then `UPDATE Question.current_version_id` to point at it. An existing `QuestionVersion` row that any `Attempt` references is never mutated or deleted.

`Attempt.question_version_id` always references the exact `QuestionVersion` the learner saw at answer time — never `Question.current_version_id` at read time, which may have moved since.

This extends the same immutability principle ADR-005 already established for Attempts to the content those Attempts measured against.

No authoring workflow (drafts, review states, diffing) is introduced — only the immutable-snapshot-plus-current-pointer shape needed for historical integrity.

## Consequences

- historical Attempts remain interpretable even after a Question's wording or correct answer changes later;
- `submitAnswer` and Today-session generation (ADR-010) can resolve a concrete `question_version_id` deterministically at the moments they need one;
- Question edits require an explicit new-version write path rather than an in-place update, at the cost of one extra table and one extra write per content edit;
- answer-options storage model (JSON vs. normalized `question_options` table) remains a separate, still-OPEN decision (`docs/DATABASE.md` §9) — this ADR only fixes that whatever shape is chosen lives on the immutable `QuestionVersion`, not on the mutable `Question`.

## Alternatives Considered

### Single mutable Question table, no versioning

Rejected. Editing a Question's correct answer would silently change the meaning of every historical Attempt that answered it, violating ADR-005's evidence-preservation principle.

### Snapshot content directly onto each Attempt

Rejected as the primary model. It would duplicate identical content across every Attempt for a popular Question and make "what is the Question's current content" require scanning Attempts. A shared, referenced `QuestionVersion` is cheaper and matches how `Attempt.questionVersionId` is already modeled.

### Restrict edits after first use instead of versioning

Rejected for V1. It would block legitimate corrections (typos, clarity fixes) to content that has already been used, which is a realistic and frequent need, without providing any benefit versioning doesn't already give.

## Related Documents

- `docs/DATABASE.md` (§7, §8, §9)
- `docs/DECISIONS/005-attempts-are-immutable.md`
- `docs/DECISIONS/010-answer-submission-transaction-model.md`

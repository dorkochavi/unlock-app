# UNLOCK — Current Execution Plan

PLAN_VERSION: RUN-007-STRUCTURED-IMPORT-V1
RUN_ID: 2026-09-21-007
BASELINE_REMOTE_HEAD: `26678d8` (`feature/project-foundation`, pushed)
STATUS: PLANNED — implementation not started

## 1. Goal

An instructor can bring an externally prepared question set (JSON or CSV)
into UNLOCK through one canonical, format-independent import pipeline —
source adapter → canonical rows → validation/Topic resolution → preview →
confirm → persistence — built on top of Run 006's Question/QuestionVersion
model, per `docs/UNLOCK_ROADMAP.md` Run 007.

## 2. Scope

In scope:
- format-independent canonical row model;
- JSON adapter and CSV adapter, one shared answer-option contract;
- Topic resolution by name against the target Course's active Topics;
- row-level validation with an actionable preview (valid/invalid counts,
  per-row errors), no writes;
- atomic, all-or-nothing confirm that reparses/revalidates the
  authoritative raw input server-side;
- imported Questions land `DRAFT_ONLY`, publishable through the existing,
  unmodified Run 006 publish flow;
- minimal instructor-facing preview/confirm UI.

Out of scope:
- XLSX (deferred per roadmap's own conditional wording);
- native PDF ingestion, in-product AI question generation (Run 011);
- auto-publish-on-import; a bulk "publish all imported" action;
- implicit Topic auto-creation;
- updating/merging into already-existing Questions via re-import;
- any new DB schema/migration (none is expected; if implementation
  evidence proves one genuinely necessary, report `PLAN_CONFLICT`);
- hosted Supabase mutation, Git push;
- any change to `src/domain/learning/**`, DailyPlan, or auth/RLS behavior.

## 3. Fixed Product/Architecture Decisions

Kept fixed unless repository evidence during implementation materially
contradicts them — report `PLAN_CONFLICT` rather than improvising:

- import creates new Questions only, never updates/merges an existing one;
- imported Questions remain `DRAFT_ONLY`; import never creates a
  `QuestionVersion`; import never auto-publishes;
- the existing Run 006 publish flow remains the only publish path;
- preview is stateless and writes nothing; the client resubmits the same
  raw payload to confirm;
- confirm reparses/revalidates authoritative raw input server-side —
  never trusts a client-computed preview verdict;
- confirm is all-or-nothing: any invalid row rejects the whole batch,
  zero Questions created;
- import never auto-creates Topics — a row references an existing active
  Topic by name only; no match or an ambiguous match is a row-level
  error, never resolved arbitrarily;
- JSON and CSV are in scope; XLSX is deferred; no Import Session table.

## 4. External Import Contract

Topic reference is by name (trimmed, case-insensitive exact match against
the target Course's active Topics), never by internal `topicId`. One
shared, key-based answer-option contract for both adapters — no alternate
`correctOptionContents`/`correctOptionIds` split.

JSON shape:

```json
{
  "topic": "Introduction",
  "type": "SINGLE_CHOICE",
  "prompt": "What is the correct answer?",
  "options": [
    { "key": "A", "content": "Option A" },
    { "key": "B", "content": "Option B" }
  ],
  "correctOptions": ["B"],
  "explanation": "..."
}
```

CSV columns:

```text
topic,type,prompt,option_a,option_b,option_c,option_d,option_e,option_f,correct_options,explanation
```

`correct_options` is one or more option-column letters (e.g. `B` or
`B,D`). Adapters translate external option `key`s into the canonical
internal `AnswerOption` representation — external files never need to
know internal ids. `papaparse` is the CSV parsing dependency S1 adds.

## 5. Ownership Contract

| Responsibility | Owner |
|---|---|
| Common agent baseline | `AGENTS.md` |
| Claude operating kernel | `CLAUDE.md` |
| Current Run scope | `docs/CHATGPT_PLAN.md` (this file) |
| Current durable state | `docs/DEV_STATUS.md` |
| Context navigation | `docs/CONTEXT_MAP.md` |
| Testing philosophy | `docs/TESTING.md` |
| Verification selection/freshness | `.claude/rules/testing.md` |
| Slice orchestration | `implement-slice` |
| Reviewer selection | `review-commit` |
| Evidence/readiness gate | `checkpoint` |
| DB policy | `.claude/rules/postgres.md` |
| Auth/security policy | `.claude/rules/auth.md` |
| API policy | `.claude/rules/api.md` |
| Deferred work | `docs/FOLLOW_UP_BACKLOG.md` |

This Plan does not restate reviewer-selection criteria, verification
command selection, or checkpoint mechanics — see the owners above.

## 6. Canonical Lifecycle

Slice:

`INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT → COMMIT`

Run close:

`INTEGRATION ACCEPTANCE (only if missing) → DEV_STATUS → RUN REPORT → FINAL GIT STATE → STOP`

## 7. Ground Truth Already Confirmed

- Run 006 already built the "one Question" authoring/publish stack this
  Run extends into "many Questions from an external source":
  `src/domain/question/types.ts` (`assertValidQuestionAnswerDefinition`,
  `assertQuestionPublishReady`), `src/application/question/{create,update}-question-draft.ts`,
  `src/infrastructure/postgres/question-authoring-repository.ts`
  (`createDraft`, `updateDraft`), `src/application/topic/ports.ts` /
  `src/infrastructure/postgres/topic-repository.ts`
  (`listActiveForCourse`, `getTopic`).
- `docs/UNLOCK_ROADMAP.md`'s Run 008 outcome lists the intended end-to-end
  order explicitly as *"Course → Topics → author or import questions →
  validate/preview → publish questions → publish Course"* — import and
  publish are distinct, separately-sequenced steps, which is why imported
  Questions land `DRAFT_ONLY`. Per row this is `createDraft({courseId})` +
  `updateDraft(questionId, {topicId, questionType, prompt, answerOptions,
  correctOptionIds, explanation})` — both already exist, unchanged.
- `PublishQuestionRepositories` (`src/application/question/ports.ts`)
  deliberately excludes `topics`; the confirm transaction needs `topics`
  (to resolve a row's Topic name and reject archived Topics), so it needs
  its own small repo bundle/UoW, mirroring `PostgresQuestionUnitOfWork`
  with `topics: new PostgresTopicRepository(db)` added.
- No schema change is required: import reuses the `questions` /
  `question_versions` / `topics` tables exactly as Run 006 left them.

## 8. S1 — Canonical Import Contract + JSON/CSV Adapters

STATUS: NOT STARTED

Deliverables:
- `src/domain/import/types.ts`: `CanonicalQuestionRow` (sourceRowNumber,
  topicName, questionType, prompt, answerOptions, correctOptionIds,
  explanation) — format-independent, key-based options already translated
  to canonical `AnswerOption` shape;
- `src/application/import/adapters/json-adapter.ts` and
  `.../csv-adapter.ts`, both producing `CanonicalQuestionRow[]` from the
  external contract in §4, with malformed-input/wrong-shape parse errors
  kept distinct from row-content validation (S2);
- add `papaparse` dependency for the CSV adapter only.

Risk surface: pure parsing/mapping, no DB, no auth.

Acceptance:
- JSON and CSV adapters each correctly produce the same canonical row
  model from equivalent well-formed input;
- malformed input (bad JSON, missing required CSV columns, unknown option
  keys referenced by `correctOptions`/`correct_options`) produces a clear
  parse-level error, not a silent wrong row.

## 9. S2 — Validation + Topic Resolution + Preview Use Case

STATUS: NOT STARTED

Deliverables:
- row-level validator in `src/domain/import/types.ts` reusing
  `assertValidQuestionAnswerDefinition`'s existing invariants (no
  duplicate option, no duplicate/unknown correct answer, per-type
  cardinality) but **collecting** every row's errors instead of throwing
  on the first one;
- `src/application/import/preview-import.ts`: authorize
  (`canAuthorCourse`), reject an `ARCHIVED` Course, run the S1 adapter,
  validate each row, resolve each row's Topic name against
  `topics.listActiveForCourse` (read-only), return
  `{ totalRows, validCount, invalidCount, rows: [...] }`. No writes.

Risk surface: authorization boundary; read-only Topic-name resolution
correctness (exact-match/ambiguity/no-match behavior).

Acceptance:
- row-level validation is actionable (each invalid row states which
  invariant failed);
- Topic-name resolution is trimmed, case-insensitive, requires a unique
  match among active Topics, and never resolves ambiguity arbitrarily;
- Preview performs no writes under any input, valid or invalid.

## 10. S3 — Preview API + Instructor Preview UI

STATUS: NOT STARTED

Deliverables:
- `src/app/api/courses/[courseId]/import/preview/` route wrapping S2's
  use case — authenticated caller, no client-authoritative identity, Node
  runtime, DTO-mapped response;
- minimal instructor UI (`src/app/instructor/courses/[courseId]/import/`):
  format choice, paste/upload input, "Preview" action, a valid/invalid
  count summary and a per-row error table. Reuses the existing instructor
  shell Run 006 established.

Risk surface: authenticated API boundary; untrusted request-body parsing
at the HTTP edge.

Acceptance:
- an unauthenticated request is rejected before any protected work;
- a real instructor can paste/upload a JSON or CSV payload and see an
  accurate row-by-row preview in the product UI, without SQL/seed/
  developer intervention.

## 11. S4 — Atomic Confirm + Import Unit of Work + Confirm API

STATUS: NOT STARTED

Deliverables:
- new `ImportRepositories` (`memberships`, `courses`, `questions`,
  `topics`) and `src/infrastructure/postgres/postgres-import-unit-of-work.ts`
  mirroring `PostgresQuestionUnitOfWork`, with `topics` added;
- `src/application/import/confirm-import.ts`, ordered so the transaction
  protects only the multi-row write set, not the read-only work ahead of
  it:
  1. re-run the S1 adapter + S2 validation (including Topic-name
     resolution) against the same raw payload server-side, outside any
     transaction — never trusts an earlier preview;
  2. authorize (`canAuthorCourse`) and reject an `ARCHIVED` Course, also
     before opening a transaction;
  3. if any row is invalid, reject the whole batch with zero writes and
     no transaction ever opened;
  4. only once the full batch is confirmed valid, open one transaction;
     immediately re-check, inside it, only the mutable DB-dependent
     invariants a concurrent change could have invalidated since step 1-2
     (TOCTOU guard, not a re-run of parsing/full row validation): the
     caller is still authorized to author the Course, the Course is still
     not `ARCHIVED`, and every previously resolved Topic still belongs to
     the target Course and is still active; reject the whole batch with
     zero writes if any re-check fails;
  5. then loop `createDraft` + `updateDraft` per row (existing, unchanged
     persistence methods) inside the same transaction, committing
     atomically; roll back entirely on any write failure, preserving the
     original error;
- `src/app/api/courses/[courseId]/import/confirm/` route.

Risk surface: authenticated API boundary; authorization; transactional
persistence; multi-row atomicity; TOCTOU between pre-validation and write.

Acceptance:
- confirm reparses and revalidates the authoritative raw input
  server-side rather than trusting the client;
- confirm is genuinely all-or-nothing (one bad row among many valid ones
  still creates zero Questions);
- every successfully imported Question is `DRAFT_ONLY` with no
  `question_versions` row created by this path;
- the transaction spans only the mutable-invariant re-check and the
  persistence loop — parsing and full row/content validation stay outside
  it, but authorization/Course/Topic state is re-checked immediately after
  the transaction opens, before any write, so a concurrent revoke/archive
  cannot slip a write through on stale pre-transaction state.

## 12. S5 — Confirm UX + Existing Authoring Integration

STATUS: NOT STARTED

Deliverables:
- confirm action + success state in the instructor import UI (disabled/
  warns unless the current preview shows zero invalid rows);
- success state links directly into the Course's existing (Run 006)
  Question list, where each imported Question already appears
  `DRAFT_ONLY` and is reviewable/editable/publishable through the
  unmodified existing authoring UI/route — no separate "imported
  question" lifecycle, list, or state.

Risk surface: cross-layer behavior (new import surface handing off
cleanly into pre-existing authoring surface).

Acceptance: an instructor can go from raw external file to a set of
`DRAFT_ONLY` Questions to publishing them, entirely through the product,
using Run 006's existing per-Question publish action with zero changes to
that action.

## 13. S6 — Integrated Structured Import Walkthrough

STATUS: NOT STARTED

Deliverables: one PGlite/application-level integration test mirroring Run
006 S6's pattern, proving in one place:
- JSON happy path (multiple rows/Topics) → preview counts correct →
  confirm creates real `DRAFT_ONLY` Questions;
- CSV happy path through the same pipeline, same outcome;
- each imported Question is then publishable through the existing,
  unmodified `publishQuestion` action;
- all-or-nothing rejection: one invalid row blocks the whole confirm,
  verified by a zero-Questions-created count;
- Topic-name resolution: no-match and ambiguous-match rows are rejected,
  a correct unique match is not;
- archived-Course rejection at both preview and confirm.

Risk surface: full cross-layer integration of S1-S5.

Acceptance: the complete flow (adapter → validation/Topic resolution →
stateless preview → authoritative confirm → `DRAFT_ONLY` persistence →
existing-publish compatibility) is proven end to end against real
repository code, not mocked SQL.

## 14. Reviewer and Verification Delegation

Reviewer selection for every Slice above is delegated to
`/review-commit`, based on each Slice's stated risk surface — this Plan
does not preselect reviewers.

Verification selection, freshness, and evidence reuse for every Slice
above is delegated to `.claude/rules/testing.md` — this Plan states only
the Run-specific acceptance evidence per Slice, not command-level test
selection.

## 15. Stop Condition

Run 007 stops when S1-S6 are complete, the integrated walkthrough (S6)
passes, `docs/DEV_STATUS.md` reflects the new capability, and a Run
Report is written under `docs/RUNS/`, per the standard Run-end lifecycle
owned by `CLAUDE.md`/`AGENTS.md`.

Do not begin Run 008 inside this Plan.
Do not push.

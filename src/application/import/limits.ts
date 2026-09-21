/**
 * Application-layer row-count limit for Structured Import (Run 008 S1.D),
 * resolving the remaining half of FUB-005
 * (`docs/FOLLOW_UP_BACKLOG.md`) — `MAX_IMPORT_SOURCE_LENGTH`
 * (`src/app/api/courses/[courseId]/import/limits.ts`) already bounds
 * request-body character count, but a source-length limit alone does not
 * bound row count: many short rows (e.g. terse CSV rows) can still fit
 * under the character limit while producing an effectively unbounded
 * number of synchronous per-row content-validation/Topic-resolution
 * passes (`previewImport`) and, through `confirmImport`, an unbounded
 * number of sequential `createDraft`/`updateDraft` writes inside one
 * transaction.
 *
 * Enforced in `previewImport` once parsing produces
 * `CanonicalQuestionRow[]` — not inside the format-independent S1
 * adapters themselves, per FUB-005's original "enforce at the boundary,
 * not inside the adapters" direction — and inherited by `confirmImport`,
 * which reuses `previewImport` unchanged for its Phase 1 reparse.
 *
 * 2,000 rows comfortably exceeds any realistic single-Course pilot
 * question bank (the Ruppin pilot is one course) while still bounding
 * `confirmImport`'s sequential per-row transactional write loop to a
 * predictable, human-reviewable batch size.
 */
export const MAX_IMPORT_ROWS = 2_000;

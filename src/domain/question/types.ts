/**
 * UNLOCK Question Authoring & Publishing V1 — Run 006. Domain contract for
 * the DRAFT side of Question authoring, on top of the existing immutable
 * Question/QuestionVersion model (`src/domain/learning/answer.ts`, ADR-009/
 * ADR-014) and the existing flat Topic model (Run 005 S4,
 * `src/domain/topic/types.ts`).
 *
 * No separate QuestionDraft table exists (Run 005/006 decision) — draft
 * content lives on nullable `draft_*` columns directly on `questions`
 * (`supabase/migrations/20260928000000_question_authoring_v1.sql`). This
 * file's `QuestionAuthoringRecord` is the domain-level mirror of that row
 * shape: current (published) identity plus the current draft snapshot.
 */
import {
  QUESTION_TYPES,
  type AnswerOption,
  type QuestionType,
} from "../learning/answer";

export type { AnswerOption, QuestionType };

/**
 * Work-in-progress draft content for one Question. Mirrors
 * `QuestionAnswerDefinition`'s shape field-for-field (so publish, Run 006
 * S5, can copy this directly into a new immutable QuestionVersion with no
 * shape translation) but every field is independently nullable — a draft is
 * explicitly allowed to be incomplete (S2 "save-draft validation" is more
 * permissive than S3's strict "publish-ready validation", which requires
 * every field).
 *
 * A successful publish CLEARS every field back to `null` (Run 006 S5): this
 * struct represents ONLY unpublished pending edits, never a copy of the
 * current published version. This is what makes
 * `computeQuestionAuthoringState` below a pure function of
 * `currentVersionId` + this struct, with no separate "has pending changes"
 * flag to keep in sync.
 */
export interface QuestionDraftContent {
  questionType: QuestionType | null;
  prompt: string | null;
  answerOptions: AnswerOption[] | null;
  correctOptionIds: string[] | null;
  explanation: string | null;
}

export const EMPTY_QUESTION_DRAFT: QuestionDraftContent = {
  questionType: null,
  prompt: null,
  answerOptions: null,
  correctOptionIds: null,
  explanation: null,
};

/** Full authoring-only view of a Question — never returned to a learner-facing read path. */
export interface QuestionAuthoringRecord {
  id: string;
  courseId: string;
  /** Current (not versioned) Topic association — see the migration's own column comment for why this is not part of `QuestionDraftContent`/QuestionVersion. */
  topicId: string | null;
  /** `null` = never published (the pre-first-publish state `question_versions.getCurrentVersion` already treats as "no current version available"). */
  currentVersionId: string | null;
  draft: QuestionDraftContent;
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionAuthoringState =
  | "DRAFT_ONLY"
  | "PUBLISHED"
  | "PUBLISHED_WITH_DRAFT_CHANGES";

function isDraftEmpty(draft: QuestionDraftContent): boolean {
  return (
    draft.questionType === null &&
    draft.prompt === null &&
    draft.answerOptions === null &&
    draft.correctOptionIds === null &&
    draft.explanation === null
  );
}

/**
 * The single authoritative place that derives a Question's authoring state
 * (Run 006 CHATGPT_PLAN.md S2: "distinguish: never-published draft,
 * published Question with current version, published Question with newer
 * draft edits"). Pure function of the two fields it reads — no separate
 * flag anywhere is allowed to disagree with this.
 */
export function computeQuestionAuthoringState(
  record: Pick<QuestionAuthoringRecord, "currentVersionId" | "draft">,
): QuestionAuthoringState {
  if (record.currentVersionId === null) {
    return "DRAFT_ONLY";
  }
  return isDraftEmpty(record.draft) ? "PUBLISHED" : "PUBLISHED_WITH_DRAFT_CHANGES";
}

/**
 * Thrown for a structurally dangerous/invalid draft encoding — never for an
 * incomplete-but-safe work-in-progress draft (Run 006 CHATGPT_PLAN.md S2
 * "Save-draft validation": "Allow work-in-progress where reasonable, but
 * never accept structurally dangerous/invalid encodings"). Deliberately
 * distinct from `InvalidQuestionAnswerDefinitionError`
 * (`src/domain/learning/answer.ts`) — that error is for a PERSISTED,
 * supposedly-already-valid QuestionVersion; this one is for an
 * intentionally-incomplete draft, so it must not share a name a caller
 * might reflexively treat as "the same kind of problem."
 */
export class InvalidQuestionDraftContentError extends Error {
  constructor(message: string) {
    super(`Invalid question draft content: ${message}`);
    this.name = "InvalidQuestionDraftContentError";
  }
}

/**
 * Save-draft-level validation ONLY — deliberately weaker than
 * `assertValidQuestionAnswerDefinition` (which S3's publish-ready validator
 * reuses in full for the strict "ready to publish" gate). Every field here
 * may independently be `null`/absent; this function only rejects encodings
 * that are unsafe/nonsensical regardless of completeness:
 * - a duplicate `answerOptions` id (would make the option list ambiguous by
 *   construction, not merely "incomplete");
 * - a duplicate `correctOptionIds` entry;
 * - `questionType` set to something other than a known `QuestionType`
 *   (defense-in-depth for a caller passing raw, not-yet-narrowed input —
 *   e.g. a future API route parsing untrusted JSON, mirroring
 *   `canonicalizeSelectedAnswer`'s own "public export, callers may not all
 *   be type-checked" reasoning).
 *
 * Does NOT require: a non-empty prompt, any options at all, `correctOptionIds`
 * referencing a real option id, or per-type cardinality (exactly one for
 * SINGLE_CHOICE, at least one for MULTIPLE_CHOICE) — those are publish-ready
 * concerns (Run 006 S3), not save-draft concerns.
 */
export function assertSaveableQuestionDraftContent(
  draft: Partial<QuestionDraftContent>,
): void {
  if (
    draft.questionType !== null &&
    draft.questionType !== undefined &&
    !(QUESTION_TYPES as readonly string[]).includes(draft.questionType)
  ) {
    throw new InvalidQuestionDraftContentError(
      `unknown questionType ${JSON.stringify(draft.questionType)}`,
    );
  }

  if (draft.answerOptions != null) {
    const seen = new Set<string>();
    for (const option of draft.answerOptions) {
      if (seen.has(option.id)) {
        throw new InvalidQuestionDraftContentError(
          `duplicate option id "${option.id}"`,
        );
      }
      seen.add(option.id);
    }
  }

  if (draft.correctOptionIds != null) {
    const seen = new Set<string>();
    for (const id of draft.correctOptionIds) {
      if (seen.has(id)) {
        throw new InvalidQuestionDraftContentError(
          `duplicate entry "${id}" in correctOptionIds`,
        );
      }
      seen.add(id);
    }
  }
}

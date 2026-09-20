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
  assertValidQuestionAnswerDefinition,
  InvalidQuestionAnswerDefinitionError,
  QUESTION_TYPES,
  type AnswerOption,
  type QuestionAnswerDefinition,
  type QuestionType,
} from "../learning/answer";

export type { AnswerOption, QuestionAnswerDefinition, QuestionType };

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

/**
 * Publish-Ready Validation Contract (Run 006 S3, CHATGPT_PLAN.md).
 *
 * This is the ONE authoritative place that decides whether a Question draft
 * is ready to become an immutable QuestionVersion (Run 006 S5) — it is
 * called by the publish use case and is the same contract the authoring UI
 * (Run 006 S4) reuses to show a "ready to publish" indicator. Nothing else
 * in this codebase is allowed to reimplement any part of this decision.
 *
 * A question needs at least this many options to be meaningful — a
 * SINGLE_CHOICE question with only one option would trivially satisfy
 * "exactly one correct option" while presenting the learner with no actual
 * choice.
 */
export const MIN_PUBLISHABLE_OPTION_COUNT = 2;

/**
 * Thrown when a draft fails publish-ready validation — always a
 * product-meaningful "not ready yet" outcome (mapped by callers to their own
 * typed result, e.g. `NOT_READY`), never an unexpected/infrastructure
 * error. Deliberately distinct from `InvalidQuestionDraftContentError`
 * (save-draft's much weaker bar) and from
 * `InvalidQuestionAnswerDefinitionError` (a PERSISTED QuestionVersion's own
 * internal-consistency check, reused here as part of this stricter gate —
 * see `assertQuestionPublishReady` below).
 */
export class QuestionNotPublishReadyError extends Error {
  constructor(message: string) {
    super(`Question is not publish-ready: ${message}`);
    this.name = "QuestionNotPublishReadyError";
  }
}

/**
 * Exactly the fields publish-readiness depends on. `topicId` is current
 * (not versioned) `questions` metadata — see `QuestionAuthoringRecord`'s own
 * comment for why it lives outside `QuestionDraftContent` — but publishing
 * still requires one to be chosen, so it is validated here alongside the
 * draft content fields.
 *
 * Deliberately does NOT re-validate that a non-null `topicId` actually
 * exists/belongs to this Question's own Course/is unarchived: the database
 * itself already guarantees existence and same-Course association for any
 * non-null `topic_id` (the composite FK added by
 * `20260928000000_question_authoring_v1.sql`, enforced at write time by
 * `updateQuestionDraft`), and Topics are never hard-deleted (archive-only —
 * `20260927000000_topics_v1.sql`), so a persisted non-null `topicId` can
 * never dangle. Per the Run 006 S1 audit's explicit decision (finding #10,
 * `scratch/development_checkpoint.md`): a Topic becoming archived AFTER a
 * Question was already associated with it does NOT block that Question from
 * publishing — only a NEW association to an archived Topic is rejected
 * (`updateQuestionDraft`'s own `TOPIC_ARCHIVED` outcome). This is why publish
 * readiness only checks "is a Topic chosen at all," never re-checking its
 * archived state.
 */
export interface QuestionPublishCandidateContent {
  topicId: string | null;
  questionType: QuestionType | null;
  prompt: string | null;
  answerOptions: AnswerOption[] | null;
  correctOptionIds: string[] | null;
  explanation: string | null;
}

/**
 * The exact, normalized content Run 006 S5's publish transaction should
 * write into a new `question_versions` row (plus `topicId`, already current
 * `questions` metadata that publish does not itself need to write). `prompt`
 * and every option's `content` are trimmed — "no empty NORMALIZED options"
 * (CHATGPT_PLAN.md S3) means trim-then-check, and it is this same trimmed
 * value that should be persisted, not the raw pre-trim input.
 */
export interface PublishableQuestionVersionContent {
  topicId: string;
  prompt: string;
  questionType: QuestionType;
  answerOptions: AnswerOption[];
  correctOptionIds: string[];
  explanation: string | null;
}

/**
 * Validates a Question's current draft (plus its current `topicId`) against
 * every publish-ready invariant (CHATGPT_PLAN.md S3 "Publish-ready
 * invariants"). Throws `QuestionNotPublishReadyError` with a
 * product-meaningful message on the FIRST invariant violated — never
 * silently repairs/guesses. Returns the normalized, ready-to-persist content
 * on success.
 *
 * Deliberately reuses `assertValidQuestionAnswerDefinition`
 * (`src/domain/learning/answer.ts`) for every invariant it already covers
 * (no duplicate option id, no duplicate/unknown `correctOptionIds` entry,
 * per-type cardinality: SINGLE_CHOICE exactly one correct option,
 * MULTIPLE_CHOICE at least one) — CHATGPT_PLAN.md S3 is explicit: "Do not
 * invent a second grading vocabulary merely for authoring." This function
 * only adds the invariants that validator does not and cannot cover, since
 * it assumes an already-structurally-sound definition:
 * non-empty/non-whitespace prompt, a chosen Topic, a chosen question type,
 * a meaningful option count (`MIN_PUBLISHABLE_OPTION_COUNT`), and no
 * empty/whitespace-only option content.
 */
export function assertQuestionPublishReady(
  content: QuestionPublishCandidateContent,
): PublishableQuestionVersionContent {
  if (content.topicId === null) {
    throw new QuestionNotPublishReadyError("a Topic must be selected before publishing");
  }

  const prompt = content.prompt?.trim() ?? "";
  if (prompt.length === 0) {
    throw new QuestionNotPublishReadyError("prompt must not be empty");
  }

  if (content.questionType === null) {
    throw new QuestionNotPublishReadyError("a question type must be selected");
  }

  if (
    content.answerOptions === null ||
    content.answerOptions.length < MIN_PUBLISHABLE_OPTION_COUNT
  ) {
    throw new QuestionNotPublishReadyError(
      `at least ${MIN_PUBLISHABLE_OPTION_COUNT} options are required`,
    );
  }

  const normalizedOptions = content.answerOptions.map((option) => ({
    id: option.id,
    content: option.content.trim(),
  }));
  for (const option of normalizedOptions) {
    if (option.content.length === 0) {
      throw new QuestionNotPublishReadyError(
        `option "${option.id}" must not be empty`,
      );
    }
  }

  if (content.correctOptionIds === null || content.correctOptionIds.length === 0) {
    throw new QuestionNotPublishReadyError("a correct answer must be selected");
  }

  const definition: QuestionAnswerDefinition = {
    questionType: content.questionType,
    options: normalizedOptions,
    correctOptionIds: content.correctOptionIds,
  };
  try {
    // Reused, not reimplemented: duplicate option ids, correctOptionIds
    // referencing an unknown/removed option, and per-type cardinality.
    assertValidQuestionAnswerDefinition(definition);
  } catch (error) {
    // Re-wrapped as the ONE "not ready yet" error type this contract
    // exposes — a caller catching `QuestionNotPublishReadyError` must not
    // also need to know about `InvalidQuestionAnswerDefinitionError` (a
    // separate module's error for a separate, PERSISTED-content concern)
    // to correctly treat every publish-readiness failure uniformly.
    if (error instanceof InvalidQuestionAnswerDefinitionError) {
      throw new QuestionNotPublishReadyError(error.message);
    }
    throw error;
  }

  return {
    topicId: content.topicId,
    prompt,
    questionType: content.questionType,
    answerOptions: normalizedOptions,
    correctOptionIds: content.correctOptionIds,
    explanation: content.explanation?.trim() || null,
  };
}

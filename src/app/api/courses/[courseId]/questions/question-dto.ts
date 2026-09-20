/**
 * Shared route-layer DTO mapper for `QuestionAuthoringRecord` (Run 006 S4),
 * used by every Question authoring route (list, create, get, update).
 * Converts `Date` -> ISO string explicitly and computes `state` server-side
 * via `computeQuestionAuthoringState` — the UI must never re-derive
 * DRAFT_ONLY/PUBLISHED/PUBLISHED_WITH_DRAFT_CHANGES itself (CLAUDE.md
 * "Learning policy must not be duplicated inside API routes or UI code" —
 * the same discipline applies to this authoring-state derivation).
 *
 * Deliberately omits `currentVersionId`: the UI's own required distinction
 * (draft-only / published / published-with-pending-changes) is fully
 * carried by `state`; the underlying QuestionVersion id is an
 * authoring-internal implementation detail no required S4 UX needs.
 */
import { computeQuestionAuthoringState } from "@/domain/question/types";
import type { QuestionAuthoringRecord, QuestionDraftContent, Topic } from "@/application/question/ports";

export interface QuestionAuthoringDraftDto {
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | null;
  prompt: string | null;
  answerOptions: { id: string; content: string }[] | null;
  correctOptionIds: string[] | null;
  explanation: string | null;
}

/**
 * Minimal Topic projection for display alongside a Question — deliberately
 * NOT the same as `topics/topic-dto.ts`'s `TopicDto` (which omits
 * `archivedAt`, since every Topic-authoring route's own caller already
 * knows the outcome): here `archivedAt` is the whole point, so an authoring
 * UI can show "(archived)" next to a Question's still-real Topic
 * association instead of silently rendering it as unset.
 */
export interface TopicSummaryDto {
  id: string;
  name: string;
  archivedAt: string | null;
}

export function toTopicSummaryDto(topic: Topic): TopicSummaryDto {
  return {
    id: topic.id,
    name: topic.name,
    archivedAt: topic.archivedAt === null ? null : topic.archivedAt.toISOString(),
  };
}

export interface QuestionAuthoringDto {
  id: string;
  courseId: string;
  topicId: string | null;
  state: "DRAFT_ONLY" | "PUBLISHED" | "PUBLISHED_WITH_DRAFT_CHANGES";
  draft: QuestionAuthoringDraftDto;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a resolved current-QuestionVersion content (Run 006 S4
 * "reopen/edit" support, `getQuestionForAuthoring`'s `publishedContent`) —
 * same wire shape as a draft, since both are `QuestionDraftContent`
 * structurally.
 */
export function toQuestionDraftContentDto(
  content: QuestionDraftContent | null,
): QuestionAuthoringDraftDto | null {
  if (content === null) {
    return null;
  }
  return {
    questionType: content.questionType,
    prompt: content.prompt,
    answerOptions: content.answerOptions,
    correctOptionIds: content.correctOptionIds,
    explanation: content.explanation,
  };
}

export function toQuestionAuthoringDto(question: QuestionAuthoringRecord): QuestionAuthoringDto {
  return {
    id: question.id,
    courseId: question.courseId,
    topicId: question.topicId,
    state: computeQuestionAuthoringState(question),
    draft: {
      questionType: question.draft.questionType,
      prompt: question.draft.prompt,
      answerOptions: question.draft.answerOptions,
      correctOptionIds: question.draft.correctOptionIds,
      explanation: question.draft.explanation,
    },
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

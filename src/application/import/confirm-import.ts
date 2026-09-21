/**
 * confirmImport — the application-layer use case for Run 007 S4's atomic
 * Confirm step (`docs/CHATGPT_PLAN.md` §11 "S4 — Atomic Confirm + Import
 * Unit of Work + Confirm API"). Deliberately split into two phases, per the
 * Plan's own explicit ordering — the transaction protects only the
 * multi-row write set, not the read-only work ahead of it:
 *
 * ## Phase 1 — outside any transaction
 *
 * Reuses `previewImport` (Run 007 S2) UNCHANGED against a plain,
 * non-transactional connection — the exact same authorize → reject
 * `ARCHIVED` → parse (S1 adapter) → validate/resolve-Topic (S2) pipeline
 * the S3 preview route already runs. This is the "reparse/revalidate the
 * authoritative raw input server-side" the Plan requires: confirm NEVER
 * trusts an earlier preview call's verdict, only the same raw
 * `format`/`sourceText` the client resubmits. Any row invalid, or any
 * non-`PREVIEWED` outcome (`NOT_AUTHORIZED`/`COURSE_ARCHIVED`/
 * `MALFORMED_SOURCE`), rejects the whole batch with zero writes and no
 * transaction ever opened.
 *
 * ## Phase 2 — inside one transaction
 *
 * Only once Phase 1 proves the full batch valid does `confirmImport` open
 * one `ImportUnitOfWork` transaction. Immediately re-checks, inside it,
 * only the mutable DB-dependent invariants a concurrent change could have
 * invalidated since Phase 1 (a TOCTOU guard, not a re-run of parsing/full
 * row validation): the caller is still authorized to author the Course, the
 * Course is still not `ARCHIVED`, and every previously resolved Topic still
 * belongs to this Course and is still active. Any re-check failure aborts
 * the whole batch with zero writes (`ConfirmOutcomeSignal` triggers a real
 * `ROLLBACK`, matching `publishQuestion`'s own established
 * signal-then-rollback discipline — `src/application/question/publish-question.ts`).
 * Only then does it loop `createDraft({courseId})` + `updateDraft(questionId,
 * {...})` per row (Run 006, unchanged) inside the same transaction,
 * committing atomically. Imported Questions land `DRAFT_ONLY`: neither
 * `createDraft` nor `updateDraft` ever creates a `question_versions` row or
 * touches `current_version_id`.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import { previewImport, type ImportSourceFormat, type PreviewRowResult } from "./preview-import";
import type { ImportRepositories, ImportUnitOfWork, PreviewImportRepositories } from "./ports";

export interface ConfirmImportCommand {
  actorUserId: string;
  courseId: string;
  format: ImportSourceFormat;
  sourceText: string;
}

export interface ConfirmImportRowError {
  sourceRowNumber: number;
  errors: string[];
}

export type ConfirmImportResult =
  | { outcome: "CONFIRMED"; createdCount: number; createdQuestionIds: string[] }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_ARCHIVED" }
  | { outcome: "MALFORMED_SOURCE"; error: string }
  | { outcome: "INVALID_ROWS"; totalRows: number; invalidCount: number; errors: ConfirmImportRowError[] }
  /** A concurrent Course/Topic change invalidated Phase 1's verdict between preview-reparse and the write transaction — never chosen arbitrarily, the caller must preview/confirm again against current state. */
  | { outcome: "STATE_CHANGED" };

export interface ConfirmImportDependencies {
  previewRepos: PreviewImportRepositories;
  uow: ImportUnitOfWork;
}

class ConfirmOutcomeSignal extends Error {
  constructor(public readonly result: Exclude<ConfirmImportResult, { outcome: "CONFIRMED" }>) {
    super(`confirmImport: ${result.outcome}`);
    this.name = "ConfirmOutcomeSignal";
  }
}

type ValidPreviewRow = Extract<PreviewRowResult, { outcome: "VALID" }>;

export async function confirmImport(
  command: ConfirmImportCommand,
  deps: ConfirmImportDependencies,
): Promise<ConfirmImportResult> {
  const preview = await previewImport(command, deps.previewRepos);

  if (preview.outcome !== "PREVIEWED") {
    return preview;
  }

  const invalidRows = preview.rows.filter(
    (row): row is Extract<PreviewRowResult, { outcome: "INVALID" }> => row.outcome === "INVALID",
  );
  if (invalidRows.length > 0) {
    return {
      outcome: "INVALID_ROWS",
      totalRows: preview.totalRows,
      invalidCount: preview.invalidCount,
      errors: invalidRows.map((row) => ({ sourceRowNumber: row.sourceRowNumber, errors: row.errors })),
    };
  }

  const validRows = preview.rows.filter((row): row is ValidPreviewRow => row.outcome === "VALID");

  try {
    return await deps.uow.runInTransaction((repos) => confirmImportInTransaction(command, validRows, repos));
  } catch (error) {
    if (error instanceof ConfirmOutcomeSignal) {
      return error.result;
    }
    throw error;
  }
}

async function confirmImportInTransaction(
  command: ConfirmImportCommand,
  validRows: ValidPreviewRow[],
  repos: ImportRepositories,
): Promise<ConfirmImportResult> {
  const actorMembership = await repos.memberships.findMembership(command.actorUserId, command.courseId);
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    throw new ConfirmOutcomeSignal({ outcome: "NOT_AUTHORIZED" });
  }

  const course = await repos.courses.getCourseForAuthoring(command.courseId);
  if (course === null) {
    // Same defensive collapse as `previewImport`/`publishQuestion` — never a
    // distinct "not found" that could leak existence.
    throw new ConfirmOutcomeSignal({ outcome: "NOT_AUTHORIZED" });
  }
  if (course.status === "ARCHIVED") {
    throw new ConfirmOutcomeSignal({ outcome: "COURSE_ARCHIVED" });
  }

  const distinctTopicIds = [...new Set(validRows.map((row) => row.topicId))];
  for (const topicId of distinctTopicIds) {
    const topic = await repos.topics.getTopic(topicId);
    if (topic === null || topic.courseId !== command.courseId || topic.archivedAt !== null) {
      throw new ConfirmOutcomeSignal({ outcome: "STATE_CHANGED" });
    }
  }

  // `updateDraft` is a pure persistence write with no content validation of
  // its own (`QuestionRepository.updateDraft`'s own doc comment) — safe here
  // only because `row` already passed `validateCanonicalQuestionRowContent`
  // (S2, reusing `assertValidQuestionAnswerDefinition`) during THIS SAME
  // call's Phase 1 reparse, moments earlier, guaranteeing a well-typed
  // `QuestionType`, no duplicate/unknown option or correct-answer reference.
  const createdQuestionIds: string[] = [];
  for (const row of validRows) {
    const created = await repos.questions.createDraft({ courseId: command.courseId });
    const updated = await repos.questions.updateDraft(created.id, {
      topicId: row.topicId,
      questionType: row.row.questionType,
      prompt: row.row.prompt,
      answerOptions: row.row.answerOptions,
      correctOptionIds: row.row.correctOptionIds,
      explanation: row.row.explanation,
    });
    if (updated === null) {
      // Reachable only if the just-created Question disappeared mid-transaction
      // — not a normal V1 path (no code deletes a `questions` row), same
      // defensive discipline as `publishQuestion`'s own "disappeared
      // mid-transaction" guard.
      throw new Error(`confirmImport: Question ${created.id} disappeared mid-transaction`);
    }
    createdQuestionIds.push(created.id);
  }

  return { outcome: "CONFIRMED", createdCount: createdQuestionIds.length, createdQuestionIds };
}

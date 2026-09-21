/**
 * previewImport — the application-layer use case for Run 007 S2's Preview
 * step (`docs/CHATGPT_PLAN.md` §9 "S2 — Validation + Topic Resolution +
 * Preview Use Case"). Authorize → reject an `ARCHIVED` Course → run the S1
 * adapter for the declared format → validate each row's content
 * (`validateCanonicalQuestionRowContent`, `src/domain/import/types.ts`) →
 * resolve each row's Topic name read-only against the Course's active
 * Topics (`resolveTopicByName`) → return one combined per-row outcome.
 *
 * Read-only by construction: this module never imports a `questions` or
 * `topics`-write port, and issues no writes for any input — valid,
 * invalid, or malformed. Confirm/persistence is Run 007 S4, not this file.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import {
  buildTopicNameIndex,
  resolveTopicByName,
  validateCanonicalQuestionRowContent,
  type CanonicalQuestionRow,
} from "../../domain/import/types";
import { parseCsvImportSource } from "./adapters/csv-adapter";
import { parseJsonImportSource } from "./adapters/json-adapter";
import type { ImportRowParseResult } from "./adapter-types";
import type { PreviewImportRepositories } from "./ports";

export type ImportSourceFormat = "JSON" | "CSV";

export interface PreviewImportCommand {
  actorUserId: string;
  courseId: string;
  format: ImportSourceFormat;
  sourceText: string;
}

export type PreviewRowResult =
  | { sourceRowNumber: number; outcome: "VALID"; row: CanonicalQuestionRow; topicId: string }
  | { sourceRowNumber: number; outcome: "INVALID"; errors: string[] };

export type PreviewImportResult =
  | {
      outcome: "PREVIEWED";
      totalRows: number;
      validCount: number;
      invalidCount: number;
      rows: PreviewRowResult[];
    }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_ARCHIVED" }
  | { outcome: "MALFORMED_SOURCE"; error: string };

export async function previewImport(
  command: PreviewImportCommand,
  repos: PreviewImportRepositories,
): Promise<PreviewImportResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const course = await repos.courses.getCourseForAuthoring(command.courseId);
  if (course === null) {
    // Unreachable in practice: `actorMembership` above already proves a
    // `course_memberships` row exists for this exact `courseId`, and that
    // row's own FK guarantees the Course itself exists — handled
    // defensively rather than assumed, matching `publishQuestion`'s own
    // established style (`src/application/question/publish-question.ts`).
    // Collapses to the same denial a real unauthorized caller sees, never
    // a distinct "not found" that could leak existence.
    return { outcome: "NOT_AUTHORIZED" };
  }
  if (course.status === "ARCHIVED") {
    return { outcome: "COURSE_ARCHIVED" };
  }

  const parsed =
    command.format === "JSON"
      ? parseJsonImportSource(command.sourceText)
      : parseCsvImportSource(command.sourceText);

  if (parsed.outcome === "MALFORMED_SOURCE") {
    return { outcome: "MALFORMED_SOURCE", error: parsed.error };
  }

  const activeTopics = await repos.topics.listActiveForCourse(command.courseId);
  const topicIndex = buildTopicNameIndex(activeTopics);

  const rows = parsed.rows.map((parseResult) => evaluateRow(parseResult, topicIndex));
  const validCount = rows.filter((row) => row.outcome === "VALID").length;

  return {
    outcome: "PREVIEWED",
    totalRows: rows.length,
    validCount,
    invalidCount: rows.length - validCount,
    rows,
  };
}

function evaluateRow(
  parseResult: ImportRowParseResult,
  topicIndex: ReturnType<typeof buildTopicNameIndex>,
): PreviewRowResult {
  if (parseResult.outcome === "PARSE_ERROR") {
    return {
      sourceRowNumber: parseResult.sourceRowNumber,
      outcome: "INVALID",
      errors: parseResult.errors,
    };
  }

  const row = parseResult.row;
  const errors = validateCanonicalQuestionRowContent(row);

  const topicResolution = resolveTopicByName(row.topicName, topicIndex);
  let topicId: string | null = null;
  if (topicResolution.outcome === "NOT_FOUND") {
    errors.push(
      `Topic "${row.topicName}" was not found among this Course's active Topics`,
    );
  } else if (topicResolution.outcome === "AMBIGUOUS") {
    errors.push(
      `Topic name "${row.topicName}" matches more than one active Topic in this Course — rename one of them before importing`,
    );
  } else {
    topicId = topicResolution.topicId;
  }

  if (errors.length > 0) {
    return { sourceRowNumber: row.sourceRowNumber, outcome: "INVALID", errors };
  }

  // `topicId` is guaranteed non-null here: `errors` is empty only when
  // `topicResolution.outcome === "RESOLVED"`, the one branch that sets it.
  return {
    sourceRowNumber: row.sourceRowNumber,
    outcome: "VALID",
    row,
    topicId: topicId as string,
  };
}

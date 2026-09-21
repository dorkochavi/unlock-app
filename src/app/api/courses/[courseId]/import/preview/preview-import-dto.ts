/**
 * Route-layer DTO mapper for `PreviewImportResult` (Run 007 S3), matching
 * this codebase's established `question-dto.ts`/`topic-dto.ts` discipline of
 * never returning an application-layer result object directly. Every field
 * here is already JSON-safe (no `Date`s in `previewImport`'s own result
 * shape) — this mapper exists to fix the exact wire contract explicitly
 * rather than relying on incidental structural compatibility.
 */
import type { PreviewImportResult, PreviewRowResult } from "@/application/import/preview-import";

export interface PreviewRowDto {
  sourceRowNumber: number;
  outcome: "VALID" | "INVALID";
  errors: string[] | null;
  topicId: string | null;
  topicName: string | null;
  questionType: string | null;
  prompt: string | null;
}

export interface PreviewImportDto {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: PreviewRowDto[];
}

function toPreviewRowDto(row: PreviewRowResult): PreviewRowDto {
  if (row.outcome === "INVALID") {
    return {
      sourceRowNumber: row.sourceRowNumber,
      outcome: "INVALID",
      errors: row.errors,
      topicId: null,
      topicName: null,
      questionType: null,
      prompt: null,
    };
  }
  return {
    sourceRowNumber: row.sourceRowNumber,
    outcome: "VALID",
    errors: null,
    topicId: row.topicId,
    topicName: row.row.topicName,
    questionType: row.row.questionType,
    prompt: row.row.prompt,
  };
}

export function toPreviewImportDto(
  result: Extract<PreviewImportResult, { outcome: "PREVIEWED" }>,
): PreviewImportDto {
  return {
    totalRows: result.totalRows,
    validCount: result.validCount,
    invalidCount: result.invalidCount,
    rows: result.rows.map(toPreviewRowDto),
  };
}

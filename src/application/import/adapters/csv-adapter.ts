/**
 * parseCsvImportSource — Run 007 S1. Parses the external CSV column
 * contract (`docs/CHATGPT_PLAN.md` §4: `topic,type,prompt,option_a..
 * option_f,correct_options,explanation`) into `CanonicalQuestionRow[]`,
 * producing the exact same canonical shape as the JSON adapter. Parse-level
 * only — see `src/application/import/adapter-types.ts`'s own doc comment
 * for the MALFORMED_SOURCE/PARSE_ERROR/row-content-validation split this
 * module respects. Row-content validation (S2) is not performed here.
 *
 * `papaparse` handles RFC 4180 quoting (embedded commas/newlines in a
 * prompt or option) correctly — hand-rolling that is a known correctness
 * trap this module deliberately avoids.
 */
import Papa from "papaparse";

import { QUESTION_TYPES, type QuestionType } from "../../../domain/learning/answer";
import type { CanonicalQuestionRow } from "../../../domain/import/types";
import type { ImportRowParseResult, ImportSourceParseResult } from "../adapter-types";

const OPTION_COLUMNS = [
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "option_e",
  "option_f",
] as const;
const REQUIRED_COLUMNS = ["topic", "type", "prompt", "correct_options"] as const;

function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

export function parseCsvImportSource(raw: string): ImportSourceParseResult {
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  // `FieldMismatch` (`TooFewFields`/`TooManyFields`) is a per-ROW warning —
  // papaparse still populates `parsed.data` for every row, this row's own
  // stray/missing delimiter included — so it must become that one row's
  // `PARSE_ERROR`, not abort the whole source: a single mistyped row in an
  // otherwise-valid file must not discard every other valid row (mirrors the
  // JSON adapter's row-independent `.map()`, and the exact guarantee
  // `adapter-types.ts`'s doc comment promises). Any OTHER papaparse error
  // type (`Quotes`, `Delimiter`) reflects the source itself being unparseable
  // as CSV at all, not one bad row, and stays document-fatal.
  const fatalErrors = parsed.errors.filter((error) => error.type !== "FieldMismatch");
  if (fatalErrors.length > 0) {
    return {
      outcome: "MALFORMED_SOURCE",
      error: fatalErrors.map((error) => `row ${error.row ?? "?"}: ${error.message}`).join("; "),
    };
  }

  const headers = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    return {
      outcome: "MALFORMED_SOURCE",
      error: `missing required column(s): ${missingColumns.join(", ")}`,
    };
  }
  const presentOptionColumns = OPTION_COLUMNS.filter((column) => headers.includes(column));

  const fieldMismatchMessagesByRow = new Map<number, string[]>();
  for (const error of parsed.errors) {
    const rowIndex = error.row ?? -1;
    const messages = fieldMismatchMessagesByRow.get(rowIndex) ?? [];
    messages.push(error.message);
    fieldMismatchMessagesByRow.set(rowIndex, messages);
  }

  const rows = parsed.data.map((entry, index) => {
    const mismatchMessages = fieldMismatchMessagesByRow.get(index);
    if (mismatchMessages !== undefined) {
      // The row's field/column alignment is unreliable (a value may have
      // landed in the wrong named column) — report it, never guess at a
      // "recovered" mapping.
      return {
        sourceRowNumber: index + 1,
        outcome: "PARSE_ERROR" as const,
        errors: mismatchMessages.map(
          (message) => `malformed row (column count mismatch): ${message}`,
        ),
      };
    }
    return parseCsvRow(entry, presentOptionColumns, index + 1);
  });
  return { outcome: "PARSED", rows };
}

function parseCsvRow(
  entry: Record<string, string>,
  presentOptionColumns: readonly string[],
  sourceRowNumber: number,
): ImportRowParseResult {
  const errors: string[] = [];

  // Emptiness (not just presence) is deliberately NOT checked here, mirroring
  // `prompt` below and the JSON adapter's own `topic`/`prompt` handling — a
  // blank Topic name is content S2's real Topic-name resolution will reject
  // as "no match" on its own; S1 stays a pure shape check for both formats.
  const topicName = (entry.topic ?? "").trim();

  const typeValue = (entry.type ?? "").trim().toUpperCase();
  const questionType = isQuestionType(typeValue) ? typeValue : null;
  if (questionType === null) {
    errors.push(`"type" must be one of ${QUESTION_TYPES.join(", ")}, got ${JSON.stringify(entry.type ?? "")}`);
  }

  const options: { id: string; content: string }[] = [];
  for (const column of presentOptionColumns) {
    const content = (entry[column] ?? "").trim();
    if (content.length === 0) {
      // Blank option column = this row simply doesn't use that lettered slot.
      continue;
    }
    options.push({ id: column.slice("option_".length).toUpperCase(), content });
  }
  if (options.length === 0) {
    errors.push("at least one option_* column must be filled in for this row");
  }

  const { correctOptionIds, correctOptionErrors } = parseCorrectOptions(
    entry.correct_options,
    options,
  );
  errors.push(...correctOptionErrors);

  if (errors.length > 0) {
    return { sourceRowNumber, outcome: "PARSE_ERROR", errors };
  }

  const explanationRaw = (entry.explanation ?? "").trim();
  const row: CanonicalQuestionRow = {
    sourceRowNumber,
    topicName,
    questionType: questionType as QuestionType,
    prompt: entry.prompt ?? "",
    answerOptions: options,
    correctOptionIds,
    explanation: explanationRaw.length > 0 ? explanationRaw : null,
  };
  return { sourceRowNumber, outcome: "PARSED", row };
}

function parseCorrectOptions(
  raw: string | undefined,
  options: { id: string; content: string }[],
): { correctOptionIds: string[]; correctOptionErrors: string[] } {
  const value = (raw ?? "").trim();
  if (value.length === 0) {
    return { correctOptionIds: [], correctOptionErrors: ['"correct_options" must not be empty'] };
  }

  const errors: string[] = [];
  const knownKeys = new Set(options.map((option) => option.id));
  const seen = new Set<string>();
  const correctOptionIds: string[] = [];

  for (const part of value.split(",")) {
    const key = part.trim().toUpperCase();
    if (key.length === 0) {
      continue;
    }
    if (!knownKeys.has(key)) {
      errors.push(`"correct_options" references unknown or blank option "${key}"`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`duplicate option "${key}" in "correct_options"`);
      continue;
    }
    seen.add(key);
    correctOptionIds.push(key);
  }
  if (correctOptionIds.length === 0 && errors.length === 0) {
    errors.push('"correct_options" must reference at least one option');
  }

  return { correctOptionIds, correctOptionErrors: errors };
}

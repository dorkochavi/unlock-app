/**
 * validateImportSource — offline, DB-free, content-blind structural gate for
 * a Structured Import file (JSON/CSV), for the pilot Content Go/No-Go.
 *
 * Reuses the canonical pipeline unchanged: the S1 adapters, then
 * `validateCanonicalQuestionRowContent` and Topic-name resolution from
 * `src/domain/import/types.ts` — the same rules `previewImport` applies.
 * Adds only file-level checks `previewImport` does not have (duplicate
 * prompts, empty Topics, minimum question count).
 *
 * The report carries error codes, row numbers, counts and Topic names —
 * never prompt/option/explanation text. Domain content messages are included
 * only because they reference option ids and counts, never authored text.
 * Adapter parse-error messages are deliberately NOT surfaced (they can echo
 * source values).
 *
 * It does NOT judge language, distractor or pedagogical quality, answer-key
 * truth, or semantic Topic alignment; those remain human checks.
 */
import {
  buildTopicNameIndex,
  resolveTopicByName,
  validateCanonicalQuestionRowContent,
  type CanonicalQuestionRow,
} from "../../domain/import/types";
import { parseCsvImportSource } from "./adapters/csv-adapter";
import { parseJsonImportSource } from "./adapters/json-adapter";
import { MAX_IMPORT_ROWS } from "./limits";
import type { ImportSourceFormat } from "./preview-import";

export type ImportIssueCode =
  | "MALFORMED_SOURCE"
  | "TOO_MANY_ROWS"
  | "NO_ROWS"
  | "ROW_PARSE_ERROR"
  | "ROW_CONTENT_INVALID"
  | "TOPIC_BLANK"
  | "TOPIC_UNKNOWN"
  | "TOPIC_AMBIGUOUS"
  | "BELOW_MIN_QUESTIONS"
  | "DUPLICATE_PROMPT"
  | "TOPIC_WITHOUT_QUESTIONS";

const WARNING_CODES: ReadonlySet<ImportIssueCode> = new Set([
  "DUPLICATE_PROMPT",
  "TOPIC_WITHOUT_QUESTIONS",
]);

export interface ImportIssue {
  code: ImportIssueCode;
  severity: "ERROR" | "WARNING";
  /** 1-based source row numbers (same numbering as `previewImport`). */
  rows?: number[];
  topic?: string;
  detail?: string;
}

export interface ValidateImportSourceInput {
  format: ImportSourceFormat;
  sourceText: string;
  /** Intended Course Topic names. When supplied, rows must resolve to one and every Topic should have questions. */
  knownTopics?: readonly string[];
  /** Explicit minimum count of fully valid questions. No canonical threshold exists, so none is assumed. */
  minQuestions?: number;
}

export interface ImportValidationReport {
  result: "PASS" | "FAIL";
  counts: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    topicsReferenced: number;
    /** Valid questions per normalized (trimmed, lower-cased) Topic name. */
    questionsPerTopic: Record<string, number>;
  };
  issues: ImportIssue[];
}

function issue(code: ImportIssueCode, extra: Omit<ImportIssue, "code" | "severity"> = {}): ImportIssue {
  return { code, severity: WARNING_CODES.has(code) ? "WARNING" : "ERROR", ...extra };
}

function resultOf(issues: readonly ImportIssue[]): "PASS" | "FAIL" {
  return issues.some((entry) => entry.severity === "ERROR") ? "FAIL" : "PASS";
}

function earlyReport(issues: ImportIssue[], totalRows = 0): ImportValidationReport {
  return {
    result: resultOf(issues),
    counts: { totalRows, validRows: 0, invalidRows: totalRows, topicsReferenced: 0, questionsPerTopic: {} },
    issues,
  };
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ").toLowerCase();
}

function topicKey(name: string): string {
  return name.trim().toLowerCase();
}

function pushTo<K>(map: Map<K, number[]>, key: K, value: number): void {
  const list = map.get(key);
  if (list === undefined) {
    map.set(key, [value]);
  } else {
    list.push(value);
  }
}

export function validateImportSource(input: ValidateImportSourceInput): ImportValidationReport {
  const parsed =
    input.format === "JSON"
      ? parseJsonImportSource(input.sourceText)
      : parseCsvImportSource(input.sourceText);

  if (parsed.outcome === "MALFORMED_SOURCE") {
    return earlyReport([issue("MALFORMED_SOURCE")]);
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return earlyReport(
      [issue("TOO_MANY_ROWS", { detail: `${parsed.rows.length} > ${MAX_IMPORT_ROWS}` })],
      parsed.rows.length,
    );
  }
  if (parsed.rows.length === 0) {
    return earlyReport([issue("NO_ROWS")]);
  }

  const parseErrorRows: number[] = [];
  const blankTopicRows: number[] = [];
  const unknownTopicRows = new Map<string, number[]>();
  const ambiguousTopicRows = new Map<string, number[]>();
  const contentIssues = new Map<string, number[]>();
  const promptGroups = new Map<string, number[]>();
  const referencedTopics = new Set<string>();
  const invalidRowSet = new Set<number>();
  const validRows: CanonicalQuestionRow[] = [];

  const knownTopicIndex =
    input.knownTopics === undefined
      ? null
      : buildTopicNameIndex(input.knownTopics.map((name) => ({ id: topicKey(name), name })));

  for (const result of parsed.rows) {
    if (result.outcome === "PARSE_ERROR") {
      parseErrorRows.push(result.sourceRowNumber);
      invalidRowSet.add(result.sourceRowNumber);
      continue;
    }
    const row = result.row;
    let rowValid = true;

    for (const message of validateCanonicalQuestionRowContent(row)) {
      pushTo(contentIssues, message, row.sourceRowNumber);
      rowValid = false;
    }

    const promptKey = normalizePrompt(row.prompt);
    if (promptKey.length > 0) pushTo(promptGroups, promptKey, row.sourceRowNumber);

    const trimmedTopic = row.topicName.trim();
    if (trimmedTopic.length === 0) {
      blankTopicRows.push(row.sourceRowNumber);
      rowValid = false;
    } else {
      referencedTopics.add(topicKey(trimmedTopic));
      if (knownTopicIndex !== null) {
        const resolution = resolveTopicByName(trimmedTopic, knownTopicIndex);
        if (resolution.outcome === "NOT_FOUND") {
          pushTo(unknownTopicRows, trimmedTopic, row.sourceRowNumber);
          rowValid = false;
        } else if (resolution.outcome === "AMBIGUOUS") {
          pushTo(ambiguousTopicRows, trimmedTopic, row.sourceRowNumber);
          rowValid = false;
        }
      }
    }

    if (rowValid) {
      validRows.push(row);
    } else {
      invalidRowSet.add(row.sourceRowNumber);
    }
  }

  const issues: ImportIssue[] = [];
  if (parseErrorRows.length > 0) issues.push(issue("ROW_PARSE_ERROR", { rows: parseErrorRows }));
  for (const [detail, rows] of [...contentIssues].sort(([a], [b]) => a.localeCompare(b))) {
    issues.push(issue("ROW_CONTENT_INVALID", { rows, detail }));
  }
  if (blankTopicRows.length > 0) issues.push(issue("TOPIC_BLANK", { rows: blankTopicRows }));
  for (const [topic, rows] of unknownTopicRows) issues.push(issue("TOPIC_UNKNOWN", { topic, rows }));
  for (const [topic, rows] of ambiguousTopicRows) issues.push(issue("TOPIC_AMBIGUOUS", { topic, rows }));

  const questionsPerTopic: Record<string, number> = {};
  for (const row of validRows) {
    const key = topicKey(row.topicName);
    questionsPerTopic[key] = (questionsPerTopic[key] ?? 0) + 1;
  }

  if (input.minQuestions !== undefined && validRows.length < input.minQuestions) {
    issues.push(issue("BELOW_MIN_QUESTIONS", { detail: `${validRows.length} < ${input.minQuestions}` }));
  }

  for (const rows of promptGroups.values()) {
    if (rows.length > 1) issues.push(issue("DUPLICATE_PROMPT", { rows }));
  }
  if (input.knownTopics !== undefined) {
    for (const name of input.knownTopics) {
      if ((questionsPerTopic[topicKey(name)] ?? 0) === 0) {
        issues.push(issue("TOPIC_WITHOUT_QUESTIONS", { topic: name.trim() }));
      }
    }
  }

  return {
    result: resultOf(issues),
    counts: {
      totalRows: parsed.rows.length,
      validRows: validRows.length,
      invalidRows: invalidRowSet.size,
      topicsReferenced: referencedTopics.size,
      questionsPerTopic: Object.fromEntries(
        Object.entries(questionsPerTopic).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    issues,
  };
}

/**
 * parseJsonImportSource — Run 007 S1. Parses the external "UNLOCK Import
 * JSON" shape (`docs/CHATGPT_PLAN.md` §4: a top-level array of row objects,
 * each `{ topic, type, prompt, options: [{ key, content }], correctOptions,
 * explanation? }`) into `CanonicalQuestionRow[]`. Parse-level only — see
 * `src/application/import/adapter-types.ts`'s own doc comment for the
 * MALFORMED_SOURCE/PARSE_ERROR/row-content-validation split this module
 * respects. Row-content validation (S2) is not performed here.
 */
import { QUESTION_TYPES, type QuestionType } from "../../../domain/learning/answer";
import type { CanonicalQuestionRow } from "../../../domain/import/types";
import type { ImportRowParseResult, ImportSourceParseResult } from "../adapter-types";

/**
 * Exact match, deliberately NOT case-normalized like the CSV adapter's own
 * `type` check — this JSON shape is documented (`docs/CHATGPT_PLAN.md` §4)
 * as suitable for external AI/system generation against the exact enum
 * values, whereas CSV is filled in by hand and normalized for that reason.
 */
function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

export function parseJsonImportSource(raw: string): ImportSourceParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      outcome: "MALFORMED_SOURCE",
      error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!Array.isArray(data)) {
    return {
      outcome: "MALFORMED_SOURCE",
      error: "expected a top-level JSON array of question rows",
    };
  }

  const rows = data.map((entry, index) => parseJsonRow(entry, index + 1));
  return { outcome: "PARSED", rows };
}

function parseJsonRow(entry: unknown, sourceRowNumber: number): ImportRowParseResult {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return { sourceRowNumber, outcome: "PARSE_ERROR", errors: ["row must be a JSON object"] };
  }
  const raw = entry as Record<string, unknown>;
  const errors: string[] = [];

  const topicName = typeof raw.topic === "string" ? raw.topic.trim() : "";
  if (typeof raw.topic !== "string") {
    errors.push('"topic" must be a string');
  }

  const questionType = isQuestionType(raw.type) ? raw.type : null;
  if (questionType === null) {
    errors.push(`"type" must be one of ${QUESTION_TYPES.join(", ")}, got ${JSON.stringify(raw.type)}`);
  }

  if (typeof raw.prompt !== "string") {
    errors.push('"prompt" must be a string');
  }

  const { options, optionErrors } = parseOptions(raw.options);
  errors.push(...optionErrors);

  const { correctOptionIds, correctOptionErrors } = parseCorrectOptions(
    raw.correctOptions,
    options,
  );
  errors.push(...correctOptionErrors);

  // Trimmed, blank-collapses-to-null — matches the CSV adapter exactly, so
  // both formats produce byte-identical `CanonicalQuestionRow.explanation`
  // for semantically equivalent input.
  let explanation: string | null | undefined = null;
  if (raw.explanation !== undefined && raw.explanation !== null) {
    if (typeof raw.explanation === "string") {
      const trimmed = raw.explanation.trim();
      explanation = trimmed.length > 0 ? trimmed : null;
    } else {
      explanation = undefined;
      errors.push('"explanation" must be a string when present');
    }
  }

  if (errors.length > 0) {
    return { sourceRowNumber, outcome: "PARSE_ERROR", errors };
  }

  const row: CanonicalQuestionRow = {
    sourceRowNumber,
    topicName,
    questionType: questionType as QuestionType,
    prompt: raw.prompt as string,
    answerOptions: options,
    correctOptionIds,
    explanation: explanation ?? null,
  };
  return { sourceRowNumber, outcome: "PARSED", row };
}

function parseOptions(value: unknown): {
  options: { id: string; content: string }[];
  optionErrors: string[];
} {
  if (!Array.isArray(value) || value.length === 0) {
    return { options: [], optionErrors: ['"options" must be a non-empty array'] };
  }

  const errors: string[] = [];
  const options: { id: string; content: string }[] = [];
  const seenKeys = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push('each entry in "options" must be an object with "key" and "content"');
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const key = typeof raw.key === "string" ? raw.key.trim().toUpperCase() : "";
    if (key.length === 0) {
      errors.push('each option must have a non-empty string "key"');
      continue;
    }
    if (typeof raw.content !== "string") {
      errors.push(`option "${key}" must have a string "content"`);
      continue;
    }
    if (seenKeys.has(key)) {
      errors.push(`duplicate option key "${key}"`);
      continue;
    }
    seenKeys.add(key);
    options.push({ id: key, content: raw.content });
  }

  return { options, optionErrors: errors };
}

function parseCorrectOptions(
  value: unknown,
  options: { id: string; content: string }[],
): { correctOptionIds: string[]; correctOptionErrors: string[] } {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      correctOptionIds: [],
      correctOptionErrors: ['"correctOptions" must be a non-empty array of option keys'],
    };
  }

  const errors: string[] = [];
  const knownKeys = new Set(options.map((option) => option.id));
  const seen = new Set<string>();
  const correctOptionIds: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      errors.push(`"correctOptions" entries must be strings, got ${JSON.stringify(entry)}`);
      continue;
    }
    const key = entry.trim().toUpperCase();
    if (!knownKeys.has(key)) {
      errors.push(`"correctOptions" references unknown option key "${entry}"`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`duplicate key "${key}" in "correctOptions"`);
      continue;
    }
    seen.add(key);
    correctOptionIds.push(key);
  }

  return { correctOptionIds, correctOptionErrors: errors };
}

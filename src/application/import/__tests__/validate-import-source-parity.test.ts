/**
 * Contract parity: the offline validator must not create parallel validation
 * semantics. For the same synthetic file, the set of rows the canonical
 * `previewImport` marks INVALID must equal the set of rows the offline
 * validator attributes an ERROR to, and every canonical content message must
 * be reported by the validator verbatim.
 *
 * Intentional differences (NOT asserted equal, see docs/PILOT_CONTENT_VALIDATOR.md):
 * NO_ROWS is an ERROR offline (Preview returns an empty PREVIEWED result);
 * DUPLICATE_PROMPT / TOPIC_WITHOUT_QUESTIONS warnings and BELOW_MIN_QUESTIONS are
 * offline-only; without `--topics` the offline tool does not resolve Topics.
 */
import { describe, expect, it } from "vitest";

import { MAX_IMPORT_ROWS } from "../limits";
import { previewImport } from "../preview-import";
import { validateImportSource, type ImportIssue } from "../validate-import-source";
import { InMemoryImportDatabase } from "./in-memory-fakes";

const ACTOR = "actor-1";
const COURSE = "course-1";
const ROW_ERROR_CODES = new Set([
  "ROW_PARSE_ERROR",
  "ROW_CONTENT_INVALID",
  "TOPIC_BLANK",
  "TOPIC_UNKNOWN",
  "TOPIC_AMBIGUOUS",
]);

function row(overrides: Record<string, unknown> = {}) {
  return {
    topic: "Alpha",
    type: "SINGLE_CHOICE",
    prompt: "Synthetic prompt",
    options: [
      { key: "A", content: "opt a" },
      { key: "B", content: "opt b" },
    ],
    correctOptions: ["A"],
    ...overrides,
  };
}

async function compare(format: "JSON" | "CSV", sourceText: string, topics: string[]) {
  const db = new InMemoryImportDatabase();
  db.seedMembership({
    id: "m",
    userId: ACTOR,
    courseId: COURSE,
    role: "OWNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
  });
  db.seedCourseStatus(COURSE, "PUBLISHED");
  for (const name of topics) db.seedActiveTopic(COURSE, name);

  const preview = await previewImport(
    { actorUserId: ACTOR, courseId: COURSE, format, sourceText },
    db.repos(),
  );
  const report = validateImportSource({ format, sourceText, knownTopics: topics });
  return { preview, report };
}

function offlineInvalidRows(issues: ImportIssue[]): number[] {
  const rows = new Set<number>();
  for (const entry of issues) {
    if (ROW_ERROR_CODES.has(entry.code)) for (const r of entry.rows ?? []) rows.add(r);
  }
  return [...rows].sort((a, b) => a - b);
}

describe("validateImportSource ↔ previewImport parity (synthetic)", () => {
  it("agrees on which JSON rows are invalid, valid counts, and canonical content messages", async () => {
    const rows = [
      row(), // 1 valid
      row({ prompt: "  " }), // 2 empty prompt
      row({ options: [{ key: "A", content: "only" }], correctOptions: ["A"] }), // 3 <2 options
      row({ correctOptions: ["A", "B"] }), // 4 SINGLE_CHOICE two correct
      row({ type: "MULTIPLE_CHOICE", correctOptions: ["A", "B"] }), // 5 valid multi
      row({ type: "MULTIPLE_CHOICE", correctOptions: [] }), // 6 multi with none correct
      row({ correctOptions: ["Z"] }), // 7 unknown option reference
      row({ type: "ESSAY" }), // 8 invalid type
      row({ topic: "  " }), // 9 blank topic
      row({ topic: " ALPHA " }), // 10 topic normalization (trim + case)
      row({ topic: "Gamma" }), // 11 unknown topic
      row({ topic: "Beta" }), // 12 ambiguous (two active Topics normalize equal)
      row({ options: [{ key: "A", content: " " }, { key: "B", content: "b" }] }), // 13 empty option
      row({ options: [{ key: "A", content: "x" }, { key: "A", content: "y" }] }), // 14 duplicate option key
    ];
    const { preview, report } = await compare("JSON", JSON.stringify(rows), ["Alpha", "Beta", "beta "]);

    expect(preview.outcome).toBe("PREVIEWED");
    if (preview.outcome !== "PREVIEWED") return;

    const previewInvalid = preview.rows
      .filter((r) => r.outcome === "INVALID")
      .map((r) => r.sourceRowNumber)
      .sort((a, b) => a - b);
    expect(offlineInvalidRows(report.issues)).toEqual(previewInvalid);
    expect(report.counts.totalRows).toBe(preview.totalRows);
    expect(report.counts.validRows).toBe(preview.validCount);
    expect(report.counts.invalidRows).toBe(preview.invalidCount);

    // Every canonical content message Preview shows for a row is reported verbatim offline.
    for (const entry of report.issues.filter((i) => i.code === "ROW_CONTENT_INVALID")) {
      for (const rowNumber of entry.rows ?? []) {
        const previewRow = preview.rows.find((r) => r.sourceRowNumber === rowNumber);
        expect(previewRow?.outcome).toBe("INVALID");
        if (previewRow?.outcome === "INVALID") expect(previewRow.errors).toContain(entry.detail);
      }
    }
  });

  it("agrees for CSV, including a topic-resolution failure", async () => {
    const csv = [
      "topic,type,prompt,option_a,option_b,correct_options,explanation",
      "Alpha,SINGLE_CHOICE,P1,x,y,A,",
      "alpha ,SINGLE_CHOICE,P2,x,y,\"A,B\",",
      "Nowhere,SINGLE_CHOICE,P3,x,y,B,",
      "Alpha,SINGLE_CHOICE,,x,y,A,",
    ].join("\n");
    const { preview, report } = await compare("CSV", csv, ["Alpha"]);
    expect(preview.outcome).toBe("PREVIEWED");
    if (preview.outcome !== "PREVIEWED") return;
    const previewInvalid = preview.rows.filter((r) => r.outcome === "INVALID").map((r) => r.sourceRowNumber);
    expect(offlineInvalidRows(report.issues)).toEqual(previewInvalid);
    expect(report.counts.validRows).toBe(preview.validCount);
  });

  it("agrees on malformed source and on the row limit boundary", async () => {
    const malformed = await compare("JSON", "{not json", ["Alpha"]);
    expect(malformed.preview.outcome).toBe("MALFORMED_SOURCE");
    expect(malformed.report.issues.map((i) => i.code)).toEqual(["MALFORMED_SOURCE"]);

    const many = await compare("JSON", JSON.stringify(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row())), ["Alpha"]);
    // Guard against a silently changed canonical limit: both sides must agree it is exceeded.
    expect(many.preview.outcome).toBe("TOO_MANY_ROWS");
    expect(many.report.issues.map((i) => i.code)).toEqual(["TOO_MANY_ROWS"]);
  });

  it("documents the intentional NO_ROWS difference (Preview accepts an empty file, offline FAILs)", async () => {
    const { preview, report } = await compare("JSON", "[]", ["Alpha"]);
    expect(preview.outcome).toBe("PREVIEWED");
    expect(report.issues.map((i) => i.code)).toEqual(["NO_ROWS"]);
  });
});

/**
 * Unit tests for `PostgresAnswerFeedbackContentRepository` against a fake
 * `SqlExecutor` (no real Postgres connection). This is the POST-SUBMIT-ONLY
 * counterpart to `learner-question-content-repository.test.ts`: that file
 * asserts `correct_answer`/`explanation` are NEVER selected on the pre-answer
 * path; this file asserts they ARE selected here, on purpose, by this
 * dedicated class only (UX-03-QA1 Finding 2/3).
 */
import { describe, expect, it, vi } from "vitest";

import { PostgresAnswerFeedbackContentRepository } from "../answer-feedback-content-repository";
import type { SqlExecutor } from "../sql-executor";

function fakeDb(rows: Record<string, unknown>[]) {
  const query = vi.fn(async (text: string, params?: readonly unknown[]) => {
    void text;
    void params;
    return { rows };
  });
  return { query } as unknown as SqlExecutor & { query: typeof query };
}

describe("PostgresAnswerFeedbackContentRepository", () => {
  it("selects correct_answer and explanation by exact questionVersionId", async () => {
    const db = fakeDb([{ correct_answer: ["a"], explanation: "כי אפשרות א' נכונה." }]);
    const repository = new PostgresAnswerFeedbackContentRepository(db);

    const result = await repository.findByVersionId("qv-1");

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sqlText, params] = db.query.mock.calls[0];
    expect(sqlText).toMatch(/correct_answer/i);
    expect(sqlText).toMatch(/explanation/i);
    expect(sqlText).toMatch(/where\s+id\s*=\s*\$1/i);
    expect(params).toEqual(["qv-1"]);
    expect(result).toEqual({ correctOptionIds: ["a"], explanation: "כי אפשרות א' נכונה." });
  });

  it("maps a null explanation column to null, not an empty string", async () => {
    const db = fakeDb([{ correct_answer: ["a", "b"], explanation: null }]);
    const repository = new PostgresAnswerFeedbackContentRepository(db);

    const result = await repository.findByVersionId("qv-1");

    expect(result).toEqual({ correctOptionIds: ["a", "b"], explanation: null });
  });

  it("throws (never silently returns empty feedback) when no row is found for the given id", async () => {
    const db = fakeDb([]);
    const repository = new PostgresAnswerFeedbackContentRepository(db);

    await expect(repository.findByVersionId("missing")).rejects.toThrow(/no question_versions row/);
  });
});

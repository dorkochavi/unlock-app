/**
 * Unit tests for `PostgresLearnerQuestionContentRepository` against a fake
 * `SqlExecutor` (no real Postgres connection). The most important
 * assertion here is security, not behavior: the exact SQL TEXT this
 * repository sends must never select `correct_answer` or `explanation` —
 * this test would fail immediately if a future edit widened the projection
 * (e.g. `select *`) or reintroduced either column.
 */
import { describe, expect, it, vi } from "vitest";

import { PostgresLearnerQuestionContentRepository } from "../learner-question-content-repository";
import type { SqlExecutor } from "../sql-executor";

function fakeDb(rows: Record<string, unknown>[]) {
  const query = vi.fn(async (text: string, params?: readonly unknown[]) => {
    void text;
    void params;
    return { rows };
  });
  return { query } as unknown as SqlExecutor & { query: typeof query };
}

describe("PostgresLearnerQuestionContentRepository", () => {
  it("SECURITY: the SQL text never selects correct_answer or explanation", async () => {
    const db = fakeDb([]);
    const repository = new PostgresLearnerQuestionContentRepository(db);

    await repository.findManyByVersionIds(["qv-1"]);

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sqlText] = db.query.mock.calls[0];
    expect(sqlText).not.toMatch(/correct_answer/i);
    expect(sqlText).not.toMatch(/explanation/i);
    expect(sqlText).not.toMatch(/select\s+\*/i);
  });

  it("queries by exact id list via = any($1), passing the ids through unchanged", async () => {
    const db = fakeDb([]);
    const repository = new PostgresLearnerQuestionContentRepository(db);

    await repository.findManyByVersionIds(["qv-1", "qv-2"]);

    const [sqlText, params] = db.query.mock.calls[0];
    expect(sqlText).toMatch(/=\s*any\(\$1\)/i);
    expect(params).toEqual([["qv-1", "qv-2"]]);
  });

  it("returns [] and never queries the database for an empty id list", async () => {
    const db = fakeDb([]);
    const repository = new PostgresLearnerQuestionContentRepository(db);

    const result = await repository.findManyByVersionIds([]);

    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("maps every returned row into a LearnerQuestionContent, in the order the query returned them", async () => {
    const db = fakeDb([
      {
        id: "qv-1",
        question_type: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
        answer_options: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
      },
      {
        id: "qv-2",
        question_type: "MULTIPLE_CHOICE",
        prompt: "Which are prime?",
        answer_options: [
          { id: "a", content: "2" },
          { id: "b", content: "4" },
        ],
      },
    ]);
    const repository = new PostgresLearnerQuestionContentRepository(db);

    const result = await repository.findManyByVersionIds(["qv-1", "qv-2"]);

    expect(result).toEqual([
      {
        questionVersionId: "qv-1",
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
        options: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
      },
      {
        questionVersionId: "qv-2",
        questionType: "MULTIPLE_CHOICE",
        prompt: "Which are prime?",
        options: [
          { id: "a", content: "2" },
          { id: "b", content: "4" },
        ],
      },
    ]);
  });

  it("never returns correct_answer/explanation even if the fake db row (misconfigured) carries them", async () => {
    const db = fakeDb([
      {
        id: "qv-1",
        question_type: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
        answer_options: [{ id: "a", content: "4" }],
        correct_answer: ["a"],
        explanation: "because 2+2=4",
      },
    ]);
    const repository = new PostgresLearnerQuestionContentRepository(db);

    const result = await repository.findManyByVersionIds(["qv-1"]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("correct_answer");
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("explanation");
  });
});

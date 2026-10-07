import { describe, expect, it } from "vitest";

import {
  deriveLearningRecap,
  type LearningRecapAttemptRow,
  type LearningRecapPlanItem,
} from "../derive-learning-recap";

const item = (id: string, status = "completed"): LearningRecapPlanItem => ({ id, status });
const row = (
  id: string,
  isCorrect: boolean,
  over: Partial<LearningRecapAttemptRow> = {},
): LearningRecapAttemptRow => ({
  dailyPlanItemId: id,
  isCorrect,
  confidenceLevel: null,
  topicId: null,
  topicName: null,
  topicArchived: false,
  ...over,
});

describe("deriveLearningRecap", () => {
  it("counts answered/correct/incorrect from attempts and skipped from item status (skip is not wrong)", () => {
    const recap = deriveLearningRecap(
      [item("a"), item("b"), item("c", "skipped"), item("d", "pending")],
      [row("a", true), row("b", false)],
    );
    expect(recap).toMatchObject({ answered: 2, correct: 1, incorrect: 1, skipped: 1 });
  });

  it("only-skipped plan: no answers, nothing wrong", () => {
    const recap = deriveLearningRecap([item("a", "skipped")], []);
    expect(recap).toMatchObject({ answered: 0, correct: 0, incorrect: 0, skipped: 1, topicsWorked: 0 });
  });

  it("topic status: strong when every answer is correct, revisit when any is incorrect", () => {
    const m = { topicId: "t1", topicName: "מטריצות" };
    const v = { topicId: "t2", topicName: "וקטורים" };
    const recap = deriveLearningRecap(
      [item("a"), item("b"), item("c"), item("d")],
      [row("a", true, m), row("b", true, m), row("c", true, v), row("d", false, v)],
    );
    expect(recap.strongTopics).toEqual(["מטריצות"]);
    expect(recap.revisitTopics).toEqual(["וקטורים"]);
    expect(recap.topicsWorked).toBe(2);
  });

  it("null / blank / archived topics count in totals but form no group and are never named", () => {
    const recap = deriveLearningRecap(
      [item("a"), item("b"), item("c")],
      [
        row("a", false),
        row("b", true, { topicId: "t1", topicName: "ישן", topicArchived: true }),
        row("c", true, { topicId: "t2", topicName: "  " }),
      ],
    );
    expect(recap).toMatchObject({ answered: 3, correct: 2, incorrect: 1, topicsWorked: 0 });
    expect(recap.strongTopics).toEqual([]);
    expect(recap.revisitTopics).toEqual([]);
  });

  it("confidence: only 'high' is sure; null/low/medium contribute to neither tally", () => {
    const recap = deriveLearningRecap(
      [item("a"), item("b"), item("c"), item("d"), item("e")],
      [
        row("a", false, { confidenceLevel: "high" }),
        row("b", true, { confidenceLevel: "high" }),
        row("c", true, { confidenceLevel: "high" }),
        row("d", false, { confidenceLevel: "low" }),
        row("e", true, { confidenceLevel: null }),
      ],
    );
    expect(recap.sureIncorrect).toBe(1);
    expect(recap.sureCorrect).toBe(2);
  });

  it("duplicate attempt rows for one item: earliest wins; rows for foreign items are ignored", () => {
    const recap = deriveLearningRecap(
      [item("a")],
      [row("a", true), row("a", false), row("not-in-plan", false)],
    );
    expect(recap).toMatchObject({ answered: 1, correct: 1, incorrect: 0 });
  });

  it("is deterministic and does not mutate its inputs", () => {
    const items = [item("a")];
    const attempts = [row("a", true, { topicId: "t", topicName: "נושא" })];
    const snapshot = JSON.stringify({ items, attempts });
    expect(deriveLearningRecap(items, attempts)).toEqual(deriveLearningRecap(items, attempts));
    expect(JSON.stringify({ items, attempts })).toBe(snapshot);
  });
});

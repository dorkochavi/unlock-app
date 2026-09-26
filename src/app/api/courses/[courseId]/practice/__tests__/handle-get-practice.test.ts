import { describe, expect, it, vi } from "vitest";

import { handleGetPractice, MAX_SKIP_IDS, parseSkipIds } from "../handle-get-practice";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC = "223e4567-e89b-12d3-a456-426614174000";
const Q1 = "323e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-03-10T10:00:00Z");

type Deps = Parameters<typeof handleGetPractice>[0];

function deps(over: Partial<Deps> = {}) {
  return {
    authenticate: async () => ({ outcome: "AUTHENTICATED" as const, userId: "user-1" }),
    courseId: COURSE,
    topicIdParam: null,
    skipParams: [],
    now: NOW,
    select: vi.fn(),
    ...over,
  } as Deps & { select: ReturnType<typeof vi.fn> };
}

describe("handleGetPractice", () => {
  it("401 when unauthenticated, before anything else (no select, no validation leak)", async () => {
    const d = deps({ authenticate: async () => ({ outcome: "UNAUTHENTICATED" }), courseId: "bad" });
    expect(await handleGetPractice(d)).toEqual({
      status: 401,
      body: { error: { code: "UNAUTHENTICATED" } },
    });
    expect(d.select).not.toHaveBeenCalled();
  });

  it("404 for a malformed courseId; 400 for malformed topicId/skip; never calls select", async () => {
    const cases: Array<[Partial<Deps>, number, string]> = [
      [{ courseId: "nope" }, 404, "COURSE_NOT_FOUND"],
      [{ topicIdParam: "nope" }, 400, "INVALID_REQUEST"],
      [{ skipParams: ["nope"] }, 400, "INVALID_REQUEST"],
      [{ skipParams: [Array(MAX_SKIP_IDS + 1).fill(Q1).join(",")] }, 400, "INVALID_REQUEST"],
    ];
    for (const [over, status, code] of cases) {
      const d = deps(over);
      expect(await handleGetPractice(d)).toEqual({ status, body: { error: { code } } });
      expect(d.select).not.toHaveBeenCalled();
    }
  });

  it("passes server-trusted identity and only the validated, de-duplicated hints", async () => {
    const d = deps({ topicIdParam: TOPIC, skipParams: [`${Q1},${Q1}`, ""] });
    d.select.mockResolvedValue({
      outcome: "READY",
      scope: { kind: "TOPIC", title: "נושא" },
      items: [],
      hasMore: false,
    });
    await handleGetPractice(d);
    expect(d.select).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: COURSE,
      topicId: TOPIC,
      skippedQuestionIds: [Q1],
      now: NOW,
    });
  });

  it("maps outcomes to stable statuses", async () => {
    const cases: Array<[string, number, string]> = [
      ["NOT_ELIGIBLE", 403, "PRACTICE_NOT_AVAILABLE"],
      ["TOPIC_NOT_FOUND", 404, "TOPIC_NOT_FOUND"],
      ["TIMEZONE_NOT_SET", 422, "TIMEZONE_NOT_SET"],
    ];
    for (const [outcome, status, code] of cases) {
      const d = deps();
      d.select.mockResolvedValue({ outcome });
      expect(await handleGetPractice(d)).toEqual({ status, body: { error: { code } } });
    }
  });

  it("READY returns a learner-safe DTO only: no correct answer, explanation or extra fields", async () => {
    const d = deps();
    d.select.mockResolvedValue({
      outcome: "READY",
      scope: { kind: "COURSE", title: "קורס" },
      hasMore: true,
      items: [
        {
          questionId: Q1,
          questionVersionId: "v1",
          questionType: "SINGLE_CHOICE",
          prompt: "?",
          options: [{ id: "A", content: "א", correct: true, extra: "leak" }],
          correctOptionIds: ["A"],
          explanation: "secret",
        },
      ],
    });
    const result = await handleGetPractice(d);
    expect(result).toEqual({
      status: 200,
      body: {
        scope: { kind: "COURSE", title: "קורס" },
        hasMore: true,
        items: [
          {
            questionId: Q1,
            questionVersionId: "v1",
            questionType: "SINGLE_CHOICE",
            prompt: "?",
            answerOptions: [{ id: "A", content: "א" }],
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|correct|leak/);
  });

  it("500 INTERNAL_ERROR without leaking details when select or authenticate throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps();
    d.select.mockRejectedValue(new Error("boom: postgres://secret"));
    const r = await handleGetPractice(d);
    expect(r).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(r)).not.toContain("secret");
    const r2 = await handleGetPractice(
      deps({
        authenticate: async () => {
          throw new Error("x");
        },
      }),
    );
    expect(r2.status).toBe(500);
    spy.mockRestore();
  });
});

describe("parseSkipIds", () => {
  it("accepts comma lists and repeated params, dedupes, rejects malformed", () => {
    expect(parseSkipIds([])).toEqual([]);
    expect(parseSkipIds([`${Q1},${TOPIC}`, Q1])).toEqual([Q1, TOPIC]);
    expect(parseSkipIds(["x"])).toBeNull();
  });
});

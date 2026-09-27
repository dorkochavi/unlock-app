import { describe, expect, it, vi } from "vitest";

import { handleSubmitPracticeAnswer } from "../handle-submit-practice-answer";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const Q = "323e4567-e89b-12d3-a456-426614174000";
const V = "423e4567-e89b-12d3-a456-426614174000";
const TOPIC = "223e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-03-10T10:00:00Z");
const good = { questionId: Q, questionVersionId: V, submissionId: "sub-1", selectedAnswer: "A" };

type Deps = Parameters<typeof handleSubmitPracticeAnswer>[0];

function deps(over: Partial<Deps> = {}) {
  return {
    authenticate: async () => ({ outcome: "AUTHENTICATED" as const, userId: "user-1" }),
    courseId: COURSE,
    body: good,
    now: NOW,
    submit: vi.fn(),
    getFeedbackContent: vi.fn(async () => ({ correctOptionIds: [], explanation: null })),
    ...over,
  } as Deps & { submit: ReturnType<typeof vi.fn>; getFeedbackContent: ReturnType<typeof vi.fn> };
}

describe("handleSubmitPracticeAnswer", () => {
  it("401 before body validation; submit never called", async () => {
    const d = deps({ authenticate: async () => ({ outcome: "UNAUTHENTICATED" }), body: null });
    expect(await handleSubmitPracticeAnswer(d)).toEqual({
      status: 401,
      body: { error: { code: "UNAUTHENTICATED" } },
    });
    expect(d.submit).not.toHaveBeenCalled();
  });

  it("404 for malformed courseId; 400 for every malformed body shape", async () => {
    expect((await handleSubmitPracticeAnswer(deps({ courseId: "x" }))).status).toBe(404);
    const bads: unknown[] = [
      null,
      "str",
      [],
      {},
      { ...good, questionId: "x" },
      { ...good, questionVersionId: 5 },
      { ...good, submissionId: "" },
      { ...good, submissionId: "s".repeat(129) },
      { ...good, topicId: "x" },
      { ...good, topicId: 3 },
      { ...good, responseTimeSeconds: -1 },
      { ...good, responseTimeSeconds: "5" },
      { ...good, selectedAnswer: 5 },
      { ...good, selectedAnswer: [1] },
      { questionId: Q, questionVersionId: V, submissionId: "s" }, // selectedAnswer absent
    ];
    for (const body of bads) {
      const d = deps({ body });
      expect(await handleSubmitPracticeAnswer(d)).toEqual({
        status: 400,
        body: { error: { code: "INVALID_REQUEST" } },
      });
      expect(d.submit).not.toHaveBeenCalled();
    }
  });

  it("client-supplied identity/session/time/confidence fields are ignored, never forwarded", async () => {
    const d = deps({
      body: {
        ...good,
        topicId: TOPIC,
        responseTimeSeconds: 7,
        userId: "attacker",
        learningSessionId: "forced",
        dailyPlanId: "p",
        dailyPlanItemId: "i",
        answeredAt: "1999-01-01T00:00:00Z",
        confidenceLevel: "high",
      },
    });
    d.submit.mockResolvedValue({ kind: "ACCEPTED", isCorrect: true, wasIdempotentRetry: false });
    await handleSubmitPracticeAnswer(d);
    expect(d.submit).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: COURSE,
      topicId: TOPIC,
      questionId: Q,
      questionVersionId: V,
      submissionId: "sub-1",
      selectedAnswer: "A",
      confidenceLevel: null,
      responseTimeSeconds: 7,
      now: NOW,
    });
  });

  it("maps non-ACCEPTED outcomes to stable 403/404/409/422/400, and never calls getFeedbackContent for any of them (SECURITY)", async () => {
    const table: Array<[Record<string, unknown>, number, unknown]> = [
      [{ kind: "NOT_ELIGIBLE" }, 403, { error: { code: "PRACTICE_NOT_AVAILABLE" } }],
      [{ kind: "NOT_IN_SCOPE" }, 404, { error: { code: "QUESTION_NOT_FOUND" } }],
      [{ kind: "PENDING_IN_TODAY" }, 409, { error: { code: "PENDING_IN_TODAY" } }],
      [{ kind: "QUESTION_UNAVAILABLE" }, 409, { error: { code: "QUESTION_UNAVAILABLE" } }],
      [{ kind: "IDEMPOTENCY_KEY_CONFLICT" }, 409, { error: { code: "SUBMISSION_ID_REUSED" } }],
      [{ kind: "TIMEZONE_NOT_SET" }, 422, { error: { code: "TIMEZONE_NOT_SET" } }],
      [
        { kind: "INVALID_SELECTED_ANSWER", reason: "unknown option zzz" },
        400,
        { error: { code: "INVALID_ANSWER" } },
      ],
    ];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [outcome, status, body] of table) {
      const d = deps();
      d.submit.mockResolvedValue(outcome);
      const r = await handleSubmitPracticeAnswer(d);
      expect(r).toEqual({ status, body });
      expect(JSON.stringify(r)).not.toContain("zzz");
      expect(d.getFeedbackContent).not.toHaveBeenCalled();
    }
    spy.mockRestore();
  });

  it("ACCEPTED -> 200 {isCorrect, correctOptionIds, explanation} from getFeedbackContent, keyed by the answered questionVersionId (UX-03-QA1 Finding 2/3)", async () => {
    const d = deps();
    d.submit.mockResolvedValue({ kind: "ACCEPTED", isCorrect: false, wasIdempotentRetry: true });
    d.getFeedbackContent.mockResolvedValue({
      correctOptionIds: ["opt-a"],
      explanation: "כי אפשרות א' נכונה.",
    });
    const r = await handleSubmitPracticeAnswer(d);
    expect(r).toEqual({
      status: 200,
      body: { isCorrect: false, correctOptionIds: ["opt-a"], explanation: "כי אפשרות א' נכונה." },
    });
    expect(d.getFeedbackContent).toHaveBeenCalledExactlyOnceWith(V);
  });

  it("500 INTERNAL_ERROR without leaking when submit throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps();
    d.submit.mockRejectedValue(new Error("select * from secret"));
    const r = await handleSubmitPracticeAnswer(d);
    expect(r).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(r)).not.toContain("secret");
    spy.mockRestore();
  });
});

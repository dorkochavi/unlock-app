/**
 * FUB-044 (401 during Answer) — product decision: a 401 means the selection was
 * NOT saved; it is never preserved, never replayed, and never counts as an Attempt.
 * The server side of "no Attempt on 401" is proven by the handler and
 * route-auth-db-ordering tests; this file locks the CLIENT side.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { submitDailyPlanItemAnswer } from "../submit-answer-api";

const BODY = { submissionId: "sub-1", selectedAnswer: "B", confidenceLevel: null };

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const respond = (status: number, body?: unknown) => async () => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => {
    if (body === undefined) throw new SyntaxError("no body");
    return body;
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitDailyPlanItemAnswer — 401", () => {
  it("maps 401 to UNAUTHENTICATED (never ACCEPTED, never a generic ERROR)", async () => {
    stubFetch(respond(401, { error: { code: "UNAUTHENTICATED" } }));
    await expect(submitDailyPlanItemAnswer("item-1", BODY)).resolves.toEqual({
      outcome: "UNAUTHENTICATED",
    });
  });

  it("sends exactly one request on 401: no automatic replay / resubmission", async () => {
    const fetchMock = stubFetch(respond(401, {}));
    await submitDailyPlanItemAnswer("item-1", BODY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a later explicit fresh answer follows the normal Answer path (new request, ACCEPTED)", async () => {
    const fetchMock = stubFetch(respond(401, {}));
    await expect(submitDailyPlanItemAnswer("item-1", BODY)).resolves.toEqual({
      outcome: "UNAUTHENTICATED",
    });

    fetchMock.mockImplementation(
      respond(200, { isCorrect: true, correctOptionIds: ["B"], explanation: "why" }),
    );
    const fresh = { ...BODY, submissionId: "sub-2", selectedAnswer: "C" };
    await expect(submitDailyPlanItemAnswer("item-1", fresh)).resolves.toEqual({
      outcome: "ACCEPTED",
      isCorrect: true,
      correctOptionIds: ["B"],
      explanation: "why",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/daily-plan/items/item-1/answer");
    // The second request carries ONLY the fresh selection and a fresh submissionId.
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(fresh);
  });
});

describe("submitDailyPlanItemAnswer — other outcomes unchanged", () => {
  it("maps 409 / 5xx / network failure", async () => {
    stubFetch(respond(409, {}));
    await expect(submitDailyPlanItemAnswer("i", BODY)).resolves.toEqual({
      outcome: "ALREADY_RESOLVED",
    });
    stubFetch(respond(500, {}));
    await expect(submitDailyPlanItemAnswer("i", BODY)).resolves.toEqual({ outcome: "ERROR" });
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(submitDailyPlanItemAnswer("i", BODY)).resolves.toEqual({ outcome: "ERROR" });
  });
});

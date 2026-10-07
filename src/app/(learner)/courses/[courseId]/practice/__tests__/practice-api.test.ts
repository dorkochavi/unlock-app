import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPracticeBatch,
  parsePracticeFrom,
  parsePracticeTopicId,
  practiceBatchUrl,
  practiceOriginHref,
  practicePath,
  submitPracticeAnswer,
} from "../practice-api";
import { buildSignInHref, resolveNextPathFromSearch } from "@/lib/safe-redirect";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC = "223e4567-e89b-12d3-a456-426614174000";
const Q = "323e4567-e89b-12d3-a456-426614174000";

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

describe("fetchPracticeBatch abort signal (Slice E)", () => {
  it("passes the AbortSignal to fetch and maps an abort to ERROR without throwing", async () => {
    const controller = new AbortController();
    const fn = stubFetch(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    const out = await fetchPracticeBatch(COURSE, null, [], controller.signal);
    expect(out).toEqual({ outcome: "ERROR" });
    expect((fn.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
    expect((fn.mock.calls[0][1] as RequestInit).method).toBe("GET");
  });
});

describe("origin / scope helpers", () => {
  it("only whitelisted origins are honored; anything else is the Course page", () => {
    expect(parsePracticeFrom("progress")).toBe("progress");
    expect(parsePracticeFrom("course")).toBe("course");
    expect(parsePracticeFrom("https://evil.example.com")).toBe("course");
    expect(parsePracticeFrom(null)).toBe("course");
    expect(practiceOriginHref(COURSE, "progress")).toBe("/progress");
    expect(practiceOriginHref(COURSE, "course")).toBe(`/courses/${COURSE}`);
  });

  it("topic ids must be uuid-shaped", () => {
    expect(parsePracticeTopicId(TOPIC)).toBe(TOPIC);
    expect(parsePracticeTopicId("../x")).toBeNull();
    expect(parsePracticeTopicId(null)).toBeNull();
  });

  it("practicePath matches the sign-in next= allowlist shape", () => {
    expect(practicePath(COURSE, null, "course")).toBe(`/courses/${COURSE}/practice?from=course`);
    expect(practicePath(COURSE, TOPIC, "progress")).toBe(
      `/courses/${COURSE}/practice?topic=${TOPIC}&from=progress`,
    );
  });

  it("batch URL carries scope and only the most recent 200 skipped ids", () => {
    expect(practiceBatchUrl(COURSE, null, [])).toBe(`/api/courses/${COURSE}/practice`);
    expect(practiceBatchUrl(COURSE, TOPIC, [Q])).toBe(
      `/api/courses/${COURSE}/practice?topicId=${TOPIC}&skip=${Q}`,
    );
    const many = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const url = new URL(practiceBatchUrl(COURSE, null, many), "http://x");
    const sent = url.searchParams.get("skip")!.split(",");
    expect(sent).toHaveLength(200);
    expect(sent[199]).toBe("id-249");
  });
});

describe("fetchPracticeBatch", () => {
  const batch = {
    scope: { kind: "COURSE", title: "קורס" },
    hasMore: true,
    items: [
      {
        questionId: Q,
        questionVersionId: "v1",
        questionType: "SINGLE_CHOICE",
        prompt: "?",
        answerOptions: [{ id: "a", content: "א" }],
        topicId: null,
      },
    ],
  };

  it("READY on a well-formed body", async () => {
    stubFetch(respond(200, batch));
    await expect(fetchPracticeBatch(COURSE, null, [])).resolves.toEqual({
      outcome: "READY",
      batch,
    });
  });

  it("maps 401 / 422 / 403 / 404 / 500", async () => {
    for (const [status, outcome] of [
      [401, "UNAUTHENTICATED"],
      [422, "TIMEZONE_NOT_SET"],
      [403, "UNAVAILABLE"],
      [404, "UNAVAILABLE"],
      [500, "ERROR"],
    ] as const) {
      stubFetch(respond(status, {}));
      await expect(fetchPracticeBatch(COURSE, null, [])).resolves.toEqual({ outcome });
    }
  });

  it("never rejects: network failure, unreadable body and malformed shapes are ERROR", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchPracticeBatch(COURSE, null, [])).resolves.toEqual({ outcome: "ERROR" });
    stubFetch(respond(200));
    await expect(fetchPracticeBatch(COURSE, null, [])).resolves.toEqual({ outcome: "ERROR" });
    for (const bad of [
      null,
      {},
      { ...batch, hasMore: "yes" },
      { ...batch, items: [{ questionId: Q }] },
      { ...batch, scope: { kind: "OTHER", title: "x" } },
    ]) {
      stubFetch(respond(200, bad));
      await expect(fetchPracticeBatch(COURSE, null, [])).resolves.toEqual({ outcome: "ERROR" });
    }
  });

  it("sends no identity or time — only the scope query", async () => {
    const fn = stubFetch(respond(200, batch));
    await fetchPracticeBatch(COURSE, TOPIC, [Q]);
    const [url] = fn.mock.calls[0];
    expect(url).toBe(`/api/courses/${COURSE}/practice?topicId=${TOPIC}&skip=${Q}`);
  });
});

describe("submitPracticeAnswer", () => {
  const body = {
    questionId: Q,
    questionVersionId: "v1",
    submissionId: "s1",
    selectedAnswer: "a",
    topicId: null,
    confidenceLevel: null,
  };

  it("ACCEPTED carries isCorrect + correctOptionIds/explanation (UX-03-QA1 Finding 2/3), defaulting to [] / null when the server omits them", async () => {
    stubFetch(respond(200, { isCorrect: false }));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({
      outcome: "ACCEPTED",
      isCorrect: false,
      correctOptionIds: [],
      explanation: null,
    });

    stubFetch(
      respond(200, {
        isCorrect: true,
        correctOptionIds: ["opt-a"],
        explanation: "כי אפשרות א' נכונה.",
      }),
    );
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({
      outcome: "ACCEPTED",
      isCorrect: true,
      correctOptionIds: ["opt-a"],
      explanation: "כי אפשרות א' נכונה.",
    });
  });

  it("maps 401, 403, 404 and the two neutral 409s; other 409s and 5xx are ERROR", async () => {
    stubFetch(respond(401, {}));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "UNAUTHENTICATED" });
    stubFetch(respond(403, {}));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "UNAVAILABLE" });
    stubFetch(respond(404, {}));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({
      outcome: "QUESTION_UNAVAILABLE",
    });
    for (const code of ["PENDING_IN_TODAY", "QUESTION_UNAVAILABLE"]) {
      stubFetch(respond(409, { error: { code } }));
      await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({
        outcome: "QUESTION_UNAVAILABLE",
      });
    }
    stubFetch(respond(409, { error: { code: "SUBMISSION_ID_REUSED" } }));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "ERROR" });
    stubFetch(respond(500, {}));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "ERROR" });
  });

  it("never rejects on network failure or a malformed 200 body", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "ERROR" });
    stubFetch(respond(200, { isCorrect: "yes" }));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "ERROR" });
  });

  it("RUN010-G / OQ-014: forwards a real confidenceLevel in the request body verbatim", async () => {
    const fn = stubFetch(respond(200, { isCorrect: true }));
    await submitPracticeAnswer(COURSE, { ...body, confidenceLevel: "high" });
    const [, init] = fn.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      confidenceLevel: "high",
    });
  });
});

describe("401 during a Practice answer (FUB-044)", () => {
  const body = {
    questionId: Q,
    questionVersionId: "423e4567-e89b-12d3-a456-426614174000",
    submissionId: "sub-1",
    selectedAnswer: "B",
    topicId: null,
    confidenceLevel: null,
  };

  it("sends exactly one request on 401: no automatic replay", async () => {
    const fetchMock = stubFetch(respond(401, {}));
    await expect(submitPracticeAnswer(COURSE, body)).resolves.toEqual({ outcome: "UNAUTHENTICATED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a later explicit fresh answer is a new request carrying only the fresh selection", async () => {
    const fetchMock = stubFetch(respond(401, {}));
    await submitPracticeAnswer(COURSE, body);
    fetchMock.mockImplementation(
      respond(200, { isCorrect: true, correctOptionIds: ["C"], explanation: null }),
    );
    const fresh = { ...body, submissionId: "sub-2", selectedAnswer: "C" };
    await expect(submitPracticeAnswer(COURSE, fresh)).resolves.toMatchObject({ outcome: "ACCEPTED" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual(fresh);
  });

  it.each([
    [null, "course"],
    [TOPIC, "course"],
    [null, "progress"],
    [TOPIC, "progress"],
  ] as const)(
    "the sign-in link returns to the same Practice scope (topic=%s, from=%s) via the existing allowlist",
    (topicId, from) => {
      const path = practicePath(COURSE, topicId, from);
      const href = buildSignInHref(path);
      expect(href).toBe(`/login?next=${encodeURIComponent(path)}`);
      expect(resolveNextPathFromSearch(href.slice(href.indexOf("?")))).toBe(path);
    },
  );
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { publishQuestionsSequentially } from "../bulk-publish";

const COURSE = "course-1";

const res = (status: number) => ({ status, ok: status >= 200 && status < 300 });

afterEach(() => vi.restoreAllMocks());

describe("publishQuestionsSequentially (FUB-044)", () => {
  it("publishes every id and counts non-401 failures as before", async () => {
    const fetchFn = vi.fn(async (url: string) => (url.includes("/q2/") ? res(400) : res(200)));
    const out = await publishQuestionsSequentially(COURSE, ["q1", "q2", "q3"], fetchFn as unknown as typeof fetch);
    expect(out).toEqual({ published: 2, failed: 1, sessionExpired: false });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn).toHaveBeenNthCalledWith(1, "/api/courses/course-1/questions/q1/publish", { method: "POST" });
  });

  it("stops at the FIRST 401: no further requests, unattempted ids are not counted as failed", async () => {
    const fetchFn = vi.fn(async (url: string) => (url.includes("/q2/") ? res(401) : res(200)));
    const out = await publishQuestionsSequentially(COURSE, ["q1", "q2", "q3", "q4"], fetchFn as unknown as typeof fetch);
    expect(out).toEqual({ published: 1, failed: 0, sessionExpired: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("a 401 on the very first id issues exactly one request", async () => {
    const fetchFn = vi.fn(async () => res(401));
    const out = await publishQuestionsSequentially(COURSE, ["q1", "q2"], fetchFn as unknown as typeof fetch);
    expect(out).toEqual({ published: 0, failed: 0, sessionExpired: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("network errors still count as failed and do not stop the loop", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/q1/")) throw new TypeError("Failed to fetch");
      return res(200);
    });
    const out = await publishQuestionsSequentially(COURSE, ["q1", "q2"], fetchFn as unknown as typeof fetch);
    expect(out).toEqual({ published: 1, failed: 1, sessionExpired: false });
  });
});

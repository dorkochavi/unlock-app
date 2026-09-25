import { describe, expect, it, vi } from "vitest";

import { getMessages } from "@/messages";

import { LEARNER_NAV_ITEMS } from "../../nav-items";
import { loadProgress, type FetchFn, type TopicProgressDto } from "../load-progress";

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const COURSE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const topic = (overrides: Partial<TopicProgressDto> = {}): TopicProgressDto => ({
  topicId: "t-1",
  name: "Algebra",
  state: "IN_PROGRESS",
  attemptedCount: 2,
  totalCount: 5,
  ...overrides,
});

/** Routes by URL; anything unmapped is a test bug. */
function fakeFetch(routes: Record<string, () => Response | Promise<Response>>): {
  fetchFn: FetchFn;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (url) => {
    calls.push(url);
    const route = routes[url];
    if (route === undefined) throw new Error(`unexpected fetch: ${url}`);
    return route();
  };
  return { fetchFn, calls };
}

const mine = (courses: Array<{ id: string; title: string; role: string }>) => () =>
  json(200, { courses });

describe("learner nav", () => {
  it("has Today, Courses and Progress, in that order, with the existing paths intact", () => {
    expect(LEARNER_NAV_ITEMS.map((item) => [item.href, item.labelKey])).toEqual([
      ["/today", "today"],
      ["/courses", "courses"],
      ["/progress", "progress"],
    ]);
  });

  it("every nav item has a Hebrew label", () => {
    const nav = getMessages().shell.nav;
    for (const item of LEARNER_NAV_ITEMS) {
      expect(nav[item.labelKey]).toBeTruthy();
    }
    expect(nav.progress).toBe("התקדמות");
  });
});

describe("loadProgress — composition", () => {
  it("multiple active Courses: one list request, then one S1 request per learner Course", async () => {
    const { fetchFn, calls } = fakeFetch({
      "/api/courses/mine": mine([
        { id: COURSE_A, title: "Course A", role: "LEARNER" },
        { id: COURSE_B, title: "Course B", role: "LEARNER" },
      ]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () =>
        json(200, { topics: [topic({ state: "SOLID" })] }),
      [`/api/courses/${COURSE_B}/topic-progress`]: () =>
        json(200, { topics: [topic({ topicId: "t-2", name: "Geometry", state: "NOT_STARTED", attemptedCount: 0 })] }),
    });

    const result = await loadProgress(fetchFn);

    expect(result).toEqual({
      outcome: "READY",
      courses: [
        { id: COURSE_A, title: "Course A", progress: { kind: "ready", topics: [topic({ state: "SOLID" })] } },
        {
          id: COURSE_B,
          title: "Course B",
          progress: {
            kind: "ready",
            topics: [topic({ topicId: "t-2", name: "Geometry", state: "NOT_STARTED", attemptedCount: 0 })],
          },
        },
      ],
    });
    expect(calls).toHaveLength(3);
    expect(calls[0]).toBe("/api/courses/mine");
  });

  it("one active Course", async () => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "Only", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () => json(200, { topics: [topic()] }),
    });
    const result = await loadProgress(fetchFn);
    expect(result.outcome === "READY" && result.courses).toHaveLength(1);
  });

  it("no active Courses: READY with an empty list and no per-Course request", async () => {
    const { fetchFn, calls } = fakeFetch({ "/api/courses/mine": mine([]) });
    expect(await loadProgress(fetchFn)).toEqual({ outcome: "READY", courses: [] });
    expect(calls).toEqual(["/api/courses/mine"]);
  });

  it("drops OWNER/INSTRUCTOR entries (the S1 endpoint is learner-only) without requesting them", async () => {
    const { fetchFn, calls } = fakeFetch({
      "/api/courses/mine": mine([
        { id: COURSE_A, title: "Teaching", role: "OWNER" },
        { id: COURSE_B, title: "Assisting", role: "INSTRUCTOR" },
        { id: COURSE_C, title: "Learning", role: "LEARNER" },
      ]),
      [`/api/courses/${COURSE_C}/topic-progress`]: () => json(200, { topics: [] }),
    });
    const result = await loadProgress(fetchFn);
    expect(result.outcome === "READY" && result.courses.map((c) => c.id)).toEqual([COURSE_C]);
    expect(calls).not.toContain(`/api/courses/${COURSE_A}/topic-progress`);
    expect(calls).not.toContain(`/api/courses/${COURSE_B}/topic-progress`);
  });

  it("uses only the session: no user id in any request URL", async () => {
    const { fetchFn, calls } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () => json(200, { topics: [] }),
    });
    await loadProgress(fetchFn);
    expect(calls.join(" ")).not.toMatch(/userId|user_id|\?/);
  });

  it("requests each Course's progress uncached", async () => {
    const seen: Array<RequestInit | { cache?: string } | undefined> = [];
    const fetchFn: FetchFn = async (url, init) => {
      seen.push(init);
      if (url === "/api/courses/mine") return mine([{ id: COURSE_A, title: "A", role: "LEARNER" }])();
      return json(200, { topics: [] });
    };
    await loadProgress(fetchFn);
    expect(seen[1]).toEqual({ cache: "no-store" });
  });
});

describe("loadProgress — the four learner states pass through unchanged", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS", "NEEDS_REINFORCEMENT", "SOLID"] as const)(
    "%s",
    async (state) => {
      const { fetchFn } = fakeFetch({
        "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
        [`/api/courses/${COURSE_A}/topic-progress`]: () => json(200, { topics: [topic({ state })] }),
      });
      const result = await loadProgress(fetchFn);
      if (result.outcome !== "READY" || result.courses[0].progress.kind !== "ready") {
        throw new Error("expected ready");
      }
      expect(result.courses[0].progress.topics[0].state).toBe(state);
    },
  );

  it("Hebrew labels are the frozen Plan terms, with no percentage or score wording", () => {
    const { state, coverage } = getMessages().progress;
    expect(state).toEqual({
      NOT_STARTED: "לא התחלת",
      IN_PROGRESS: "בתהליך",
      NEEDS_REINFORCEMENT: "דורש חיזוק",
      SOLID: "מבוסס",
    });
    expect(coverage).toContain("{attempted}");
    expect(coverage).toContain("{total}");
    expect(JSON.stringify(getMessages().progress)).not.toMatch(/%|אחוז|ציון|רצף/);
  });

  it("coverage is a plain count: the DTO the page renders has no percentage or score field", async () => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () => json(200, { topics: [topic()] }),
    });
    const result = await loadProgress(fetchFn);
    if (result.outcome !== "READY" || result.courses[0].progress.kind !== "ready") {
      throw new Error("expected ready");
    }
    expect(Object.keys(result.courses[0].progress.topics[0]).sort()).toEqual(
      ["attemptedCount", "name", "state", "topicId", "totalCount"].sort(),
    );
  });
});

describe("loadProgress — empty and unavailable states stay distinct", () => {
  it("a Course with topics: [] is ready-with-no-topics, not NOT_STARTED", async () => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () => json(200, { topics: [] }),
    });
    const result = await loadProgress(fetchFn);
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.courses[0].progress).toEqual({ kind: "ready", topics: [] });
    // A Topic the learner has not started is a different, non-empty thing.
    const started = await loadProgress(
      fakeFetch({
        "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
        [`/api/courses/${COURSE_A}/topic-progress`]: () =>
          json(200, { topics: [topic({ state: "NOT_STARTED", attemptedCount: 0 })] }),
      }).fetchFn,
    );
    if (started.outcome !== "READY") throw new Error("expected READY");
    expect(started.courses[0].progress).not.toEqual(result.courses[0].progress);
  });

  it("409 COURSE_NOT_ACTIVE -> explicit unavailable (not an error, not dropped)", async () => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "Archived-by-instructor", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () =>
        json(409, { error: { code: "COURSE_NOT_ACTIVE" } }),
    });
    expect(await loadProgress(fetchFn)).toEqual({
      outcome: "READY",
      courses: [{ id: COURSE_A, title: "Archived-by-instructor", progress: { kind: "unavailable" } }],
    });
  });

  it.each([
    ["500", () => json(500, { error: { code: "INTERNAL_ERROR" } })],
    ["403", () => json(403, { error: { code: "NOT_AUTHORIZED" } })],
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["malformed body", () => json(200, { nope: true })],
    ["unknown state", () => json(200, { topics: [{ ...topic(), state: "MASTERED" }] })],
  ])("per-Course %s -> generic error for that Course only", async (_label, route) => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([
        { id: COURSE_A, title: "A", role: "LEARNER" },
        { id: COURSE_B, title: "B", role: "LEARNER" },
      ]),
      [`/api/courses/${COURSE_A}/topic-progress`]: route,
      [`/api/courses/${COURSE_B}/topic-progress`]: () => json(200, { topics: [topic()] }),
    });
    const result = await loadProgress(fetchFn);
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.courses[0].progress).toEqual({ kind: "error" });
    expect(result.courses[1].progress.kind).toBe("ready");
  });

  it("list-level failures: 401 -> UNAUTHENTICATED; 500/network/malformed -> ERROR", async () => {
    expect(
      await loadProgress(fakeFetch({ "/api/courses/mine": () => json(401, {}) }).fetchFn),
    ).toEqual({ outcome: "UNAUTHENTICATED" });
    expect(
      await loadProgress(fakeFetch({ "/api/courses/mine": () => json(500, {}) }).fetchFn),
    ).toEqual({ outcome: "ERROR" });
    expect(
      await loadProgress(
        fakeFetch({ "/api/courses/mine": () => Promise.reject(new Error("offline")) }).fetchFn,
      ),
    ).toEqual({ outcome: "ERROR" });
    expect(
      await loadProgress(fakeFetch({ "/api/courses/mine": () => json(200, { courses: "x" }) }).fetchFn),
    ).toEqual({ outcome: "ERROR" });
  });

  it("a per-Course 401 (session expired mid-load) -> page-level UNAUTHENTICATED", async () => {
    const { fetchFn } = fakeFetch({
      "/api/courses/mine": mine([{ id: COURSE_A, title: "A", role: "LEARNER" }]),
      [`/api/courses/${COURSE_A}/topic-progress`]: () => json(401, {}),
    });
    expect(await loadProgress(fetchFn)).toEqual({ outcome: "UNAUTHENTICATED" });
  });
});

describe("loadProgress — discoverability", () => {
  it("only Courses returned by the existing active listing are ever requested (no archived path)", async () => {
    const requested = vi.fn();
    const fetchFn: FetchFn = async (url) => {
      requested(url);
      if (url === "/api/courses/mine") {
        // The active listing already excludes archived memberships; an archived
        // membership's Course is simply absent, and S2 never goes looking for it.
        return mine([{ id: COURSE_A, title: "Active", role: "LEARNER" }])();
      }
      return json(200, { topics: [] });
    };
    await loadProgress(fetchFn);
    expect(requested.mock.calls.map((c) => c[0])).toEqual([
      "/api/courses/mine",
      `/api/courses/${COURSE_A}/topic-progress`,
    ]);
  });
});

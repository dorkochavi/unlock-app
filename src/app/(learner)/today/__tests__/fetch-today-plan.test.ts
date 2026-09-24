import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTodayPlan, persistDetectedTimezone } from "../fetch-today-plan";

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTodayPlan", () => {
  it("maps a network failure (fetch rejects) to ERROR instead of rejecting", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "ERROR" });
  });

  it("maps an unreadable 200 body to ERROR", async () => {
    stubFetch(async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    }));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "ERROR" });
  });

  it("maps 401 / 422 / 500 to their outcomes", async () => {
    stubFetch(async () => ({ status: 401, ok: false }));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "UNAUTHENTICATED" });
    stubFetch(async () => ({ status: 422, ok: false }));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "TIMEZONE_NOT_SET" });
    stubFetch(async () => ({ status: 500, ok: false }));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "ERROR" });
  });

  it("returns READY with the plan on success", async () => {
    const plan = { items: [] };
    stubFetch(async () => ({ status: 200, ok: true, json: async () => ({ plan }) }));
    await expect(fetchTodayPlan()).resolves.toEqual({ outcome: "READY", plan });
  });
});

describe("persistDetectedTimezone", () => {
  it("returns false when fetch rejects", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(persistDetectedTimezone()).resolves.toBe(false);
  });

  it("returns response.ok otherwise", async () => {
    stubFetch(async () => ({ ok: true }));
    await expect(persistDetectedTimezone()).resolves.toBe(true);
    stubFetch(async () => ({ ok: false }));
    await expect(persistDetectedTimezone()).resolves.toBe(false);
  });
});

/**
 * Auth-before-DB ordering for `GET /api/courses/:courseId/practice`. Mocks
 * only the infrastructure modules `route.ts` imports and calls the REAL
 * `GET`, so a regression that builds the pool/ports before authentication
 * fails here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  createProductionPracticePorts: vi.fn(),
  createProductionPracticeSettings: vi.fn(),
  selectPracticeBatch: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/infrastructure/postgres/pg-pool", () => ({ getPool: mocks.getPool }));
vi.mock("@/infrastructure/postgres/pg-connection-provider", () => ({
  PgConnectionProvider: mocks.PgConnectionProvider,
}));
vi.mock("@/infrastructure/practice/composition-root", () => ({
  createProductionPracticePorts: mocks.createProductionPracticePorts,
  createProductionPracticeSettings: mocks.createProductionPracticeSettings,
}));
vi.mock("@/application/practice/select-practice-batch", () => ({
  selectPracticeBatch: mocks.selectPracticeBatch,
}));

import { GET } from "../route";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC = "223e4567-e89b-12d3-a456-426614174000";
const Q1 = "323e4567-e89b-12d3-a456-426614174000";
const params = (courseId = COURSE) => ({ params: Promise.resolve({ courseId }) });
const request = (query = "") =>
  new Request(`http://localhost/api/courses/${COURSE}/practice${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseServerClient.mockResolvedValue({});
});

describe("GET practice route ordering", () => {
  it("unauthenticated: 401, no pool/ports/select", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const response = await GET(request(), params());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.createProductionPracticePorts).not.toHaveBeenCalled();
    expect(mocks.selectPracticeBatch).not.toHaveBeenCalled();
  });

  it("authenticated but malformed query/courseId: 400/404 with no DB construction", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    expect((await GET(request("?topicId=nope"), params())).status).toBe(400);
    expect((await GET(request("?skip=nope"), params())).status).toBe(400);
    expect((await GET(request(), params("nope"))).status).toBe(404);
    expect(mocks.getPool).not.toHaveBeenCalled();
  });

  it("authenticated + well-formed: wiring reached with trusted identity, scope and hints; response is no-store", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    mocks.getPool.mockReturnValue({ marker: "pool" });
    mocks.selectPracticeBatch.mockResolvedValue({
      outcome: "READY",
      scope: { kind: "TOPIC", title: "t" },
      items: [],
      hasMore: false,
    });

    const response = await GET(request(`?topicId=${TOPIC}&skip=${Q1}&userId=attacker`), params());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.selectPracticeBatch.mock.calls[0];
    expect(command).toMatchObject({
      userId: "u1",
      courseId: COURSE,
      topicId: TOPIC,
      skippedQuestionIds: [Q1],
    });
    expect(command.now).toBeInstanceOf(Date);
  });

  it("DB construction failure: 500 INTERNAL_ERROR, no secret leaked", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    mocks.getPool.mockImplementation(() => {
      throw new Error("postgres://secret-user:hunter2@host/db");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request(), params());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    spy.mockRestore();
  });

  it("failure before authentication (client creation): 500, auth and DB never reached", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(new Error("missing env"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request(), params());
    expect(response.status).toBe(500);
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

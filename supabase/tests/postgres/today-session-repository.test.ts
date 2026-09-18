/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresTodaySessionRepository` (Phase 9).
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  TodaySession,
  TodaySessionItem,
} from "../../../src/application/learning/ports";
import { PostgresTodaySessionRepository } from "../../../src/infrastructure/postgres/today-session-repository";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;
let repo: PostgresTodaySessionRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresTodaySessionRepository(db);
});

afterEach(async () => {
  await db.close();
});

async function seedSessionInputs() {
  const userId = await insertUser(db);
  const courseId = await insertCourse(db, userId);
  const questionId = await insertQuestion(db, courseId);
  const versionId = await insertQuestionVersion(db, questionId);
  await setCurrentVersion(db, questionId, versionId);

  const session: Omit<TodaySession, "items" | "id"> = {
    userId,
    courseId,
    plannedForDate: "2026-01-10",
    status: "prepared",
    engineVersion: "test-engine-v1",
    generatedAt: new Date("2026-01-10T08:00:00Z"),
    startedAt: null,
    completedAt: null,
  };
  const items: Array<Omit<TodaySessionItem, "id" | "todaySessionId">> = [
    {
      userId,
      position: 0,
      questionId,
      questionVersionId: versionId,
      actionType: "REVIEW_DUE",
      tier: "DUE_REVIEW",
      otherApplicableTypes: ["STRENGTHEN_MEMORY"],
      reasons: ["SCHEDULED_REVIEW_DUE"],
      status: "pending",
      completedAt: null,
    },
  ];

  return { userId, courseId, questionId, versionId, session, items };
}

describe("PostgresTodaySessionRepository", () => {
  it("findByKey returns null when no session exists yet", async () => {
    const { userId, courseId } = await seedSessionInputs();
    expect(
      await repo.findByKey({ userId, courseId, plannedForDate: "2026-01-10" }),
    ).toBeNull();
  });

  it("createIfNotExists persists the session and every frozen item field exactly", async () => {
    const { session, items } = await seedSessionInputs();

    const created = await repo.createIfNotExists(session, items);

    expect(created.userId).toBe(session.userId);
    expect(created.courseId).toBe(session.courseId);
    expect(created.plannedForDate).toBe(session.plannedForDate);
    expect(created.status).toBe(session.status);
    expect(created.items).toHaveLength(1);
    expect(created.items[0]).toMatchObject({
      todaySessionId: created.id,
      position: 0,
      questionId: items[0].questionId,
      questionVersionId: items[0].questionVersionId,
      actionType: "REVIEW_DUE",
      tier: "DUE_REVIEW",
      otherApplicableTypes: ["STRENGTHEN_MEMORY"],
      reasons: ["SCHEDULED_REVIEW_DUE"],
      status: "pending",
      completedAt: null,
    });
  });

  it("findByKey resumes the exact same session after creation", async () => {
    const { session, items } = await seedSessionInputs();
    const created = await repo.createIfNotExists(session, items);

    const resumed = await repo.findByKey({
      userId: session.userId,
      courseId: session.courseId,
      plannedForDate: session.plannedForDate,
    });

    expect(resumed).toEqual(created);
  });

  it("createIfNotExists called again for the SAME key returns the EXISTING session, discarding the new items argument entirely (resume, not regenerate)", async () => {
    const { session, items, questionId, versionId, userId } = await seedSessionInputs();
    const first = await repo.createIfNotExists(session, items);

    // A second call with a DIFFERENT plan (different action/tier/position)
    // for the same (user, course, date) key.
    const differentItems: Array<Omit<TodaySessionItem, "id" | "todaySessionId">> = [
      {
        userId,
        position: 0,
        questionId,
        questionVersionId: versionId,
        actionType: "RELEARN_LAPSE",
        tier: "REMEDIATION",
        otherApplicableTypes: [],
        reasons: ["MISCONCEPTION_ACTIVE"],
        status: "pending",
        completedAt: null,
      },
    ];

    const second = await repo.createIfNotExists(session, differentItems);

    expect(second).toEqual(first);
    expect(second.items[0].actionType).toBe("REVIEW_DUE"); // the ORIGINAL plan, not the new one

    const countResult = await db.query<{ count: string }>(
      "select count(*)::int as count from today_sessions where user_id = $1 and course_id = $2 and planned_for_date = $3",
      [session.userId, session.courseId, session.plannedForDate],
    );
    expect(Number(countResult.rows[0].count)).toBe(1);
  });

  it("findItemById returns null when absent, and the item when present", async () => {
    const { session, items } = await seedSessionInputs();
    expect(await repo.findItemById(randomUUID())).toBeNull();

    const created = await repo.createIfNotExists(session, items);
    expect(await repo.findItemById(created.items[0].id)).toEqual(created.items[0]);
  });

  it("markItemCompleted sets status and completedAt, and leaves frozen fields untouched", async () => {
    const { session, items } = await seedSessionInputs();
    const created = await repo.createIfNotExists(session, items);
    const completedAt = new Date("2026-01-10T09:00:00Z");

    await repo.markItemCompleted(created.items[0].id, completedAt, randomUUID());

    const updated = await repo.findItemById(created.items[0].id);
    expect(updated?.status).toBe("completed");
    expect(updated?.completedAt).toEqual(completedAt);
    expect(updated?.actionType).toBe(created.items[0].actionType);
    expect(updated?.position).toBe(created.items[0].position);
  });

  it("markItemCompleted throws for a nonexistent item id rather than silently succeeding", async () => {
    await expect(
      repo.markItemCompleted(randomUUID(), new Date(), randomUUID()),
    ).rejects.toThrow(/no today_session_items row found/);
  });
});

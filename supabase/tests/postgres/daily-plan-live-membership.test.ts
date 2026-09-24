/**
 * F-04a — live membership authorization for answering/skipping an EXISTING
 * DailyPlan item, against the REAL Postgres repositories (PGlite).
 *
 * A membership revoked AFTER the plan was generated must stop the learner
 * from mutating that plan's items (ADR-015 §7). A learner-archived
 * membership keeps access (ADR-015 §7/§9), so it must NOT block.
 *
 * F-04b (Course PUBLISHED -> ARCHIVED after generation) is deliberately
 * NOT decided here: one test pins that this slice leaves Course status out
 * of the decision.
 *
 * PGlite is single-connection: this proves the check-then-write ordering,
 * not a revoke-vs-answer race (a revoke committing between the membership
 * read and the write can let that one in-flight request through).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { skipDailyPlanItem } from "../../../src/application/dailyPlan/skip-daily-plan-item";
import { submitDailyPlanItemAnswer } from "../../../src/application/dailyPlan/submit-daily-plan-item-answer";
import { createProductionSubmitAnswerContext } from "../../../src/infrastructure/learning/composition-root";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import {
  createTestDb,
  insertCourseMembership,
  insertUser,
  pgliteConnectionProvider,
  seedDailyPlanWithItem,
  seedQuestionChain,
} from "./db-harness";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

async function seed(
  membership: { revokedAt?: Date | null; archivedAt?: Date | null; role?: "LEARNER" | "OWNER" | "INSTRUCTOR" } | null,
) {
  const chain = await seedQuestionChain(db);
  if (membership !== null) {
    await insertCourseMembership(db, { userId: chain.userId, courseId: chain.courseId, ...membership });
  }
  const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);
  return { chain, dailyPlanId, dailyPlanItemId };
}

function answer(userId: string, dailyPlanItemId: string) {
  return submitDailyPlanItemAnswer(
    {
      userId,
      dailyPlanItemId,
      submissionId: `sub-${dailyPlanItemId}`,
      selectedAnswer: "A",
      confidenceLevel: null,
      responseTimeSeconds: 3,
      assistanceUsed: "NONE",
      answerWasRevealedBeforeResponse: false,
      answeredAt: NOW,
    },
    {
      items: new PostgresDailyPlanRepository(db),
      memberships: new PostgresCourseMembershipRepository(db),
      context: createProductionSubmitAnswerContext(NOW),
      uow: new PostgresUnitOfWork(pgliteConnectionProvider(db)),
    },
  );
}

function skip(userId: string, dailyPlanItemId: string) {
  return skipDailyPlanItem(
    { userId, dailyPlanItemId, skippedAt: NOW },
    {
      dailyPlanItems: new PostgresDailyPlanRepository(db),
      memberships: new PostgresCourseMembershipRepository(db),
    },
  );
}

async function assertUntouched(userId: string, dailyPlanId: string, dailyPlanItemId: string) {
  const item = await db.query<{ status: string; resolved_at: string | null; completed_at: string | null }>(
    "select status, resolved_at, completed_at from daily_plan_items where id = $1",
    [dailyPlanItemId],
  );
  expect(item.rows).toHaveLength(1);
  expect(item.rows[0]).toEqual({ status: "pending", resolved_at: null, completed_at: null });

  const items = await db.query("select id from daily_plan_items where daily_plan_id = $1", [dailyPlanId]);
  expect(items.rows).toHaveLength(1);
  const plan = await db.query("select id from daily_plans where id = $1", [dailyPlanId]);
  expect(plan.rows).toHaveLength(1);

  expect((await db.query("select id from attempts where user_id = $1", [userId])).rows).toHaveLength(0);
  expect(
    (await db.query("select user_id from user_question_progress where user_id = $1", [userId])).rows,
  ).toHaveLength(0);
}

describe("F-04a: live LEARNER membership guard on existing DailyPlan items", () => {
  it("active learner can answer an existing item", async () => {
    const { chain, dailyPlanItemId } = await seed({});
    const result = await answer(chain.userId, dailyPlanItemId);
    expect(result.kind).toBe("ACCEPTED");
  });

  it("active learner can skip an existing item", async () => {
    const { chain, dailyPlanItemId } = await seed({});
    expect((await skip(chain.userId, dailyPlanItemId)).kind).toBe("SKIPPED");
  });

  it("revoked after plan generation: answer denied, plan/item/Attempt/progress untouched", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed({});
    await new PostgresCourseMembershipRepository(db).revoke(chain.userId, chain.courseId, NOW);

    const result = await answer(chain.userId, dailyPlanItemId);

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("revoked after plan generation: skip denied, plan/item/Attempt/progress untouched", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed({});
    await new PostgresCourseMembershipRepository(db).revoke(chain.userId, chain.courseId, NOW);

    const result = await skip(chain.userId, dailyPlanItemId);

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("no membership row at all: answer and skip denied", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed(null);
    expect((await answer(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect((await skip(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("non-LEARNER role (e.g. INSTRUCTOR): answer and skip denied", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed({ role: "INSTRUCTOR" });
    expect((await answer(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect((await skip(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("learner-ARCHIVED (not revoked) membership keeps access per ADR-015 §7/§9: answer and skip still allowed", async () => {
    const a = await seed({ archivedAt: NOW });
    expect((await answer(a.chain.userId, a.dailyPlanItemId)).kind).toBe("ACCEPTED");

    const b = await seed({ archivedAt: NOW });
    expect((await skip(b.chain.userId, b.dailyPlanItemId)).kind).toBe("SKIPPED");
  });

  it("revoked AND archived: still denied (revoke wins)", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed({ revokedAt: NOW, archivedAt: NOW });
    expect((await answer(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect((await skip(chain.userId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("unrelated learner (own active membership, not the item owner) cannot answer or skip", async () => {
    const { chain, dailyPlanId, dailyPlanItemId } = await seed({});
    const otherUserId = await insertUser(db);
    await insertCourseMembership(db, { userId: otherUserId, courseId: chain.courseId });

    expect((await answer(otherUserId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect((await skip(otherUserId, dailyPlanItemId)).kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    await assertUntouched(chain.userId, dailyPlanId, dailyPlanItemId);
  });

  it("F-04b stays open: Course status is NOT consulted — an ARCHIVED Course with an active membership does not change answer/skip behavior in this slice", async () => {
    const a = await seed({});
    await db.query("update courses set status = 'ARCHIVED' where id = $1", [a.chain.courseId]);
    expect((await answer(a.chain.userId, a.dailyPlanItemId)).kind).toBe("ACCEPTED");

    const b = await seed({});
    await db.query("update courses set status = 'ARCHIVED' where id = $1", [b.chain.courseId]);
    expect((await skip(b.chain.userId, b.dailyPlanItemId)).kind).toBe("SKIPPED");
  });
});

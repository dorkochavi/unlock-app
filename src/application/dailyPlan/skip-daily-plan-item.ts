/**
 * Skip use case (ADR-016, Night-Run Slice 3) — the application-layer entry
 * point behind `POST /api/daily-plan/items/:itemId/skip`.
 *
 * Deliberately much smaller than `submitAnswer`/`submitDailyPlanItemAnswer`:
 * Skip never creates an Attempt, never reads/writes `UserQuestionProgress`,
 * never touches the scheduler/mastery/misconception state, and therefore
 * needs neither the `(userId, questionId)` advisory lock nor a transaction
 * spanning multiple repositories — `.claude/rules/learning-engine.md`
 * ("Skip is NOT an incorrect answer... does NOT create mastery failure...
 * gets no replacement item"). The single `UPDATE ... WHERE status =
 * 'pending' RETURNING` inside `DailyPlanRepository.markSkipped` is already
 * atomic on its own; no additional locking is needed to make "resolves at
 * most once" safe under concurrent requests.
 */
import type { DailyPlanAnswerRepository } from "../learning/ports";

export type SkipDailyPlanItemResult =
  | { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" }
  | { kind: "SKIPPED" }
  | {
      /**
       * The item was already resolved (by a skip OR an answer) before this
       * call. Skipping an already-SKIPPED item is reported the same way as
       * skipping an already-COMPLETED one — `status` tells the caller
       * which — never a silent no-op success and never an error that
       * implies something went wrong.
       */
      kind: "ALREADY_RESOLVED";
      status: "completed" | "skipped";
    };

export interface SkipDailyPlanItemCommand {
  userId: string;
  dailyPlanItemId: string;
  skippedAt: Date;
}

export interface SkipDailyPlanItemDependencies {
  dailyPlanItems: DailyPlanAnswerRepository;
}

export async function skipDailyPlanItem(
  command: SkipDailyPlanItemCommand,
  deps: SkipDailyPlanItemDependencies,
): Promise<SkipDailyPlanItemResult> {
  const item = await deps.dailyPlanItems.findItemById(command.dailyPlanItemId);
  if (item === null || item.userId !== command.userId) {
    // Never distinguishes "does not exist" from "exists but belongs to
    // someone else" — same non-leaking posture as submitAnswer's own
    // *_NOT_FOUND_OR_NOT_OWNED outcomes.
    return { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" };
  }

  const result = await deps.dailyPlanItems.markSkipped(
    command.dailyPlanItemId,
    command.skippedAt,
  );

  switch (result.outcome) {
    case "RESOLVED":
      return { kind: "SKIPPED" };
    case "ALREADY_RESOLVED": {
      const { status } = result.item;
      if (status === "pending") {
        // Unreachable: the repository only ever reports ALREADY_RESOLVED
        // when the item's real status is "completed"/"skipped" (see
        // `canResolveDailyPlanItem`) — the port's type is wider only
        // because it reuses `DailyPlanAnswerTarget["status"]` structurally.
        // Surfaced loudly rather than silently treated as one of the two
        // real cases.
        throw new Error(
          `skipDailyPlanItem: ALREADY_RESOLVED but item ${command.dailyPlanItemId} reported status "pending"`,
        );
      }
      return { kind: "ALREADY_RESOLVED", status };
    }
    case "NOT_FOUND":
      // Unreachable in practice: the ownership check above already
      // confirmed the item exists, and DailyPlanItems are never deleted
      // (only their parent DailyPlan can be, which would also remove this
      // item via cascade — a genuinely concurrent delete between the two
      // calls is not a scenario this product creates). Treated the same as
      // the ownership check's own not-found case rather than surfaced as
      // an unexpected error, since it is observationally identical to the
      // caller.
      return { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" };
    default: {
      const exhaustiveCheck: never = result;
      throw new Error(
        `skipDailyPlanItem: unhandled markSkipped outcome ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}

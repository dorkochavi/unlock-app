/**
 * Production composition root for the DailyPlan application layer — the
 * DailyPlan-scoped counterpart to
 * `src/infrastructure/learning/composition-root.ts`, kept as its own file
 * for the same reason `application/dailyPlan/ports.ts`'s
 * `DailyPlanUnitOfWork` is kept independent of `application/learning`'s
 * own `UnitOfWork`: no benefit to coupling the two composition roots
 * together.
 *
 * Like `infrastructure/learning/composition-root.ts`, this is code-shape
 * only: it assembles a real `getOrCreateDailyPlanForToday` dependency
 * bundle from a CALLER-SUPPLIED `SqlExecutor`/`ConnectionProvider` — no
 * production Postgres connection wiring (a real `pg.Pool` or equivalent)
 * exists anywhere in this codebase yet (ADR-013 remains "not wired up
 * yet"), so this file never constructs one itself. A future API
 * route/server composition layer (not built here) supplies the real
 * connection; this file only wires ports/settings once it has one. No
 * service locator, no hidden `Date.now()`, no hidden timezone lookup —
 * `now` continues to live on `GetOrCreateDailyPlanForTodayCommand`, not
 * here.
 */
import { TsFsrsMemoryScheduler } from "../learning/fsrs/ts-fsrs-memory-scheduler";
import {
  PRODUCTION_ENGINE_VERSION,
  PRODUCTION_TODAY_PLANNER_POLICY,
} from "../learning/production-policy-defaults";
import type {
  DailyPlanGenerationSettings,
  GetOrCreateDailyPlanForTodayPorts,
} from "../../application/dailyPlan/get-or-create-daily-plan-for-today";
import { PostgresCourseMembershipRepository } from "../postgres/course-membership-repository";
import { PostgresDailyPlanUnitOfWork } from "../postgres/daily-plan-unit-of-work";
import { PostgresUserRepository } from "../postgres/user-repository";
import type { ConnectionProvider } from "../postgres/connection-provider";
import type { SqlExecutor } from "../postgres/sql-executor";

/**
 * Builds the real `DailyPlanGenerationSettings` from the same centralized
 * production defaults `createProductionTodaySessionContext` uses — no new
 * value is invented here. Unlike `createProductionTodaySessionContext`,
 * this factory takes no `now` parameter: `DailyPlanGenerationSettings`
 * deliberately excludes `now` (see that type's own doc comment) — the
 * single authoritative clock value lives on
 * `GetOrCreateDailyPlanForTodayCommand` instead.
 */
export function createProductionDailyPlanGenerationSettings(): DailyPlanGenerationSettings {
  return {
    engineVersion: PRODUCTION_ENGINE_VERSION,
    memoryScheduler: new TsFsrsMemoryScheduler(),
    todayPlannerPolicy: PRODUCTION_TODAY_PLANNER_POLICY,
  };
}

/**
 * Builds the real `getOrCreateDailyPlanForToday` ports bundle.
 * `nonTransactionalDb` backs the plain-read `UserRepository`/
 * `CourseMembershipRepository` ports — neither needs a transaction
 * (`application/course/ports.ts`'s own doc comment states this
 * explicitly: "no operation in this slice needs multiple statements to
 * be atomic together"). `connectionProvider` backs the DailyPlan
 * generation transaction itself, via `PostgresDailyPlanUnitOfWork`. Both
 * are caller-supplied; this function never opens a connection.
 */
export function createProductionDailyPlanPorts(
  nonTransactionalDb: SqlExecutor,
  connectionProvider: ConnectionProvider,
): GetOrCreateDailyPlanForTodayPorts {
  return {
    users: new PostgresUserRepository(nonTransactionalDb),
    courseMemberships: new PostgresCourseMembershipRepository(nonTransactionalDb),
    dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(connectionProvider),
  };
}

/**
 * Production composition root for Course/Topic Practice (Run UX-02).
 *
 * Wires the same production ports/settings Today uses
 * (`infrastructure/dailyPlan/composition-root.ts`) plus the Practice-only read
 * ports. Like the other roots it opens no connection itself: callers pass the
 * process pool, and route handlers call this LAZILY — only after
 * authentication succeeded (`.claude/rules/api.md`).
 */
import type { SubmitPracticeAnswerPorts } from "../../application/practice/submit-practice-answer";
import {
  createProductionDailyPlanGenerationSettings,
  createProductionDailyPlanPorts,
} from "../dailyPlan/composition-root";
import { PostgresLearnerQuestionContentRepository } from "../postgres/learner-question-content-repository";
import type { ConnectionProvider } from "../postgres/connection-provider";
import { PostgresPracticeReadRepository } from "../postgres/practice-read-repository";
import { PostgresUnitOfWork } from "../postgres/postgres-unit-of-work";
import { PostgresUserQuestionProgressRepository } from "../postgres/progress-repository";
import type { SqlExecutor } from "../postgres/sql-executor";
import { PostgresTopicRepository } from "../postgres/topic-repository";

export { createProductionDailyPlanGenerationSettings as createProductionPracticeSettings };

export function createProductionPracticePorts(
  nonTransactionalDb: SqlExecutor,
  connectionProvider: ConnectionProvider,
): SubmitPracticeAnswerPorts {
  return {
    ...createProductionDailyPlanPorts(nonTransactionalDb, connectionProvider),
    topics: new PostgresTopicRepository(nonTransactionalDb),
    practice: new PostgresPracticeReadRepository(nonTransactionalDb),
    // Plain non-transactional read (Course-scoped list), same convention as
    // the other read ports; writes go through `uow` (ADR-010).
    progress: new PostgresUserQuestionProgressRepository(nonTransactionalDb),
    content: new PostgresLearnerQuestionContentRepository(nonTransactionalDb),
    uow: new PostgresUnitOfWork(connectionProvider),
  };
}

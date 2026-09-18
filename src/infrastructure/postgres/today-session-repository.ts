/**
 * PostgreSQL implementation of `TodaySessionRepository`
 * (`src/application/learning/ports.ts`), backed by `today_sessions` /
 * `today_session_items`.
 *
 * Scope note: ADR-010 step 7 says a completed item should "roll up
 * TodaySession completion" — deliberately NOT implemented here.
 * `today_sessions.status`'s exact state machine is still an explicitly
 * open product decision (`docs/DATABASE.md` §17; the migration's own
 * comment on that column), and this session's task instructions list
 * "Today status lifecycle not already decided" as an explicit stop
 * condition. `markItemCompleted` below implements exactly what
 * `TodaySessionRepository`'s own port contract specifies — updating one
 * item — and no more.
 */
import type {
  TodaySession,
  TodaySessionItem,
  TodaySessionKey,
  TodaySessionRepository,
} from "../../application/learning/ports";
import {
  mapTodaySessionItemRow,
  mapTodaySessionRow,
} from "./today-session-mapper";
import type { TransactionExecutor } from "./sql-executor";

const ITEM_STATUS_VALUES = ["pending", "completed", "skipped"] as const;

function itemInsertParams(
  todaySessionId: string,
  userId: string,
  courseId: string,
  item: Omit<TodaySessionItem, "id" | "todaySessionId">,
): unknown[] {
  return [
    todaySessionId,
    userId,
    courseId,
    item.position,
    item.questionId,
    item.questionVersionId,
    item.actionType,
    item.tier,
    JSON.stringify(item.otherApplicableTypes),
    JSON.stringify(item.reasons),
    item.status,
    item.completedAt,
  ];
}

export class PostgresTodaySessionRepository implements TodaySessionRepository {
  constructor(private readonly db: TransactionExecutor) {}

  private async loadItems(todaySessionId: string): Promise<TodaySessionItem[]> {
    const result = await this.db.query(
      "select * from today_session_items where today_session_id = $1 order by position asc",
      [todaySessionId],
    );
    return result.rows.map(mapTodaySessionItemRow);
  }

  private async loadByKey(key: TodaySessionKey): Promise<TodaySession | null> {
    const result = await this.db.query(
      `select * from today_sessions
         where user_id = $1 and course_id = $2 and planned_for_date = $3`,
      [key.userId, key.courseId, key.plannedForDate],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    const items = await this.loadItems(String(result.rows[0].id));
    return mapTodaySessionRow(result.rows[0], items);
  }

  async findByKey(key: TodaySessionKey): Promise<TodaySession | null> {
    return this.loadByKey(key);
  }

  async findItemById(itemId: string): Promise<TodaySessionItem | null> {
    const result = await this.db.query(
      "select * from today_session_items where id = $1",
      [itemId],
    );
    return result.rows.length === 1
      ? mapTodaySessionItemRow(result.rows[0])
      : null;
  }

  /**
   * Race-free by construction (ADR-010): `INSERT ... ON CONFLICT (user_id,
   * course_id, planned_for_date) DO NOTHING RETURNING`, never a
   * check-then-insert. If this call wins the race, it also inserts every
   * frozen item in the same transaction. If it loses the race (another
   * concurrent call already created a session for this exact key), the
   * caller-supplied `session`/`items` are silently discarded in favor of
   * the already-committed session — exactly the documented port contract
   * ("returns ... the existing one if another concurrent call won the
   * race"), never a thrown error for a legitimate concurrent create.
   */
  async createIfNotExists(
    session: Omit<TodaySession, "items" | "id">,
    items: Array<Omit<TodaySessionItem, "id" | "todaySessionId">>,
  ): Promise<TodaySession> {
    const inserted = await this.db.query(
      `insert into today_sessions (
         user_id, course_id, planned_for_date, status, engine_version,
         generated_at, started_at, completed_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, course_id, planned_for_date) do nothing
       returning *`,
      [
        session.userId,
        session.courseId,
        session.plannedForDate,
        session.status,
        session.engineVersion,
        session.generatedAt,
        session.startedAt,
        session.completedAt,
      ],
    );

    if (inserted.rows.length === 0) {
      const existing = await this.loadByKey({
        userId: session.userId,
        courseId: session.courseId,
        plannedForDate: session.plannedForDate,
      });
      if (existing === null) {
        // The conflict branch fired, so a row must exist — reachable only
        // via a real bug (e.g. a concurrent delete of the winning session
        // between the conflicting INSERT and this SELECT), surfaced loudly.
        throw new Error(
          `PostgresTodaySessionRepository.createIfNotExists: INSERT ` +
            `reported a conflict for (user_id=${session.userId}, ` +
            `course_id=${session.courseId}, planned_for_date=` +
            `${session.plannedForDate}) but no matching row was found on ` +
            `the follow-up SELECT`,
        );
      }
      return existing;
    }

    const sessionRow = inserted.rows[0];
    const sessionId = String(sessionRow.id);
    const insertedItems: TodaySessionItem[] = [];
    for (const item of items) {
      const result = await this.db.query(
        `insert into today_session_items (
           today_session_id, user_id, course_id, position, question_id,
           question_version_id, action_type, tier, other_applicable_types,
           reasons, status, completed_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning *`,
        itemInsertParams(sessionId, session.userId, session.courseId, item),
      );
      insertedItems.push(mapTodaySessionItemRow(result.rows[0]));
    }

    return mapTodaySessionRow(sessionRow, insertedItems);
  }

  async markItemCompleted(
    itemId: string,
    completedAt: Date,
    // Deliberately unused for storage: today_session_items has no
    // completed_by_attempt_id column by design (see this table's own
    // comment in the migration — attempts.today_session_item_id already
    // points Attempt -> Item, and a second independently-writable
    // Item -> Attempt pointer could disagree with it). Kept as a named
    // parameter (not `_attemptId`) purely to keep this method's signature
    // matching `TodaySessionRepository.markItemCompleted` exactly, should
    // a future caller need it for logging/observability only.
    attemptId: string,
  ): Promise<void> {
    void attemptId;
    const result = await this.db.query(
      `update today_session_items
          set status = 'completed', completed_at = $2
        where id = $1
        returning id`,
      [itemId, completedAt],
    );
    if (result.rows.length !== 1) {
      throw new Error(
        `PostgresTodaySessionRepository.markItemCompleted: no ` +
          `today_session_items row found for id=${itemId}`,
      );
    }
  }
}

// Re-exported for tests that want to assert against the exact status enum
// without importing the table's CHECK constraint text.
export { ITEM_STATUS_VALUES };

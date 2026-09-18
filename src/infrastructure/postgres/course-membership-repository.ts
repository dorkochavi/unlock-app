/**
 * PostgreSQL implementation of `CourseMembershipRepository`
 * (`src/application/course/ports.ts`), backed by `course_memberships`.
 */
import type { CourseMembershipRepository } from "../../application/course/ports";
import { mapCourseMembershipRow } from "./course-membership-mapper";
import type { TransactionExecutor } from "./sql-executor";

export class PostgresCourseMembershipRepository
  implements CourseMembershipRepository
{
  constructor(private readonly db: TransactionExecutor) {}

  async findMembership(userId: string, courseId: string) {
    const result = await this.db.query(
      "select * from course_memberships where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    return result.rows.length === 1 ? mapCourseMembershipRow(result.rows[0]) : null;
  }

  /**
   * Race-free by construction (ADR-010's own established pattern, reused
   * here): `INSERT ... ON CONFLICT (user_id, course_id) DO NOTHING
   * RETURNING`, never a check-then-insert. If this call loses the race, the
   * caller-supplied `membership` is silently discarded in favor of the
   * already-committed row (`wasNew: false`) — mirroring
   * `PostgresTodaySessionRepository.createIfNotExists`'s documented
   * contract exactly.
   */
  async createMembership(
    membership: Parameters<CourseMembershipRepository["createMembership"]>[0],
  ) {
    const inserted = await this.db.query(
      `insert into course_memberships (user_id, course_id, role, joined_at, revoked_at, archived_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, course_id) do nothing
       returning *`,
      [
        membership.userId,
        membership.courseId,
        membership.role,
        membership.joinedAt,
        membership.revokedAt,
        membership.archivedAt,
      ],
    );

    if (inserted.rows.length === 1) {
      return { membership: mapCourseMembershipRow(inserted.rows[0]), wasNew: true };
    }

    const existing = await this.findMembership(membership.userId, membership.courseId);
    if (existing === null) {
      // The conflict branch fired, so a row must exist — reachable only via
      // a real bug (e.g. a concurrent delete between the conflicting INSERT
      // and this SELECT; no code path in this codebase deletes a
      // course_memberships row), surfaced loudly rather than silently
      // returning an impossible null.
      throw new Error(
        `PostgresCourseMembershipRepository.createMembership: INSERT reported ` +
          `a conflict for (user_id=${membership.userId}, course_id=` +
          `${membership.courseId}) but no matching row was found on the ` +
          `follow-up SELECT`,
      );
    }
    return { membership: existing, wasNew: false };
  }

  async listActiveForUser(userId: string) {
    const result = await this.db.query(
      `select * from course_memberships
        where user_id = $1 and revoked_at is null and archived_at is null`,
      [userId],
    );
    return result.rows.map(mapCourseMembershipRow);
  }

  async setArchived(userId: string, courseId: string, archivedAt: Date | null) {
    const result = await this.db.query(
      `update course_memberships
          set archived_at = $3
        where user_id = $1 and course_id = $2
        returning *`,
      [userId, courseId, archivedAt],
    );
    return result.rows.length === 1 ? mapCourseMembershipRow(result.rows[0]) : null;
  }

  async revoke(userId: string, courseId: string, revokedAt: Date) {
    const result = await this.db.query(
      `update course_memberships
          set revoked_at = $3
        where user_id = $1 and course_id = $2
        returning *`,
      [userId, courseId, revokedAt],
    );
    return result.rows.length === 1 ? mapCourseMembershipRow(result.rows[0]) : null;
  }
}

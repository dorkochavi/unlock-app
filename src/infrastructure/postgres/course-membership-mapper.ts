/**
 * Explicit row <-> domain mapping for `course_memberships` (Phase 5's
 * mapping audit precedent).
 */
import { COURSE_ROLES } from "../../domain/course/types";
import type { CourseMembership } from "../../application/course/ports";
import {
  readDate,
  readEnum,
  readNullableDate,
  readString,
} from "./row-validation";

const TABLE = "course_memberships";

export function mapCourseMembershipRow(
  row: Record<string, unknown>,
): CourseMembership {
  return {
    id: readString(row, TABLE, "id"),
    userId: readString(row, TABLE, "user_id"),
    courseId: readString(row, TABLE, "course_id"),
    role: readEnum(row, TABLE, "role", COURSE_ROLES),
    joinedAt: readDate(row, TABLE, "joined_at"),
    revokedAt: readNullableDate(row, TABLE, "revoked_at"),
    archivedAt: readNullableDate(row, TABLE, "archived_at"),
  };
}

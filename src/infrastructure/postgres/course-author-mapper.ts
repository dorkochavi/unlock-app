/**
 * Explicit row <-> domain mapping for `course_authors` (Phase 5's mapping
 * audit precedent, same convention `course-membership-mapper.ts` follows).
 */
import { COURSE_AUTHOR_CAPABILITIES } from "../../domain/course/types";
import type { CourseAuthorGrant } from "../../application/course/ports";
import {
  readDate,
  readEnum,
  readNullableDate,
  readString,
} from "./row-validation";

const TABLE = "course_authors";

export function mapCourseAuthorRow(
  row: Record<string, unknown>,
): CourseAuthorGrant {
  return {
    id: readString(row, TABLE, "id"),
    userId: readString(row, TABLE, "user_id"),
    courseId: readString(row, TABLE, "course_id"),
    capability: readEnum(row, TABLE, "capability", COURSE_AUTHOR_CAPABILITIES),
    grantedAt: readDate(row, TABLE, "granted_at"),
    revokedAt: readNullableDate(row, TABLE, "revoked_at"),
  };
}

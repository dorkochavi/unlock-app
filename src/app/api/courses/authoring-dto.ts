/**
 * Shared route-layer DTO mapper for `CourseAuthoringRecord` (Run 005 S2),
 * used by every instructor-authoring route (`create`, `manage` GET/PATCH,
 * `publish`, `archive`). Converts `Date` -> ISO string explicitly and never
 * exposes `ownerUserId` or any other persistence-only field — this DTO is
 * still authoring-only (never returned from an unauthenticated or
 * learner-facing path), but stays deliberately minimal regardless.
 */
import type { CourseAuthoringRecord } from "@/application/course/ports";

export interface CourseAuthoringDto {
  id: string;
  title: string;
  status: CourseAuthoringRecord["status"];
  joinPolicy: CourseAuthoringRecord["joinPolicy"];
  examDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCourseAuthoringDto(course: CourseAuthoringRecord): CourseAuthoringDto {
  return {
    id: course.id,
    title: course.title,
    status: course.status,
    joinPolicy: course.joinPolicy,
    examDate: course.examDate,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

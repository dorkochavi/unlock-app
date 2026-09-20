/**
 * Shared route-layer DTO mapper for `Topic` (Run 005 S4), used by every
 * Topic authoring route (list, create, rename, archive). Converts `Date` ->
 * ISO string explicitly and omits `archivedAt` — every route that returns a
 * Topic here does so from an authoring-only context where the Topic is
 * either newly created/active or was just explicitly archived by this same
 * call (the caller already knows the outcome from the route's own HTTP
 * status/outcome, so no `archivedAt` field is needed on the wire).
 */
import type { Topic } from "@/application/topic/ports";

export interface TopicDto {
  id: string;
  courseId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function toTopicDto(topic: Topic): TopicDto {
  return {
    id: topic.id,
    courseId: topic.courseId,
    name: topic.name,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

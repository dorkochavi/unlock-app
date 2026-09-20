/**
 * UNLOCK flat Topic V1 domain contract — Run 005 S4 (CHATGPT_PLAN.md
 * "Topics": "Topic model is flat in V1. No nested hierarchy, prerequisite
 * graph, or knowledge graph in this Run. A Topic belongs to one Course.").
 *
 * Authorization reuses `canAuthorCourse` (`src/domain/course/types.ts`)
 * unchanged — Topic authoring is part of the same Run-005 content-authoring
 * surface as Course metadata/publish/archive, not a separate policy.
 */
export interface Topic {
  id: string;
  courseId: string;
  name: string;
  /**
   * `null` = active, participates in normal authoring/listing. Non-null =
   * archived — excluded from the default Topic list, but the row is never
   * deleted (Run 005 CHATGPT_PLAN.md S4 "If hard deletion would create
   * referential/history risk once Questions exist, prefer archive/inactive
   * semantics"). No V1 unarchive path, matching Course's own "do not invent
   * destructive/reversal behavior casually" discipline until a real product
   * need is demonstrated.
   */
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

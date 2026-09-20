-- UNLOCK Flat Topic Model V1 — Run 005 S4.
--
-- Forward-only migration. Does NOT edit any prior migration.
--
-- Implements the flat Topic model (Run 005 CHATGPT_PLAN.md "Topics" /
-- "S4 — Flat Topic Model + Topic Authoring V1"): a Topic belongs to exactly
-- one Course, no parent Topic, no nesting, no prerequisite graph, no
-- Knowledge Graph. This is a NEW table, distinct from the existing (unused)
-- `materials` table — Topic is a lightweight authoring/organization concept,
-- not the same thing `materials` was speculatively modeling.
--
-- No `position`/ordering column: "stable ordering if needed by authoring
-- UX" is satisfied cheaply by creation-time order (`created_at` ascending,
-- `id` as a deterministic-but-not-insertion-preserving tiebreak on an exact
-- `created_at` tie — see `PostgresTopicRepository.listActiveForCourse`)
-- rather than adding and maintaining a dedicated ordering column before any
-- real reordering UX is asked for.

create table topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete restrict,
  name text not null,
  -- null = active, participates in normal authoring/listing. Non-null =
  -- archived — excluded from the default Topic list, but the row is never
  -- deleted (Run 005 CHATGPT_PLAN.md S4: "If hard deletion would create
  -- referential/history risk once Questions exist, prefer archive/inactive
  -- semantics"). No V1 unarchive path.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table topics is
  'Run 005 S4. Flat Topic model — a Topic belongs to exactly one Course '
  '(course_id), no nesting/hierarchy/prerequisite graph in V1. Authorization '
  '(OWNER/active INSTRUCTOR only) is enforced at the application layer '
  '(src/application/topic/), reusing course_memberships/canAuthorCourse '
  'exactly as every other Run-005 authoring surface does — not a DB '
  'constraint, matching this schema''s existing division between physical '
  'integrity (DB) and authorization/lifecycle policy (application).';

comment on column topics.archived_at is
  'Run 005 S4. null = active. Non-null = archived (excluded from the '
  'default authoring list, but the row and its id remain intact — no '
  'delete path exists in V1, to preserve referential integrity once a '
  'future Slice associates Questions with a Topic).';

-- Serves "list active Topics for a Course" (the only Topic query this
-- Slice's application layer issues) and the cross-Course-association guard
-- in rename-topic.ts/archive-topic.ts (`getTopic` then compare `course_id`).
create index topics_course_id_idx on topics (course_id);

alter table topics enable row level security;

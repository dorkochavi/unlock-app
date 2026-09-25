# ADR-018: Topic Model V1 (Flat, Soft-Archive, Current-Derived Attribution)

Status: ACCEPTED

## Context

Topics were introduced in Run 005 (`20260927000000_topics_v1.sql`) and associated with Questions in Run 006
(`questions.topic_id`, `20260928000000_question_authoring_v1.sql`). Their semantics were recorded only in a
migration comment, use-case doc comments, `OPEN_QUESTIONS.md` OQ-031 and Run 009 Plan D6. Three read models
(learner Progress, instructor Item Analysis and Topic Insights) now depend on them, and the Run 009 Canonical
Consistency Audit found no ADR-level owner. This ADR records what is already decided and implemented. It
introduces no new behavior.

## Decision

1. **Flat, Course-scoped.** A Topic belongs to exactly one Course. V1 has no hierarchy, nesting, or prerequisite
   structure.
2. **Soft archive.** A Topic is archived by setting `archived_at`; its row and id are never deleted. There is no
   hard-delete path and no V1 unarchive path. Archival does not reassociate or hide its Questions.
3. **Current, non-versioned attribution.** `questions.topic_id` is current Question metadata. It is not part of a
   QuestionVersion (ADR-009) and is not snapshotted into Attempts, QuestionVersions, or any other table.
   Publishing a new version does not snapshot the Topic.
4. **Current-derived read models.** A Question's history is interpreted under its CURRENT Topic. Reassigning a
   Question's Topic makes its historical Attempts appear under the new Topic in every current-derived read model
   (learner Progress, Item Analysis, Topic Insights). Attempts themselves are never rewritten (ADR-005).
5. **No immutable historical Topic attribution exists in V1.** Trend or history analytics that need attribution
   frozen at answer time are out of scope (see Consequences).
6. **Association rule.** A NEW association of a Question to an archived Topic is rejected; an existing association
   to a since-archived Topic is kept ("no forced reassociation").
7. **Consumer rules (Run 009).**
   - Learner Progress does not surface archived Topics (or Questions with no Topic) as active destinations.
     Per-Topic coverage denominators are unaffected by omitted Topics.
   - Instructor insights may represent an archived Topic distinctly (flagged, never collapsed into another
     bucket), and show a neutral "no Topic" bucket for published Questions with no Topic, when current content
     or evidence exists.
   - Today (ADR-016/017) does not filter on Topics; Questions in an archived Topic can still be planned.

## Consequences

- Changing a Question's Topic after learners have answered silently moves learner and instructor history between
  Topics. Operational rule (not enforced in code): avoid Topic reassignment once answering has started
  (`docs/PILOT_READINESS.md`).
- Hierarchy (Units/sections) and immutable historical attribution remain undecided and deferred under OQ-031.
  Adopting either would require a new decision (likely a superseding ADR), a migration, and a policy for existing
  Attempts.
- Read models must not assume a Topic is present or active: null and archived Topics are expected states.

## Alternatives Considered

### Snapshot Topic onto QuestionVersion or Attempt
Would give immutable attribution but couples organization metadata to immutable content/evidence, forces a new
version (or backfill policy) for a pure reorganization, and was not needed for V1 read models. Deferred.

### Hard delete of Topics
Rejected: risks referential and history problems once Questions exist; archive preserves ids and evidence.

### Hide or reassign Questions when their Topic is archived
Rejected: would silently change Today and coverage behavior (ADR-016) and require a forced-reassociation policy.

## Related Documents

- `supabase/migrations/20260927000000_topics_v1.sql`, `20260928000000_question_authoring_v1.sql`
- ADR-005 (Attempts immutable), ADR-009 (QuestionVersion), ADR-016/017 (Today, unseen)
- `docs/CHATGPT_PLAN.md` Run 009 D6 and Archived/Null Topics; `docs/RUNS/2026-09-25-009.md`
- `docs/OPEN_QUESTIONS.md` OQ-031 (hierarchy and historical attribution, deferred)

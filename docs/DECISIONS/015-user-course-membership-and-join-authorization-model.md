# ADR-015: User-Course Membership and Join Authorization Model

Status: ACCEPTED

## Context

`docs/OPEN_QUESTIONS.md` #1 (User ↔ Course Relationship in V1) has been the
standing blocker for Auth wiring, real RLS policies, and any implemented API
route since the persistence schema was first written — `courses.owner_user_id`
was deliberately documented as "the minimum needed to make this table
concrete... **not** a closure of Open Question #1"
(`docs/PERSISTENCE_SCHEMA_V1.md`), and `docs/API_V1_DRAFT.md` stayed
unimplemented explicitly pending this decision.

`docs/COURSE_ACCESS_MODEL_DRAFT.md` compared four concrete models (a bare
membership table, membership + role, an institution enrollment layer, and a
Course/CourseOffering split) against the product direction already given for
personal Courses, official institutional Courses, archiving, and QR/link
onboarding. This ADR records the product owner's decision from that
comparison as a durable, accepted product-and-architecture decision.

This ADR is **product-model documentation only**. It does not implement
Auth, RLS policies, API routes, or any migration. Those remain future
implementation work, now unblocked at the decision level.

## Decision

### 1. `CourseMembership` is the explicit User↔Course relationship

A `CourseMembership` concept is the single explicit relationship between a
`User` and a `Course` — there is no other path to Course access. Minimum
conceptual fields (concept-level, not a column spec — exact types/constraints
are future migration work, out of scope for this ADR):

```text
userId
courseId
role
joinedAt
revokedAt   (nullable)
archivedAt  (nullable)
```

`courses.owner_user_id` (the existing column) is unaffected by this decision
— whether it is later retired in favor of a `role = OWNER` membership row, or
kept as a denormalized fast path alongside `CourseMembership`, remains open
implementation detail, not decided here.

### 2. V1 roles: `OWNER`, `INSTRUCTOR`, `LEARNER`

Exactly three roles exist in V1:

- **`OWNER`** and **`INSTRUCTOR`** are course-management roles — both may
  manage Course content and membership for that Course.
- **`LEARNER`** is a learning-only role — no content- or
  membership-management capability.
- `OWNER` remains conceptually distinct from `INSTRUCTOR` because `Course`
  already has an owner/creator concept (`courses.owner_user_id`); `OWNER`
  aligns with that existing concept, `INSTRUCTOR` represents zero-or-more
  additional users granted the same management capability (e.g. a
  co-lecturer).
- No `MANAGER` role or any institution-level role is introduced in V1.

### 3. Course join policy: `AUTHORIZED_ONLY` | `OPEN`

Every Course has exactly one join-policy value:

- **`AUTHORIZED_ONLY`** (default)
- **`OPEN`**

Only a Course-management role (`OWNER` or `INSTRUCTOR`) on that specific
Course may set it to `OPEN`. The deny-by-default posture already established
by ADR-013 for RLS is deliberately extended to join policy itself: a new
Course starts `AUTHORIZED_ONLY`, not `OPEN`.

### 4. `OPEN` Course behavior

An authenticated user may self-join an `OPEN` Course and receive a `LEARNER`
`CourseMembership`, with no separate approval step. This is what supports the
Ruppin classroom demo:

```text
QR → Course → sign in → join → membership created → learn
```

### 5. `AUTHORIZED_ONLY` Course behavior

Possession of a Course URL, UUID, QR code, or link is **never** sufficient
authorization for an `AUTHORIZED_ONLY` Course. Self-join succeeds only if a
separate authorization mechanism determines the authenticated user is
eligible.

**The exact future authorization source is not decided by this ADR.**
Possible future mechanisms include an institution-provided email roster,
institution admin provisioning, an institutional integration/API, or SSO/
identity integration — these are illustrative examples only and must **not**
be treated as V1 requirements. No such mechanism is implemented by this ADR.

### 6. QR / link semantics

A QR code or link is only ever:

- discovery,
- navigation, or
- an invitation/pointer.

It is never authorization itself. This holds regardless of whether Course
IDs happen to be unguessable (e.g. UUIDs) — unguessability is not a substitute
for an authorization decision, and must never be treated as one.

### 7. Access state and learning state are separate

`revokedAt`:
- `null` — the user currently has access to the Course.
- non-null — access has been revoked.

`archivedAt`:
- `null` — the Course participates in the learner's active learning set /
  Today.
- non-null — the Course is excluded from that learner's automatic Today.

These two facts are independent. An **archived** Course:
- remains accessible to that learner,
- remains manually practiceable,
- may be reactivated by the learner.

A **revoked** Course membership:
- is no longer accessible to that user at all,
- does not delete that user's historical learner records (see §8).

### 8. Attempt / Progress / learner history durability

Attempts, UserQuestionProgress, and other learner history are never deleted
merely because:
- membership is revoked,
- the Course is archived (by that learner or generally), or
- the Course is otherwise no longer active.

This extends ADR-005's immutability principle to the membership boundary:
losing access to a Course must never be implemented as, or have the side
effect of, deleting that learner's historical evidence.

### 9. Course archive status is per-user

Archive status lives on `CourseMembership` (`archivedAt`), not on `Course`
itself. `Course` gains no `ACTIVE`/`ARCHIVED` field to model learner archive
behavior — a lecturer's Course may remain fully active for the class while
one individual learner archives it from their own perspective. This is the
concrete schema-location consequence of the already-accepted principle that
archiving is a fact about one learner's relationship to a Course, not about
the Course's own lifecycle.

### 10. Institution remains optional

This ADR does not introduce `Institution`, `InstitutionMembership`, or any
enrollment table. ADR-006 (Course does not require Institution) remains
fully valid and unmodified. A future institutional layer, if built, is
expected to sit alongside `CourseMembership` as an additional authorization
input for `AUTHORIZED_ONLY` Courses (see §5) — not a replacement requiring
migration of existing memberships — but that layer is not designed or
scheduled by this ADR.

### 11. Discoverability and access are separate concerns

A Course being publicly discoverable/listed is a fact independent of whether
it can be joined. `OPEN` join policy must never be equated with, or inferred
from, public discoverability — a Course could in principle be discoverable
and still `AUTHORIZED_ONLY`, or joinable via direct link without being
publicly listed at all. This ADR does not design a discoverability/listing
mechanism; it only fixes that the two concerns must remain separable in the
model.

### 12. Ownership concepts remain separate

This ADR keeps the following five concerns independent, resolving none of
them into one another:

- Course ownership (`courses.owner_user_id`)
- Course management permission (`CourseMembership.role` = `OWNER`/`INSTRUCTOR`)
- content ownership (e.g. `materials.created_by`)
- content visibility (not modeled by this ADR — see
  `docs/CONTENT_IP_THREAT_MODEL.md`'s proposed, not-yet-accepted tiers)
- membership/access (`CourseMembership` existence + `revokedAt`)

**This ADR explicitly does not resolve lecturer-vs-institution content/IP
ownership.** That question remains open and is unaffected by this decision.

## Consequences

This ADR is a product/architecture decision, not an implementation. The
following are documented as expected future consequences — none of them are
implemented by this ADR:

**Likely future persistence changes**
- A new `course_memberships` table (or equivalently named entity) capturing
  the fields in §1.
- A new `courses.join_policy` column (or equivalent) capturing §3.
- No change is required to any currently-existing table's shape
  (`users`, `materials`, `questions`, `question_versions`, `attempts`,
  `user_question_progress`, `today_sessions`, `today_session_items` all
  remain as committed).

**Likely future Auth/RLS consequences**
- `userId` continues to be derived only from the authenticated principal,
  never from client-supplied request data (unchanged from
  `docs/API_V1_DRAFT.md`'s existing requirement).
- Course read access will be gated by a non-revoked `CourseMembership`.
- Content-management operations will be gated by an `OWNER`/`INSTRUCTOR`
  membership on that specific Course.
- Learner history (Attempts/UserQuestionProgress) will continue to be
  isolated by the authenticated user's own id, independent of Course
  membership state.
- Possession of a Course's QR/link/URL/UUID must never bypass an
  `AUTHORIZED_ONLY` join check, at the RLS/application boundary once built.

None of the above is implemented, migrated, or wired by this ADR. `docs/API_V1_DRAFT.md`
remains unimplemented; RLS policies remain zero, per ADR-013, until written
and tested separately.

**Explicitly deferred / not decided by this ADR**
- The exact authorization source(s) for `AUTHORIZED_ONLY` Courses (§5).
- Any content-visibility tier or schema (`SOURCE_VISIBLE`/`LEARNING_ONLY`/
  `STAFF_ONLY` remain proposals only, per `docs/CONTENT_IP_THREAT_MODEL.md`).
- Lecturer-vs-institution content/IP ownership (§12).
- Whether `courses.owner_user_id` is retired in favor of a membership row.
- Real RLS policy text.
- Auth wiring, API routes, and any migration implementing this model.
- Institution, InstitutionMembership, or enrollment tables (§10).
- Any Course-level discoverability/listing mechanism (§11).

## Alternatives Considered

### Simple `CourseMembership` with no role distinction

Rejected. The already-accepted rule that "official Course material can be
promoted/managed only by lecturer/course-management roles" (plural) cannot
be expressed without some role distinction; a bare membership table would
need a second, separate mechanism for content-management authorization,
duplicating effort for no simplification benefit at this point.

### Institution enrollment/provisioning layer as the V1 baseline

Rejected as the baseline model. It requires `Institution` to exist as a
real, populated entity before any official Course can use approval-gating
at all, forcing institutional multi-tenancy machinery
(`docs/DATABASE.md` §46 explicitly warns against this before it's needed)
onto a Ruppin demo that has exactly one lecturer and one Course. Nothing
about `CourseMembership` + `AUTHORIZED_ONLY` forecloses adding such a layer
later as an additional authorization input (§10, §5).

### `Course` vs `CourseOffering` split

Rejected for V1. The product direction's own framing ("official academic
Courses are specific teaching instances... not abstract subjects") already
resolves what this split would represent, with zero schema change: two
`courses` rows with two different `owner_user_id`s already are two different
Courses today. Introducing a catalog/offering split now would model a
concept nobody has asked to browse or aggregate yet.

### `OPEN` as the default join policy

Rejected. Defaulting new Courses to `OPEN` would contradict the
deny-by-default posture already established for RLS (ADR-013) and would make
every newly-created Course briefly (or permanently, if never explicitly
locked down) joinable by anyone with the link, including official Courses a
management role has not yet had the chance to configure. `AUTHORIZED_ONLY`
as the default, with an explicit management action required to open a
Course, matches the existing safe-by-default architecture principle.

### A `MANAGER` / institution-level role in V1

Rejected. Nothing in the current product direction, the Ruppin demo, or V1
scope requires distinguishing an institution-level manager from a single
Course's `OWNER`/`INSTRUCTOR`. Deferred as architecture-ready, not built now,
consistent with ADR-006's treatment of Institution itself.

## Addendum (Implementation Hardening)

Recorded alongside the implementation-hardening pass over
`src/application/course/` (migration, domain, application, and
Postgres-infrastructure layers all now exist). Both points below are
clarifications of intent already implied by the Decision above, not new
decisions:

- **`CourseMembership.role = OWNER` is the authorization source of truth**
  for Course management. `courses.owner_user_id` remains creator/legacy
  metadata only, per §12's already-decided separation of "Course ownership"
  from "Course management permission" — it must not independently grant
  management authorization, and no application code path
  (`src/application/course/set-course-join-policy.ts`,
  `revoke-course-membership.ts`) reads it for that purpose; both check only
  a non-revoked management `CourseMembership`.
- **`AUTHORIZED_ONLY` self-join fails closed unconditionally in V1**: with
  no eligibility mechanism decided (§5), `canSelfJoin`
  (`src/domain/course/types.ts`) returns `false` for `AUTHORIZED_ONLY`
  Courses with no exceptions — this is deliberate, not a placeholder bug,
  and requires a real future decision (not a code change alone) to open up.
- **Archived-but-not-revoked management members retain management
  rights.** Archive (§9) is per-user and affects only that user's active
  learning participation; it was never intended to affect a management
  role's ability to manage a Course. `setCourseJoinPolicy` and
  `revokeCourseMembership` already only check `revokedAt`, never
  `archivedAt`, for this reason — pinned by tests in
  `src/application/course/__tests__/`.
- Three genuinely undecided edge cases surfaced during this pass (revoked-
  membership rejoin outcome semantics, last-management-member
  self-revocation, repeated revoke/archive timestamp overwrite semantics)
  are **not resolved here** — see `docs/OPEN_QUESTIONS.md` #43. Current
  code takes the conservative, non-access-granting path in each case and
  that behavior is pinned by tests, but none of the three is a product
  decision.

## Related Documents

- `docs/OPEN_QUESTIONS.md` #1 (resolved by this ADR)
- `docs/COURSE_ACCESS_MODEL_DRAFT.md` (the prior analysis this ADR formalizes
  — kept as historical input, superseded as the authority by this ADR)
- `docs/CONTENT_IP_THREAT_MODEL.md` (companion analysis on content
  visibility; not resolved by this ADR)
- `docs/DECISIONS/006-course-does-not-require-institution.md` (unmodified,
  remains valid)
- `docs/DECISIONS/005-attempts-are-immutable.md` (the durability principle
  §8 extends to the membership boundary)
- `docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`
  (the deny-by-default RLS posture §3's default policy is consistent with)
- `docs/API_V1_DRAFT.md` (remains unimplemented; this ADR unblocks it at the
  decision level only)
- `docs/DATABASE.md` §5, §29, §51 (updated for consistency alongside this
  ADR)
- `CLAUDE.md` (updated for consistency alongside this ADR)

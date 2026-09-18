# Course / Membership / Content Access — Decision Brief (Draft)

Status: **SUPERSEDED as the authority by `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`.**
Kept for historical context only — this draft's analysis fed into that ADR's
decision, but where the two differ (e.g. this draft's Section 6 leaned toward
an `OPEN`-by-default join policy; ADR-015 decided `AUTHORIZED_ONLY` by
default), ADR-015 is authoritative. Do not treat anything below as current
product decision.

Original status (superseded): DRAFT DECISION BRIEF — not an ADR, not implemented, not approved.

Purpose: lay out concrete model options for `docs/OPEN_QUESTIONS.md` #1
(User↔Course relationship in V1 — the current blocker for Auth wiring, real
RLS policies, and any implemented API route per `CLAUDE.md` §4) so the
product owner has a specific choice to make rather than an abstract one.
This document does **not** resolve Open Question #1. It informs that
decision. Nothing here is implemented; no code or schema changes accompany
this file.

Companion document: `docs/CONTENT_IP_THREAT_MODEL.md` covers lecturer/source
material IP risk in depth. This brief references content-ownership
implications only insofar as they affect the User↔Course access model
itself; it does not duplicate that threat analysis.

---

## 1. What is already decided vs. what this brief is analyzing

**DECIDED FROM USER DIRECTION / already ACCEPTED**:

- Institution is optional; Course must be valid without one (ADR-006).
- The current schema's `courses.owner_user_id` (FK → `users.id`) exists,
  but `docs/PERSISTENCE_SCHEMA_V1.md` explicitly flags it as "the minimum
  needed to make this table concrete... **not** a closure of
  `docs/OPEN_QUESTIONS.md` #1." A future Enrollment/multi-access model can
  be added additively (a separate table) without changing that column. This
  brief treats `owner_user_id` as fixed and asks what to add alongside it.
- Official academic Courses are specific teaching instances (a lecturer's
  specific offering in a specific term), not abstract subjects. Two
  lecturers teaching "Intro to Statistics" in different years are two
  different Courses under this direction, not one Course with variants.
- Public discoverability must never imply public access — a Course being
  listable/findable is a separate fact from a user being authorized to see
  its content or contribute Attempts to it.
- Course has an ACTIVE/ARCHIVED distinction from the learner's perspective:
  archived excludes a Course from Today but leaves it manually practiceable;
  a learner may reactivate; Attempts/Progress/history remain durable
  regardless of archive state.
- For official institutional Courses, institutional/lecturer authorization
  takes precedence over any QR/link join mechanism — QR is a convenience
  path, never an override of the authoritative membership decision.

**STILL OPEN** (this is exactly what Open Question #1 asks, and what
Section 3 below compares options for):

- The concrete schema shape of "a learner is related to a Course."
- Whether role distinction (student vs. lecturer vs. course-management)
  exists in V1 at all, or is deferred.
- How "approved membership" for an official institutional Course is
  actually granted/recorded — manual admin action, an email allow-list, a
  future institutional provisioning feed — none of this is decided by the
  product direction above, only that some form of approval gate must exist
  for official Courses specifically (personal Courses need no such gate by
  definition — the owner already controls them).

This brief's job is to give the product owner four concrete, comparably
structured options for the open part, not to guess an answer.

---

## 2. Requirements distilled from the product direction

Any V1 model must support, at minimum:

1. A user can create a personal Course, alone, with zero approval gate.
2. A personal Course's owner can later invite other specific users to it.
3. An official institutional Course requires an approval step before a
   would-be member gains access — a bare "anyone with the link" model is
   not acceptable for this case, though it may be acceptable for a personal
   Course at the owner's discretion.
4. A Course being publicly listed/discoverable must not itself grant access
   — discoverability and authorization are different facts, checked
   separately.
5. Deny-by-default at the RLS layer (already the actual posture per
   ADR-013 — RLS enabled with zero policies today) must remain achievable:
   whatever shape is chosen must let a future RLS policy answer "does this
   `auth.uid()` have access to this `course_id`?" as a single, efficient,
   auditable check — not a chain of application-only inferences.
6. Archiving/reactivation is a per-(user, course) fact, not a per-Course
   fact — two learners in the same Course can have different archive
   states, since archiving is described as a *learner's* perspective on a
   Course, not the Course's own lifecycle state.
7. Must not require Institution, CourseRole enums, or admin tooling to exist
   before a single lecturer can run a classroom pilot (the Ruppin demo
   constraint, Section 4).

---

## 3. Four models compared

Each option is described as an *additive* schema next to the existing
`courses` table (`id`, `owner_user_id`, `title`, timestamps — unchanged in
every option below).

### A. Simple `CourseMembership` (no role distinction)

```sql
create table course_memberships (
  user_id uuid not null references users(id),
  course_id uuid not null references courses(id),
  joined_at timestamptz not null default now(),
  archived_at timestamptz null,  -- per-(user,course) archive state, requirement 6
  primary key (user_id, course_id)
);
```

Access rule: a user has access to a Course iff they are `owner_user_id` OR
have a `course_memberships` row for it. No distinction between "the
lecturer who owns it" and "a student who joined it" beyond the separate
`owner_user_id` check — anyone who joins is functionally equivalent once
joined.

**Pros**: smallest possible schema; trivial RLS policy (`EXISTS (SELECT 1
FROM course_memberships WHERE user_id = auth.uid() AND course_id =
courses.id) OR owner_user_id = auth.uid()`); satisfies requirements 1, 2, 4,
6 directly; works immediately for a personal Course with invited friends.

**Cons**: cannot express "this is an official institutional Course
requiring approval" as a schema-level fact — approval-gating becomes an
application-layer convention (e.g. "membership rows for official Courses
are only ever inserted by a server-side approval flow, never by learner
self-service") rather than something the schema itself distinguishes. Two
different join semantics (open self-join for personal, approval-gated for
official) sharing one table with no marker is a foot-gun: a future
self-service "join by link" feature for personal Courses could accidentally
be wired to the same insert path used for official Courses if nothing in
the schema forces the distinction to be considered. Cannot express "lecturer
who can manage content" vs. "student" — content-management authorization
(Section 5) would need a second mechanism entirely, likely reusing
`owner_user_id` alone, which does not extend to a TA or co-lecturer.

**Ruppin demo**: works — one lecturer (`owner_user_id`), students join via
a link that inserts `course_memberships` rows (or a signed link the
server validates before inserting, so "QR join" is still a controlled
insert path, not literally public write access).

**Institutional-administration blocking**: does not block it, but doesn't
help it either — a later institutional layer would need to be bolted on
top (Option C) rather than reusing this table's semantics for "approved."

### B. `CourseMembership` + separate `CourseRole`

```sql
create table course_memberships (
  user_id uuid not null references users(id),
  course_id uuid not null references courses(id),
  role text not null check (role in ('owner','lecturer','ta','student')),
  joined_at timestamptz not null default now(),
  archived_at timestamptz null,
  primary key (user_id, course_id)
);
```

(Role enum values illustrative — not decided; `docs/DATABASE.md` has no
committed role vocabulary yet.)

Access rule: same existence check as A, but `role` now also answers content-
management authorization (Section 5) directly: `role IN ('owner','lecturer',
'ta')` for management actions, any row at all for learning access.

**Pros**: same RLS simplicity as A (one join, `role` just becomes an
additional selected/filtered column); directly satisfies the product
direction's "official Course material can be promoted/managed only by
lecturer/course-management roles" without inventing a second table;
`owner_user_id` on `courses` becomes redundant with a `role = 'owner'` row
(though nothing forces removing it — it could remain as a fast-path
denormalization). Distinguishing "official Course requiring approval" from
"personal Course" is still not a schema fact in this option either — that
gap is identical to A.

**Cons**: one more column and one more enum to govern (which values exist,
who can assign them) — a small but real addition to V1 surface area for
something the product direction does not yet fully specify (a "TA" role is
not mentioned anywhere in the given direction; only "lecturer/course-
management roles" is). Introducing an enum before its full value set is
settled risks a migration churn if V1 only actually needs `owner` vs.
`member` initially.

**Ruppin demo**: works identically to A; the lecturer's row is `role =
'lecturer'` (or `'owner'`) instead of relying solely on `courses
.owner_user_id`.

**Institutional-administration blocking**: does not block it. `role` is a
useful primitive institutional administration would also want, so building
it now is not wasted if V1 needs it anyway for content-management
authorization (Section 5 argues V1 likely does).

### C. Institution enrollment/provisioning layer

```sql
create table institutions (id uuid primary key, name text not null, ...);

create table institution_course_offerings (
  course_id uuid not null references courses(id),
  institution_id uuid not null references institutions(id),
  ...
);

create table institution_enrollments (
  user_id uuid not null references users(id),
  institution_id uuid not null references institutions(id),
  approved_at timestamptz not null,
  approved_by uuid null references users(id),  -- null = automated (e.g. email-list match)
  ...
);
```

Course access for an institutional Course would then be *derived*:
membership = "an approved `institution_enrollments` row for this
Course's institution" rather than a direct per-Course row.

**Pros**: models "approved membership... from institutional email
lists/admin provisioning" as a first-class schema concept, exactly matching
that specific product-direction bullet; cleanly separates "who does the
institution say may access its Courses" from "does this particular Course
exist" — a genuine institutional multi-Course, multi-cohort administration
model would eventually need something like this.

**Cons**: requires `Institution` to exist as a real, populated entity before
a single official Course can use approval-gating at all — but `Institution`
is explicitly "architecture-ready, not V1 blocker" (ADR-006, `docs/PRODUCT
.md` §2/§20) and the product owner has given no email-list/provisioning
integration to build against yet ("may later come from," per the direction
above — a future capability, not a present one). Building this now means
building institutional multi-tenancy machinery (`docs/DATABASE.md` §46:
"do not introduce full institutional multi-tenancy in V1") for a Ruppin
demo that has exactly one lecturer and one course and does not need
institution-level enrollment at all. This is the textbook case
`docs/ARCHITECTURE.md` §35 warns about: building future functionality
instead of merely avoiding a dead end.

**Ruppin demo**: does not fit without first fabricating an `institutions`
row and enrollment records purely to unblock a single-course pilot — real
overhead for zero present benefit, and a to real security value either
(the pilot's actual access-control need — "these specific students, this
one lecturer" — is answered just as well, more simply, by A or B).

**Institutional-administration blocking**: this option *is* the eventual
institutional-administration answer, so it does not block itself, but
adopting it as the V1 baseline forces every Course (including personal
ones with zero institutional affiliation) to reason about an
institution-shaped access path that does not apply to them.

### D. `Course` vs `CourseOffering` split, now vs. later

Splitting the abstract "subject" (`Course`, e.g. "Introduction to
Statistics" as a catalog concept) from a specific taught instance
(`CourseOffering`, e.g. "Fall 2026, Dr. Cohen's section") — membership and
access would attach to the `CourseOffering`, not the abstract `Course`.

**Pros**: matches the product direction's explicit framing precisely
("official academic Courses are specific teaching instances... not
abstract subjects") in its most literal reading — if UNLOCK later wants to
show "this subject has been taught 4 times across 3 lecturers," a genuine
catalog/offering split is the correct long-term shape.

**Cons**: the product direction's own wording already resolves the thing
this split exists to represent — it says the *specific teaching instance*
**is** "the Course" for V1 purposes ("same nominal subject taught by
different lecturers/years may be different Courses"), which is exactly
what happens today with zero schema change: two `courses` rows, two
`owner_user_id`s, no shared "subject" record connecting them, and nothing
in the current product scope asks for that connection to be queryable.
Introducing `CourseOffering` now would mean modeling a `Course`-as-catalog
concept nobody has asked to browse or aggregate yet — pure speculative
structure for a V1 that has no cross-offering feature. This is the same
`docs/ARCHITECTURE.md` §35 anti-pattern as Option C, applied to a
different axis (content taxonomy instead of institutional tenancy).

**Ruppin demo**: unaffected either way — a single offering is
indistinguishable from a single Course.

**Institutional-administration blocking**: does not block it — if UNLOCK
later wants a catalog view, the existing `courses` table can be
range-partitioned into `courses`/`course_offerings` at that point by
introducing an optional `catalog_course_id` nullable FK on `courses`,
additively, exactly the kind of "cheap extension point" ADR-006-style
decisions already rely on elsewhere. Nothing about keeping `courses` flat
today forecloses that split later.

---

## 4. Ruppin-demo / blocking / complexity / default-deny matrix

| Model | Works for Ruppin demo unmodified | Blocks later institutional admin | Requires institutional complexity now | Deny-by-default achievable with a single RLS join |
|---|---|---|---|---|
| A. Simple CourseMembership | Yes | No | No | Yes |
| B. CourseMembership + CourseRole | Yes | No | No | Yes |
| C. Institution enrollment layer | No (needs fabricated institution/enrollment rows) | No (it IS the future answer) | Yes | Yes, but the join is institution-shaped even for non-institutional Courses |
| D. Course vs CourseOffering split now | Yes (offering ≡ course when there's only one) | No | No | Yes (unaffected — orthogonal axis) |

---

## 5. Content-management authorization: a second, related gap

The product direction states "official Course material can be
promoted/managed only by lecturer/course-management roles." Options A and D
have no schema-level way to express "this member may manage content" versus
"this member may only learn from it" — only Option B (`role`) does directly.
Under A or D, that distinction would have to fall back to `courses
.owner_user_id` alone, which cannot represent a TA or co-lecturer the
product direction implies should also be able to manage content ("lecturer/
course-management **roles**," plural framing). This is flagged as a reason
to prefer B over A specifically — not a separate open question, since it's
already implied by the same product-direction bullet Section 3 analyzes.

---

## 6. Recommendation

**PROPOSED (not yet approved)**: **Option B — `CourseMembership` +
`CourseRole`** as the minimal V1 model.

Reasoning:

- It is the smallest model that satisfies every requirement in Section 2,
  including the content-management-role requirement Section 5 shows A and D
  cannot express without a second mechanism.
- It adds exactly one artifact beyond the unavoidable minimum (the `role`
  column/enum) relative to Option A, in exchange for closing a gap the
  product direction explicitly states as a requirement, not a nice-to-have.
- It does not require Institution, enrollment provisioning, or a
  Course/CourseOffering split to exist — all three remain exactly what
  ADR-006/`docs/DATABASE.md` §46/`docs/ARCHITECTURE.md` §35 already say
  they should be for V1: architecture-ready, not built now.
- The "official Course requires approval" requirement (Section 2, item 3)
  is **not** solved by B's schema alone — see Section 7's open item below.
  B only gives approval-gating a place to be enforced (a `course_memberships`
  insert only a trusted server path performs for official Courses); it does
  not itself decide what "approved" means operationally. That remains a
  real gap this brief surfaces rather than resolves (see below).
- If institutional administration becomes real later, `institution_id`
  nullable columns can be added to `courses` (ADR-006's own pattern) and an
  `institutions`/`institution_enrollments` layer (Option C) can sit
  alongside `course_memberships` as an additional, later-consulted
  authorization input — not a replacement requiring migration of existing
  personal-Course memberships.

## 7. What this brief leaves genuinely open (for the product owner, not this document, to decide)

- **STILL OPEN**: The exact `role` enum's value set — the product direction
  only names "lecturer/course-management," never TA, admin, or other roles.
  Recommend resolving this at the same time as Open Question #1 itself,
  since it is a small, coupled decision (same table, same migration).
- **STILL OPEN**: How an official Course's approval gate is actually
  operated in V1 — is there an admin UI, a CSV import, a manually-run
  script, or is this entirely out of scope until an actual institutional
  pilot exists? The product direction only says approval must exist for
  official Courses, not how it is granted in the absence of the future
  institutional provisioning feed it references. A plausible V1-minimal
  answer (**PROPOSED**, not decided): a lecturer/owner with `role IN
  ('owner','lecturer')` on a Course can directly insert `course_memberships`
  rows for specific users (manual roster entry), with QR/link joining
  disabled for Courses flagged as requiring approval and enabled by default
  for personal Courses. This still requires a schema-level "does this
  Course require approval to join" flag, which is **not** part of the
  minimal Option B schema above and would need to be added (e.g. a boolean
  or enum on `courses` itself) — flagged here as a likely necessary
  follow-up to whatever this brief's recommendation settles, not resolved
  in this document.
- **STILL OPEN**: Whether `courses.owner_user_id` is retired in favor of a
  `role = 'owner'` membership row, or kept as a denormalized fast path
  alongside `course_memberships`. Both are workable; this brief does not
  pick one.
- **STILL OPEN**: The actual RLS policy text implementing whichever model
  is chosen — this brief describes the *shape* of the authorization check,
  not the finished SQL policy, per `docs/DATABASE.md` §29's own note that
  real policies wait on Open Question #1 being resolved first.

---

## Related Documents

- `docs/OPEN_QUESTIONS.md` #1 (the question this brief informs, does not
  resolve)
- `docs/DECISIONS/006-course-does-not-require-institution.md`
- `docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`
  (current deny-by-default RLS posture this brief's recommendation must
  remain compatible with)
- `docs/DATABASE.md` §5, §28, §29, §46
- `docs/PERSISTENCE_SCHEMA_V1.md` (`courses` table)
- `docs/CONTENT_IP_THREAT_MODEL.md` (companion document — content/IP risk,
  written separately)
- `docs/MASTER_SPEC.md` §7 (academic domain model, Institution/Course/
  Topic/Material/Question hierarchy)
- `docs/ARCHITECTURE.md` §35 (architecture-ready vs. building now)

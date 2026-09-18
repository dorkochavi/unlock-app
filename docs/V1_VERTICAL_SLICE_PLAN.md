# UNLOCK V1 Vertical Slice Plan

Status: Planning document only — Phase 9 of the overnight hardening session.
Not an ADR. Not implemented. Describes the shortest path from the current
repo state to one working end-to-end learner journey.

This document does not decide anything docs/OPEN_QUESTIONS.md still lists as
open. Where a checkpoint is blocked by a genuinely open product question,
this document says so explicitly rather than assuming an answer.

**Cross-reference note**: as of this writing, neither
`docs/COURSE_ACCESS_MODEL_DRAFT.md` nor `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
exist yet. Checkpoint 0 below is written directly against
`docs/OPEN_QUESTIONS.md` #1's own framing. If `COURSE_ACCESS_MODEL_DRAFT.md`
is written later (see the parallel Phase 6 output of this same session), it
should supersede Checkpoint 0's authorization-model framing, and this
document's reference to it should be updated rather than left stale.

---

## 0. What already exists (verified, not assumed)

Fully implemented and tested (405 tests: 308 unit + 97 schema/integration,
all green as of this session's baseline):

- `src/domain/learning/` — the entire deterministic learning engine
  (evidence, evidence strength, lapse, learning-session, mastery,
  misconception, progress-update, retrieval-qualification, rebuild,
  scheduler + ts-fsrs adapter, scheduler-rating, next-best-action,
  next-best-action-ranking, today-planner, answer/ADR-014).
- `src/application/learning/` — `submitAnswer`, `getOrCreateTodaySession`/
  `getTodaySession`, and the full `ports.ts` contract.
- `src/infrastructure/postgres/` — real adapters for every port, verified
  against PGlite (`supabase/tests/`).
- Two migrations (`20260917203000_initial_schema.sql`,
  `20260918000000_question_answer_model_v1.sql`), schema-verified.

Not implemented at all, verified by inspection:

- No Supabase SDK dependency in `package.json` (`@supabase/supabase-js`,
  `@supabase/ssr`, etc. are all absent).
- No Auth of any kind. `users.id` has no FK to `auth.users` and no default —
  every row must be inserted with an explicit id (see the initial
  migration's own comment).
- No RLS policies — every V1 table has RLS enabled with **zero** policies
  (deny-by-default for `anon`/`authenticated`, per ADR-013).
- No API routes. `src/app/` is still the default Next.js scaffold
  (`layout.tsx`, `page.tsx`, `favicon.ico`, `globals.css` only).
- No UI beyond the default scaffold. No `src/messages/` usage in any route
  yet (the messages layer itself exists — `src/messages/he.ts` — but nothing
  renders it).
- No course-membership/enrollment table of any kind — `courses.owner_user_id`
  is the only access-relevant column that exists (see
  `docs/PERSISTENCE_SCHEMA_V1.md`'s own explicit note: this is "NOT a
  closure of docs/OPEN_QUESTIONS.md #1").

**The single blocking dependency for everything above the current line is
`docs/OPEN_QUESTIONS.md` #1 (User↔Course authorization model).** Auth
wiring, RLS policies, and every API route are all explicitly deferred on it
(see `docs/API_V1_DRAFT.md`'s own "Why this stays undecided/unimplemented"
section and `CLAUDE.md`'s "Current Blocker").

---

## 1. Target journey

```
User
→ signs in
→ joins one authorized Course
→ opens Today
→ sees a Question
→ submits Answer
→ Attempt persists
→ Progress updates
→ sees feedback
→ completes Today
→ reopens and resumes
→ returns another day and gets new recommendations
```

This slice is **single-Course Today only**, matching ADR-011. It does not
build toward or assume Global Today
(`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` if/when it exists is a separate,
not-yet-approved product direction — see that phase's output).

---

## 2. Checkpoints

### Checkpoint 0 — Minimal User↔Course authorization decision + schema

**Tag: V1 REQUIRED (blocks everything else).** Nothing past this point can
be built honestly without it — not "RUPPIN DEMO REQUIRED" as a separate
item, because the Ruppin demo needs this too, just possibly a narrower
version of it (see the demo-scoping note below).

**Product decisions required first**: `docs/OPEN_QUESTIONS.md` #1 itself.
This is the one decision this whole plan is blocked on. It does not need
the FULL general-purpose model to unlock this vertical slice — it needs
enough of an answer to say concretely "how does a specific signed-in user
get treated as authorized for a specific Course row." Two honestly
different sub-answers would both unblock this checkpoint without deciding
more than necessary:

- **Narrowest (Ruppin-shaped)**: a single `course_members` table with just
  `(course_id, user_id)` — "is this user a member of this course," no
  roles, no invitation flow, no institutional layer. A lecturer's one
  course, learners added by an admin/seed script or a simple invite link.
  This alone is enough to write a real RLS policy and a real route-level
  authorization check.
- **Slightly broader (matches `docs/DATABASE.md` §5's candidates)**: the
  same table plus a `role` column (`student`/`owner`) if instructor-side
  operations (creating the Course, seeding content) are also expected to
  go through the same authorization surface rather than a service-role
  script.

This document does NOT choose between these — that choice is exactly
`docs/OPEN_QUESTIONS.md` #1, and whoever resolves it should look at the
Phase 6 output of this session (`docs/COURSE_ACCESS_MODEL_DRAFT.md`, if
produced) for the fuller comparison (CourseMembership vs. CourseMembership+
CourseRole vs. Institution enrollment vs. Course/CourseOffering split). This
checkpoint only asserts: **whichever is chosen, it must exist as a real
table with a real FK to `courses`/`users` before Checkpoint 1 can write a
real RLS policy**, and the narrowest version above is sufficient to unblock
this entire vertical slice — choosing the broader model is not required to
proceed.

**Code required**: none yet (schema + decision only).

**Schema required**: one new forward-only migration adding the chosen
membership table (e.g. `course_members`), with FKs to `courses(id)` and
`users(id)`, `ON DELETE RESTRICT` (matching this schema's existing
convention for historical/authorization-relevant rows).

**Tests required**: schema-level tests analogous to
`supabase/tests/schema.integration.test.ts`'s existing style — FK
correctness, uniqueness (`UNIQUE (course_id, user_id)`), no orphaned rows.

**Manual acceptance test**: n/a — this checkpoint has no runtime behavior
yet, only a decided, migrated table.

**Rollback/reversibility risk**: LOW if the narrowest shape is chosen. A
flat membership table is additive and easy to extend later (adding a `role`
column, or a separate `course_roles` table) without breaking anything built
on top of it in later checkpoints, because every later checkpoint only ever
asks "is this user authorized for this course" — a question a broader model
can still answer.

---

### Checkpoint 1 — Supabase Auth wiring (sign in)

**Tag: V1 REQUIRED.**

**Product decisions required first**: none beyond Checkpoint 0 being
resolved. The Auth *mechanism* itself (email/password, magic link,
OAuth provider) is explicitly left open by `docs/API_V1_DRAFT.md` ("The
actual Auth mechanism... this document only says wherever it comes from,
resolve userId before the application layer, never after") — pick the
cheapest one that works for a supervised classroom demo (Supabase's
built-in email/password or magic-link auth needs no additional provider
setup) unless the user has a stated preference.

**Code required**:
- Add `@supabase/supabase-js` (and `@supabase/ssr` for Next.js App Router
  server/client session handling) — the first new production dependency
  this repo would add since the domain/application/infrastructure layers
  were built with zero Supabase imports by design (ADR-013 §2). This is
  the correct, intended place for that dependency to finally appear.
- A server-side Supabase client factory (reads session from cookies) —
  this is new infrastructure, analogous in spirit to
  `src/infrastructure/postgres/connection-provider.ts` but for
  Auth/session, not domain persistence. It does not belong in
  `src/infrastructure/postgres/`.
- Minimal sign-in/sign-out routes or Server Actions.
- `users` row provisioning: the initial migration's design assumes
  `users.id = auth.users.id` conceptually, with **no FK and no default**
  (deliberately, per ADR-013 §4) — this checkpoint must decide and
  implement how a `public.users` row actually gets created the first time
  someone signs in (a Postgres trigger on `auth.users` insert, or an
  application-side "ensure user row exists" call on first authented
  request). This is a genuinely new decision this plan surfaces — it is
  not addressed by any existing ADR. Recommend the simplest option (an
  application-side upsert on first authenticated request) to avoid a new
  DB trigger for a one-time bootstrapping concern, consistent with how
  ADR-009 already made an equivalent call for `questions.current_version_id`.

**Schema required**: none beyond what Checkpoint 0 added — `users` already
exists and needs no migration, only the provisioning path above.

**Tests required**: this is the first checkpoint needing genuinely new
test infrastructure this repo does not have yet — an integration test that
exercises a real (or emulated) Auth flow and confirms a `public.users` row
exists afterward. No existing test harness covers this; it is out of scope
for the PGlite-based schema tests (PGlite has no `auth` schema/Supabase Auth
emulation).

**Manual acceptance test**: sign in via the chosen mechanism in a browser;
confirm a session cookie is set and a matching `public.users` row exists in
the database.

**Rollback/reversibility risk**: MEDIUM. Swapping the Auth *mechanism*
later (e.g. email/password → SSO) is low-risk if the `users` provisioning
path is decoupled from the specific mechanism, which the recommended
"upsert on first authenticated request" approach already is. Choosing a
provisioning approach that hard-codes assumptions about one specific Auth
mechanism would raise this risk.

---

### Checkpoint 2 — Real RLS policies for the journey's tables

**Tag: V1 REQUIRED.**

**Product decisions required first**: Checkpoint 0's model must be settled
and migrated — RLS policies need a real table to join against.

**Code required**: none (SQL migration only, no application code).

**Schema required**: a new migration adding real policies, replacing the
"RLS enabled, zero policies" posture with concrete `USING`/`WITH CHECK`
clauses, for exactly the tables this journey touches:
- `courses` — a user can `SELECT` a Course they are a member of
  (`course_members`).
- `today_sessions`, `today_session_items` — a user can `SELECT`/`INSERT`
  only rows where `user_id = auth.uid()`.
- `attempts` — a user can `SELECT`/`INSERT` only rows where
  `user_id = auth.uid()`. **Note**: V1's actual write path goes through
  `submitAnswer`, called from a server-side route using a trusted
  connection (not directly from the browser via PostgREST) — see
  Checkpoint 3. RLS on `attempts` for the `authenticated` role is still
  valuable defense-in-depth (and required if any future client-side
  Supabase read of a learner's own Attempts is ever added), but it is not
  the sole enforcement mechanism for the write path.
- `user_question_progress` — a user can `SELECT` only rows where
  `user_id = auth.uid()`. No client-side `INSERT`/`UPDATE` policy is
  needed at all — every write to this table goes through `submitAnswer`'s
  transaction, never PostgREST directly.
- `question_versions`, `questions`, `materials` — a user can `SELECT` only
  rows whose `course_id` (or transitively, via `question_id`) is a Course
  they are a member of.

Policies must not be written as "allow all authenticated users" —
ADR-013 explicitly rejected that as a placeholder to avoid walking back
later; this checkpoint is what makes that walk-back point.

**Tests required**: policy tests are the one area `supabase/tests/`
(PGlite) genuinely cannot cover — PGlite does not implement Supabase's
`auth.uid()`/JWT claims or RLS policy evaluation the way a real
Supabase/Postgres instance does. This is the first item that needs
`docs/REAL_POSTGRES_VERIFICATION_PLAN.md`-style real-Postgres verification
(see this session's Phase 4 output), not a new PGlite test. At minimum:
one authenticated-as-user-A request must never be able to read/write
user-B's `attempts`/`user_question_progress`/`today_sessions` rows, and a
non-member must never be able to read a Course's `questions`.

**Manual acceptance test**: using two real Supabase test accounts (A and
B), confirm A cannot query B's Attempts via the Supabase client, and a
third account with no Course membership cannot see the Course's Questions
at all.

**Rollback/reversibility risk**: MEDIUM-HIGH. Getting RLS wrong in the
*permissive* direction (a policy that's broader than intended) is a real
data-exposure risk that may not be caught by ordinary functional testing —
this is exactly the class of finding
`docs/CONTENT_IP_THREAT_MODEL.md` (Phase 7 output) exists to reason about
for a broader set of assets. Getting it wrong in the *restrictive*
direction (breaks legitimate access) is caught quickly and is low-risk to
fix.

---

### Checkpoint 3 — `submitAnswer` API route

**Tag: RUPPIN DEMO REQUIRED and V1 REQUIRED** (the demo needs the same
route V1 needs — there is no cheaper version of this specific checkpoint).

**Product decisions required first**: none beyond Checkpoints 0–2. HTTP
status code mapping (`docs/API_V1_DRAFT.md`'s own "Deferred" list) is a
genuinely open implementation detail, not a product decision blocking
correctness — pick reasonable codes (200 for `ACCEPTED`, 409 for
`IDEMPOTENCY_KEY_CONFLICT`, 404 for `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED`,
422 for `QUESTION_VERSION_CONSISTENCY_VIOLATION`/`INVALID_SELECTED_ANSWER`,
500 for anything unhandled) and record the mapping in an ADR once actually
implemented, per `docs/API_V1_DRAFT.md`'s own instruction to promote
settled parts into an ADR after implementation.

**Code required**:
- `src/app/api/learning/submit-answer/route.ts` — the **first real caller
  of `submitAnswer` from outside a test**. Implements exactly the shape
  `docs/API_V1_DRAFT.md` §1 already specifies: parses `SubmitAnswerRequestDto`
  from the request body, derives `userId` from the authenticated session
  (Checkpoint 1's session mechanism) — never from the body — constructs
  `SubmitAnswerCommand`, and calls `submitAnswer` with a real
  `PostgresUnitOfWork` (already implemented,
  `src/infrastructure/postgres/postgres-unit-of-work.ts`) and a real
  `SubmitAnswerContext` (composition root: injects the real
  `engineVersion`, the ts-fsrs `MemoryScheduler`
  (`src/infrastructure/learning/fsrs/`), the still-undecided policy objects
  — see the blocker note below — and `determineSuspiciousTiming: () =>
  false`, an honest "no anomaly signal available" per that field's own
  documented contract).
- DTO validation (Zod, per `docs/ARCHITECTURE.md` §22's stated direction —
  this is the first place in the repo that would actually need it).

**Important cross-cutting blocker this checkpoint surfaces, not previously
called out as blocking a checkpoint**: `SubmitAnswerContext` requires
`retrievalQualificationPolicy`, `evidenceStrengthPolicy`, `masteryPolicy`,
`misconceptionPolicy` — every one of these has **no production default
anywhere in the codebase** (deliberately — see each module's own doc
comment: "no default production policy is exported here"). This checkpoint
cannot call `submitAnswer` for real without *some* concrete values for all
four. This is not this checkpoint's decision to make silently — it is
`docs/OPEN_QUESTIONS.md` #11/#12/#13 territory. **This checkpoint is
therefore partially blocked**: the route's plumbing can be built and unit
-tested against fakes, but it cannot be exercised end-to-end against a real
Course with real content until a real (even if provisional/pilot-only)
policy configuration is chosen and explicitly documented as such — not
silently hard-coded as if it were a settled formula.

**Schema required**: none — reuses `attempts`/`user_question_progress`
exactly as they exist.

**Tests required**: this is the first genuinely new test *category* the
project needs beyond what exists — HTTP-route-level tests (request →
response shape, auth-derived `userId`, status code mapping) using Next.js's
route testing conventions or a lightweight fetch-based integration test.
None of the existing 405 tests exercise anything above the application
layer.

**Manual acceptance test**: with a signed-in, Course-member test user and a
seeded Question, `POST` a valid submission and confirm (a) a 2xx response,
(b) a new row in `attempts`, (c) an updated row in `user_question_progress`,
by direct DB inspection.

**Rollback/reversibility risk**: LOW for the route itself (thin, easily
rewritable). MEDIUM for whatever provisional policy values get chosen
under the blocker above — if they're later replaced by a real product
decision, existing `UserQuestionProgress` rows computed under the
provisional policy do not automatically become wrong (ADR-012 already
establishes that a rebuild always uses current policy, so this is
self-correcting on the next rebuild), but any *learner-facing* claim made
under the provisional thresholds (e.g. "you've mastered this") could look
inconsistent if thresholds change later — worth flagging to the demo
audience as provisional, not polished.

---

### Checkpoint 4 — Today API routes

**Tag: RUPPIN DEMO REQUIRED and V1 REQUIRED.**

**Product decisions required first**: `docs/OPEN_QUESTIONS.md` #16 (Today
session size / `TodayPlannerPolicy.maxItems`) has the same "no production
default" problem as Checkpoint 3's four policies —
`today-planner.ts`'s own doc comment: "no default `maxItems` is chosen
here." A concrete number must be chosen (even a provisional one) to call
`getOrCreateTodaySession` for real. `docs/OPEN_QUESTIONS.md` #3 (Today
session boundary/timezone) also surfaces here concretely: `plannedForDate`
must come from *somewhere* real (today's date in some timezone) — the
domain/persistence layers are deliberately timezone-agnostic and expect an
already-resolved `YYYY-MM-DD` string, so this checkpoint's route is where a
real (if provisional — e.g. "server UTC date" for a single-timezone
classroom pilot) resolution must finally happen. Document the provisional
choice explicitly rather than treating it as decided.

**Code required**:
- `src/app/api/learning/today/route.ts` — `GET` maps to `getTodaySession`
  (pure read), `POST` maps to `getOrCreateTodaySession`, matching
  `docs/API_V1_DRAFT.md` §2 exactly. `userId` derived from session,
  `courseId` from the request, `plannedForDate` resolved per the note
  above — **first real caller of `getOrCreateTodaySession`/
  `getTodaySession` from outside a test.**

**Schema required**: none.

**Tests required**: route-level tests analogous to Checkpoint 3's.

**Manual acceptance test**: a signed-in Course member with at least one
`UserQuestionProgress` row (seeded via Checkpoint 3, or directly) calls
`POST /api/learning/today`; confirm a `today_sessions` row and its items
exist and match what `getOrCreateTodaySession`'s existing unit tests
already prove the domain logic produces for that input. Calling it a
second time must return the identical session (no duplicate/regenerated
plan) — this is directly testable via existing behavior, not new behavior.

**Rollback/reversibility risk**: LOW. Same shape as Checkpoint 3.

---

### Checkpoint 5 — Minimal Today + Quiz + feedback UI (Hebrew/RTL)

**Tag: RUPPIN DEMO REQUIRED and V1 REQUIRED.**

**Product decisions required first**: none beyond what's already decided —
this checkpoint is pure execution against `docs/PRODUCT.md` §5/§11 (Today,
Quiz contract) and ADR-002 (Hebrew/RTL first). The specific visual design
is not a blocking product decision; a plain, accessible RTL Hebrew UI is
sufficient for V1/demo purposes per `docs/PRODUCT.md` §19's explicit "V1
does not require a complex analytics dashboard" spirit applied to UI
polish generally.

**Code required**:
- A Today page: calls Checkpoint 4's route, renders `TodaySessionItem`s.
- A Quiz component: renders one Question at a time from the session's
  items, using `question_type`/`answer_options` already loaded (a new
  small read — `getCurrentVersion`/an equivalent Question-content read;
  **note**: no existing port currently returns full Question *content* for
  display, only `AnswerCorrectnessChecker` does, and only for grading —
  this checkpoint needs its own minimal "load Question content for
  display" read, analogous in spirit to but distinct from
  `PostgresAnswerCorrectnessChecker`, since that adapter's job is
  correctness computation, not rendering).
- Answer submission calls Checkpoint 3's route with a client-generated
  `submissionId` (UUID) and, critically, a **stable `answeredAt`** captured
  once per attempt and resent unchanged on any client-side retry (ADR-010's
  "Client retry contract" — this is a UI-layer responsibility this plan
  must not silently skip).
- Feedback: correct/incorrect + explanation, per `docs/PRODUCT.md` §11/§16.
- `src/messages/he.ts` actually gets consumed for the first time.

**Schema required**: none.

**Tests required**: component/UI-level tests are genuinely new territory
for this repo (no `src/components/`/`src/features/` exist yet at all,
per `docs/ARCHITECTURE.md` §26's expected structure). At minimum: a smoke
test that the Quiz component renders RTL correctly and that submitting an
answer calls the route with a stable `submissionId`/`answeredAt` across a
simulated retry.

**Manual acceptance test**: open the Today page as a signed-in Course
member in a browser, see a Question rendered right-to-left in Hebrew,
submit an answer, see correct/incorrect feedback, advance to the next
item, and see "Today complete" after the last item — the full
`docs/MASTER_SPEC.md` §68.3 critical E2E flow, manually walked once.

**Rollback/reversibility risk**: LOW. UI is the most freely rewritable
layer in this stack by design (`docs/ARCHITECTURE.md` §4's whole point).

---

### Checkpoint 6 — Session resume behavior

**Tag: RUPPIN DEMO REQUIRED and V1 REQUIRED** (this is not a "nice to
have" — `docs/PRODUCT.md` §6/§27 treats persistent-session resume as a
core product requirement, not a stretch goal).

**Product decisions required first**: `docs/OPEN_QUESTIONS.md` #3 (Today
Session Boundary) remains genuinely open for the *general* case (local
calendar day vs. rolling 24h vs. learner-defined study day). For THIS
checkpoint specifically, the underlying mechanism (Checkpoint 4's `GET`
route calling `getTodaySession`, a pure read keyed by the already-resolved
`plannedForDate`) already makes resume work correctly for the simplest
case — "same server-resolved calendar date" — without needing #3 fully
resolved. Document this as a known simplification, not a hidden decision:
a learner whose session spans a midnight boundary in a real classroom pilot
may see behavior that doesn't match a more sophisticated future
timezone-aware boundary rule, and that's acceptable for a demo/pilot scope
but should not be presented as "solved."

**Code required**: none beyond what Checkpoints 4–5 already built — this
checkpoint is really a *verification* checkpoint (does the plumbing already
built actually resume correctly?) rather than new code, since
`getOrCreateTodaySession`'s race-free "create or return existing" behavior
and `getTodaySession`'s pure-read semantics are already fully implemented
and unit-tested (`today-session.test.ts`'s "Today resume" test already
proves this at the application layer).

**Tests required**: none new at the application layer (already covered).
One new E2E-style manual/automated check that the UI layer itself
(Checkpoint 5) correctly calls `GET` on reload rather than always calling
`POST`, and correctly re-renders in-progress state (which items are
already `completed`) rather than restarting from item 0.

**Manual acceptance test**: start Today, answer 2 of N items, close the
browser tab, reopen the Today page; confirm the same session resumes with
the first 2 items shown as completed and item 3 next, per
`docs/PRODUCT.md` §6's own example.

**Rollback/reversibility risk**: LOW — this checkpoint mostly de-risks
Checkpoints 4–5 rather than adding new risk of its own.

---

### Checkpoint 7 — Next-day re-recommendation (closing the loop end-to-end)

**Tag: V1 REQUIRED.** Not "RUPPIN DEMO REQUIRED" in the strict sense — a
single classroom session demo can show the adaptive loop's *domain* logic
via the existing golden-scenario tests without necessarily waiting a real
day — but genuinely demonstrating it live (not just in tests) is the
strongest possible proof point for a demo audience, so it is worth
attempting if the demo's timing allows a real multi-day pilot window.

**Product decisions required first**: none beyond what's already resolved.
This checkpoint is proof, not new product surface — it exists to catch any
integration gap between "the domain logic is proven correct in isolation"
(405 passing tests) and "a real signed-in user's real actions actually flow
through the real stack to change a real next-day recommendation."

**Code required**: none new — this checkpoint calls Checkpoint 4's `POST
/api/learning/today` again on a later `plannedForDate`, which by
construction (Course-scoped Today, `UNIQUE (user_id, course_id,
planned_for_date)`) creates a genuinely new session for the new date,
freshly ranked from whatever `UserQuestionProgress` looks like after
Checkpoint 3's Attempts updated it.

**Schema required**: none.

**Tests required**: none new at the unit level (already covered by
`submit-answer.test.ts`/`today-session.test.ts`/the golden scenarios). This
checkpoint's value is specifically in NOT being a unit test — it is the
one point in this plan whose entire purpose is manual/pilot verification
against the real stack.

**Manual acceptance test**: complete Today on day 1 with at least one
incorrect, high-confidence answer (to produce a misconception signal);
advance the server's/database's clock context to day 2 (or wait a real
day, for a genuine pilot); call `POST /api/learning/today` for the new
date; confirm the new session's top-ranked item reflects the
`REPAIR_MISCONCEPTION`/`RELEARN_LAPSE` priority the domain layer's own
tests already prove would result from that evidence — i.e., confirm the
REAL stack reproduces what the TESTS already predict, not that the
prediction itself needs re-deriving.

**Rollback/reversibility risk**: LOW — pure verification, no new
persistent state model introduced.

---

## 3. Post-V1 (explicitly out of scope for this slice)

Not required for the journey above, and not addressed by any checkpoint:

- Global Today (separate, not-yet-approved product direction).
- Starter/calibration experience (`docs/OPEN_QUESTIONS.md` #4/#5) — this
  slice's manual acceptance tests assume a learner already has at least one
  seeded `UserQuestionProgress` row (e.g. via a pilot-content seed script),
  not a cold-start new learner with zero history. A genuinely new learner
  hitting Checkpoint 4 for the first time would see an empty Today session
  (`today-session.test.ts` already proves this returns a real, empty
  session rather than an error) — which is honest but not yet the "Starter
  gives a new learner something useful to do" experience `docs/PRODUCT.md`
  §13 requires before general V1 launch. Fine for a supervised pilot where
  content is pre-seeded; not fine as a self-serve onboarding experience.
- Manual practice outside Today (`docs/OPEN_QUESTIONS.md` #32) — the
  application layer already supports it (`submitAnswer` works identically
  for `todaySessionItemId: null`), but no UI entry point is built here.
- Exam dates/urgency, assignments, Basic Progress dashboard, analytics
  events (`today_opened`/`today_started`/etc.), AI question generation,
  content upload/authoring UI — none of these block the target journey.
- Question/content authoring UI — this plan assumes Questions/
  QuestionVersions are seeded directly (SQL/script), not created through a
  UI, since no authoring feature contract exists yet.

---

## 4. Summary table

| # | Checkpoint | Tag | Blocked by |
|---|---|---|---|
| 0 | Minimal User↔Course authorization + schema | V1 REQUIRED | OPEN_QUESTIONS #1 |
| 1 | Supabase Auth wiring | V1 REQUIRED | Checkpoint 0 |
| 2 | Real RLS policies | V1 REQUIRED | Checkpoint 0 |
| 3 | `submitAnswer` route | RUPPIN DEMO + V1 REQUIRED | Checkpoints 1–2; provisional Learning Engine policy values (#11/#12/#13) |
| 4 | Today routes | RUPPIN DEMO + V1 REQUIRED | Checkpoint 3; provisional `maxItems` (#16) + `plannedForDate` resolution (#3) |
| 5 | Today/Quiz/feedback UI | RUPPIN DEMO + V1 REQUIRED | Checkpoint 4 |
| 6 | Session resume | RUPPIN DEMO + V1 REQUIRED | Checkpoint 5 (verification only) |
| 7 | Next-day re-recommendation | V1 REQUIRED | Checkpoint 6 (verification only) |

Every checkpoint after 0 is blocked, directly or transitively, on
`docs/OPEN_QUESTIONS.md` #1. That is the one decision that unlocks the
entire vertical slice; everything else in this plan is either already
implemented (and only needs a real caller) or a small, explicitly-flagged
provisional value standing in for a still-open threshold decision.

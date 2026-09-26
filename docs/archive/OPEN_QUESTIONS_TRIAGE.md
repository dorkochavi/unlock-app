# Open Questions Triage

Status: **HISTORICAL ANALYSIS SNAPSHOT — NOT CURRENT PROJECT STATE OR TASK QUEUE.**

This file preserves the triage performed at the time it was written. Many items
below were subsequently resolved, implemented, superseded, or reclassified.
Do not use the body of this document to determine current blockers or open
decisions. Current truth lives in `docs/OPEN_QUESTIONS.md`, accepted ADRs,
`docs/DEV_STATUS.md`, and the active `docs/CHATGPT_PLAN.md`.

Purpose at the time of writing: classify and score every item in
`docs/OPEN_QUESTIONS.md` (42 items) so the
product owner can see, at a glance, what kind of decision each one is, how much it
matters, and which ones are genuinely blocking near-term milestones. Written per the
"Open Question Discipline" process in `docs/OPEN_QUESTIONS.md` §42: this document
checked the Master Spec, PRODUCT.md, DOMAIN_GLOSSARY.md, all 14 ADRs, and the current
schema (`docs/PERSISTENCE_SCHEMA_V1.md`) before classifying each item — but it does
**not** resolve any of them. Several items below are flagged as *already answered but
the ledger is stale*; that flag is itself a claim requiring the product owner (or a
maintainer) to confirm and then update `docs/OPEN_QUESTIONS.md` — this document does
not edit that file.

Legend:

- **Classification**: PRODUCT DECISION / ARCHITECTURE DECISION / IMPLEMENTATION DETAIL
  / VALIDATION-NEEDED (honestly answerable only with real usage data) / STALE (already
  answered by a committed ADR or schema, ledger not updated) / PROCESS (not a decision
  item).
- **Blocking / Schema / UX / Ruppin / Prod** impact: None / Low / Medium / High.
- **Reversibility**: how costly to change after real learner data exists — Cheap /
  Moderate / Expensive.

---

> Historical-body note: statuses, blockers, implementation claims, test counts,
> and cross-references below intentionally describe the repository at the time
> this triage was produced. They are preserved as analysis history and are not
> maintained as current-state assertions.

## Per-item triage

### 1. User ↔ Course Relationship in V1
Classification: **PRODUCT DECISION** (with architecture consequences). Confirmed
genuinely open — `docs/PERSISTENCE_SCHEMA_V1.md`'s `courses.owner_user_id` explicitly
says it is "chosen only as the minimum needed to make this table concrete, **not** a
closure of `docs/OPEN_QUESTIONS.md` #1."
Blocking at the time: **High** (then named directly in `CLAUDE.md` as the blocker for Auth/RLS/API). Schema: High. UX: Medium. Reversibility: Expensive (authorization model changes touch every table's RLS policy). Ruppin: High. Production: High.

### 2. Effective V1 Exam-Date Hierarchy
Classification: **PRODUCT DECISION**. Genuinely open.
Blocking: Low today (no exam-urgency code exists yet). Schema: Medium (a shared exam-date column/table). UX: Medium. Reversibility: Moderate. Ruppin: Low (unless the demo showcases exam urgency). Production: Medium.

### 3. Today Session Boundary
Classification: **PRODUCT DECISION** with a technical (timezone) dimension —
borderline ARCHITECTURE DECISION. Genuinely open; `docs/PERSISTENCE_SCHEMA_V1.md`
confirms `planned_for_date` is "a caller-supplied `DATE` value. No day-boundary or
timezone logic exists in the domain or persistence layer."
Blocking: Medium (any real Today UI needs this to know when to show "new day"). Schema: Low (date column already exists; only the logic that produces the date value is missing). UX: High. Reversibility: Moderate. Ruppin: High (a demo running across a day boundary will expose this immediately). Production: High.

### 4. Starter Experience Eligibility
Classification: **PRODUCT DECISION**. Genuinely open; no Starter/calibration code exists (`today-planner.ts` explicitly does not fabricate NEW_LEARNING items).
Blocking: Medium (new-learner cold start has no defined behavior at all right now). Schema: Low. UX: High. Reversibility: Cheap. Ruppin: High (first-time users in a classroom demo will hit this immediately). Production: High.

### 5. Starter Sampling Strategy
Classification: **PRODUCT DECISION**, dependent on #4. Genuinely open.
Blocking: Medium (same as #4). Schema: Low. UX: Medium. Reversibility: Cheap. Ruppin: Medium. Production: Medium.

### 6. Question Editing and Historical Attempts
Classification: **STALE — already answered.** ADR-009 (`docs/DECISIONS/009-question-versioning.md`) resolves exactly this question: immutable `QuestionVersion` snapshots + a mutable `Question.current_version_id` pointer, implemented in the schema and covered by tests. `docs/OPEN_QUESTIONS.md` still lists this as `Status: OPEN`.
Blocking: None (resolved). Schema: — (done). UX: —. Reversibility: —. Ruppin: —. Production: —.
Recommendation for the ledger: mark RESOLVED, reference ADR-009.

### 7. Question Version Reference
Classification: **STALE — already answered.** Same ADR-009: `Attempt.questionVersionId` referencing an immutable `QuestionVersion` entity is the implemented answer, enforced by a composite FK in the schema.
Blocking: None. Recommendation: mark RESOLVED, reference ADR-009.

### 8. Learner State Persistence
Classification: **PARTIALLY STALE.** `UserQuestionProgress` persistence is fully decided and implemented (`user_question_progress` table, 100% rebuildable per `docs/PERSISTENCE_SCHEMA_V1.md`). Next Best Action persistence is separately resolved by ADR-010 (see #9 below). What remains genuinely open is **aggregate Learner State** persistence — no such table or code exists.
Blocking: Low (nothing currently depends on aggregate Learner State existing). Schema: Medium if a future aggregate table is added. UX: Low. Reversibility: Cheap. Ruppin: Low. Production: Low.

### 9. Next Best Action Persistence
Classification: **STALE — already answered.** ADR-010 explicitly confirms `docs/DATABASE.md` §16's direction: only the selected primary action per Question is persisted (on `TodaySessionItem`); no candidate/ranking-history table exists or is planned.
Blocking: None. Recommendation: mark RESOLVED, reference ADR-010.

### 10. Engine Versioning Granularity
Classification: **ARCHITECTURE DECISION**, still genuinely open. ADR-012 clarifies that `Attempt.engineVersion` is historical metadata only (never a dispatch key) but does not define what triggers a version bump.
Blocking: Low today (only one engine version exists). Schema: None (column already exists). UX: None. Reversibility: Cheap now, Expensive once multiple versions coexist in production data. Ruppin: Low. Production: Medium.

### 11. Mastery Scale
Classification: **PARTIALLY STALE.** The *representation shape* is already decided by implementation: `mastery.ts`/`types.ts` use a discrete learner-facing `MasteryCategory` enum (`not_started`/`learning`/`strengthening`/`mastered`) derived from continuous underlying signals (evidence strength, retrievability, spacing) — i.e. exactly the "hybrid internal score + learner-facing category" option this question lists. What remains genuinely open is the **exact threshold values** (`MasteryPolicy` has no production defaults anywhere).
Blocking: Low. Schema: None. UX: Low (category is already avoid-false-precision by construction). Reversibility: Cheap (policy is injected, not hard-coded). Ruppin: Low. Production: Medium (thresholds materially affect learner-visible "mastered" claims).

### 12. Review Scheduling Rule
Classification: as already stated in the ledger — **partially resolved** (scheduler family DECIDED, ADR-008; evidence→rating mapping and retention configuration OPEN). This entry is accurate and current, not stale.
Blocking: Medium (the evidence→rating mapping directly gates what `scheduler-rating.ts` may do beyond its current conservative default). Schema: None. UX: Low. Reversibility: Moderate. Ruppin: Low. Production: Medium.

### 13. Misconception Rule
Classification: **PARTIALLY STALE.** The state machine and transition mechanism are fully implemented (`misconception.ts`: none→suspected→active→recovering→resolved, driven by `isConfidentErrorSignal`/`isQualifyingRecoveryEvidence`). What remains genuinely open is the exact **threshold/weight values** (`MisconceptionPolicy` has no production defaults; docs explicitly call this prototype-audit-pending).
Blocking: Low. Schema: None. UX: Low. Reversibility: Cheap. Ruppin: Low. Production: Medium.

### 14. Confidence Scale and Role
Classification: **PARTIALLY STALE.** The scale is already decided and implemented: `CONFIDENCE_LEVELS = ["low", "medium", "high"]` (`types.ts`), matching one of the options this question lists verbatim. `confidenceLevel` is nullable on `Attempt` (so it is optional by construction), and its one currently-implemented effect (feeding `CONFIDENT_ERROR`) is real code, not speculative. What remains open: whether confidence should have any *other* effects beyond the misconception signal, and the learner-facing UX for capturing it (no Quiz UI exists yet).
Blocking: Low. Schema: None. UX: Medium (capture UX undesigned). Reversibility: Cheap. Ruppin: Medium. Production: Medium.

### 15. Response-Time Interpretation
Classification: **PRODUCT DECISION**, genuinely open. `response-time-seconds` is captured and averaged, but deliberately not wired into any mastery/priority decision yet (`scheduler-rating.ts`: "HARD/EASY are intentionally NOT inferred from response time").
Blocking: Low. Schema: None. UX: Low. Reversibility: Cheap. Ruppin: Low. Production: Low.

### 16. Today Session Size
Classification: **PRODUCT DECISION**, genuinely open. `TodayPlannerPolicy.maxItems` has no production default anywhere by design.
Blocking: **High** for any real Today UI (nothing is currently configured — every existing test supplies its own arbitrary value). Schema: None. UX: High. Reversibility: Cheap (policy value, not schema). Ruppin: High. Production: High.

### 17. Today Composition
Classification: **PRODUCT DECISION**, genuinely open. Explicitly deferred in `today-planner.ts`'s own doc comment (no interleaving, no quotas, ranked-order truncation only).
Blocking: Medium. Schema: None. UX: Medium. Reversibility: Cheap. Ruppin: Medium. Production: Medium.

### 18. Explainability of Selection
Classification: **PRODUCT DECISION** for the learner-facing UX; the underlying data model is already stale-partial — `NextBestActionReason`/`otherApplicableTypes` already exist as machine-readable reasons (`next-best-action.ts`). What is genuinely open is the copy/UX layer (no Quiz/Today UI exists).
Blocking: Low (nothing built yet depends on it). Schema: None. UX: High. Reversibility: Cheap. Ruppin: Medium. Production: Medium.

### 19. Session Abandonment Definition
Classification: **PRODUCT DECISION** (with a VALIDATION-NEEDED flavor for the exact timeout value). Genuinely open; no analytics events exist yet.
Blocking: Low. Schema: Low. UX: Low. Reversibility: Cheap. Ruppin: Low. Production: Medium.

### 20. Active User KPI Denominator
Classification: **PRODUCT DECISION**, but the specific numeric definition would benefit from early pilot data (**VALIDATION-NEEDED** flavor). Genuinely open.
Blocking: None before analytics exist. Schema: None. UX: None. Reversibility: Moderate (changes historical KPI comparability). Ruppin: Low. Production: High (before any KPI reporting is trusted).

### 21. Week Boundary for KPI
Classification: **IMPLEMENTATION DETAIL** with product sign-off recommended (low product stakes, but affects KPI comparability). Genuinely open.
Blocking: None. Schema: None. UX: None. Reversibility: Moderate. Ruppin: None. Production: Medium.

### 22. Starter Sessions in KPI
Classification: **PRODUCT DECISION**, blocked by #4 (Starter doesn't exist yet, so this is moot until it does).
Blocking: None currently. Schema: None. UX: None. Reversibility: Cheap. Ruppin: None. Production: Medium.

### 23. Minimal Material Model
Classification: **PARTIALLY STALE.** A `materials` table already exists in the committed schema (`course_id`, `title`, `material_type`, `source_reference`, `created_by`, timestamps) — the base shape is implicitly decided by the migration, not by an ADR. What remains genuinely open: `material_type`'s exact enum values (`docs/PERSISTENCE_SCHEMA_V1.md` flags this explicitly as unresolved — no CHECK constraint exists for it, unlike every other closed-enum column in the schema).
Blocking: Low. Schema: Low (would only need a CHECK constraint added, not a new column). UX: Low. Reversibility: Cheap. Ruppin: Medium (if real course materials are uploaded for the demo). Production: Medium.

### 24. Content Entry for First Pilot
Classification: **PRODUCT DECISION**, genuinely open, no code path exists for any of the listed options.
Blocking: **High** for any pilot. Schema: Low. UX: Medium. Reversibility: Cheap (a pilot shortcut does not have to become the permanent design). Ruppin: **High**. Production: High.

### 25. Supabase Final Confirmation
Classification: as already stated — **PARTIALLY RESOLVED** (database/provider DECIDED, ADR-013; Auth/RLS/storage OPEN, gated on #1). Accurate, not stale.
Blocking: High (Auth/RLS portion blocks real API routes). Schema: None further for the DB choice itself. UX: None. Reversibility: Expensive if Auth is wired against the wrong model. Ruppin: High. Production: High.

### 26. Analytics Provider
Classification: **ARCHITECTURE DECISION**, genuinely open, low urgency until Today ships a real UI.
Blocking: Low. Schema: Low-Medium (event table vs. external provider). UX: None. Reversibility: Moderate. Ruppin: Low. Production: Medium.

### 27. Data Deletion Semantics
Classification: **PRODUCT DECISION** with legal/privacy weight, genuinely open.
Blocking: Low today (no deletion code paths exist — the schema currently makes most deletion physically impossible via `RESTRICT` FKs once Attempts exist, which is itself a de facto "cannot delete" answer for now, not a designed policy). Schema: Medium-High once a real policy is chosen. UX: Low. Reversibility: Expensive (deletion/anonymization is hard to retrofit safely). Ruppin: Low (unless a participant requests data removal). Production: **High** (required before any real personal data is collected at scale).

### 28. Question Retirement vs Deletion
Classification: **PARTIALLY STALE** in effect, not by explicit decision. The schema's `ON DELETE RESTRICT` from `question_versions`→`questions` already makes hard deletion of a used Question structurally impossible today — a de facto "retire, don't delete" posture — but `docs/PERSISTENCE_SCHEMA_V1.md` itself states this "ensures deletion cannot silently destroy history... not what a retirement flow itself looks like." No retirement/archive flag or UX exists.
Blocking: Low. Schema: Low (an archival flag is additive). UX: Low. Reversibility: Cheap. Ruppin: Low. Production: Medium.

### 29. Basic Progress Definition
Classification: **PRODUCT DECISION**, genuinely open, no code exists.
Blocking: Medium (blocks any "first usable UI" beyond raw Today). Schema: Low. UX: High. Reversibility: Cheap. Ruppin: Medium. Production: Medium.

### 30. Exam Readiness
Classification: **PRODUCT DECISION**, genuinely open, explicitly scoped "after core adaptive loop" by its own target phase.
Blocking: None now. Schema: Low. UX: Medium. Reversibility: Cheap. Ruppin: Low. Production: Low.

### 31. Course Structure Depth
Classification: **ARCHITECTURE DECISION** with product input, genuinely open. The current schema has no `topics`/`units` table — Questions attach only to `course_id`/`material_id` — meaning the "no formal Topic/Unit for V1" branch has been implicitly taken by omission, not decided.
Blocking: Medium (Starter sampling and coverage/readiness work all depend on this). Schema: **High** if Topic/Unit is added later (touches Question, Material, and any coverage analytics). UX: Medium. Reversibility: Expensive once many Questions exist without topic tags. Ruppin: Low. Production: Medium.

### 32. Manual Practice Outside Today
Classification: **STALE — already answered and implemented.** `submitAnswer` already has a fully-implemented, tested "manual practice" path (`todaySessionItemId === null`), including its own `learningSessionId` client-ownership rules (ADR-012 §5) and a dedicated passing test (`submit-answer.test.ts`, "7. manual practice (no TodaySessionItem) is accepted normally"). `docs/OPEN_QUESTIONS.md` still lists this as OPEN.
Blocking: None. Recommendation: mark RESOLVED, reference ADR-012 and `submit-answer.ts`.

### 33. Multiple Active Courses
Classification: **PARTIALLY STALE.** ADR-011 substantially answers this: a learner may have multiple `TodaySession` rows (one per active Course) on the same date; Today does not combine them; priority/ranking is computed independently per Course. What ADR-011 does not settle: whether V1 imposes any hard limit on the *number* of active Courses a learner may have, and how exam-date competition across Courses should work (tied to #2).
Blocking: Medium. Schema: None further (already course-scoped). UX: High (no UI exists for switching between multiple per-Course sessions). Reversibility: Moderate. Ruppin: Medium. Production: Medium.

### 34. Today Scope Across Courses
Classification: as already stated — **RESOLVED for V1** (ADR-011). Accurate, not stale. Note: Phase 5 of this hardening session's Global Today design draft treats "beyond V1" cross-course Today as a *new*, not-yet-approved product direction layered on top of this ADR, not a reopening of it.
Blocking: None (V1 scope). Ruppin: None. Production: None (until Global Today is pursued).

### 35. Learner Time Zone
Classification: **PRODUCT DECISION** with architecture consequences, genuinely open, tightly coupled to #3.
Blocking: Medium. Schema: Low (a `timezone` column on `users` is additive). UX: Medium. Reversibility: Moderate. Ruppin: Medium (a demo spanning a timezone boundary or evening session will expose this). Production: High.

### 36. Source of Truth for Derived Values
Classification: **PARTIALLY STALE.** The intended hierarchy (Attempts → UserQuestionProgress → aggregate Learner State → Today Session) is already documented in `docs/DATABASE.md` §34 and matches the implemented schema exactly for the layers that exist (Attempts, UserQuestionProgress, TodaySession/Items). The only genuinely open piece is the aggregate Learner State layer, which doesn't exist yet (same gap as #8).
Blocking: Low. Ruppin: Low. Production: Low.

### 37. Recalculation Strategy
Classification: **STALE — already answered.** ADR-012 explicitly decides this: rebuild always recomputes from immutable Attempts using CURRENT engine/scheduler/policy logic, on demand (`rebuildUserQuestionProgress`), never "left under old version" or "migrated selectively." Fully implemented and tested (`rebuild.test.ts`).
Blocking: None. Recommendation: mark RESOLVED, reference ADR-012.

### 38. Human Approval Threshold for AI Content
Classification: **PRODUCT DECISION**, genuinely open, low urgency since no AI generation code exists yet.
Blocking: None now. Schema: Low. UX: Medium. Reversibility: Cheap. Ruppin: Low (unless AI-generated content is used live in the demo). Production: Medium.

### 39. Pilot Content Ownership
Classification: **PRODUCT DECISION** (with legal/IP weight — see `docs/CONTENT_IP_THREAT_MODEL.md` for the related risk analysis), genuinely open.
Blocking: Medium. Schema: None directly. UX: Low. Reversibility: Moderate. Ruppin: **High** (directly relevant if a real professor's material is used). Production: High.

### 40. Answer Option Storage Model
Classification: as already stated — **DECIDED** (ADR-014). Accurate, not stale.

### 41. Duplicate Attempt / Idempotency Protection
Classification: **STALE — already answered and heavily implemented.** ADR-010 fully resolves this (advisory lock + `UNIQUE (user_id, submission_id)` + full canonical-command-identity field comparison), implemented in `submit-answer.ts` and covered extensively by `submit-answer.test.ts`. `docs/OPEN_QUESTIONS.md` still lists this as `Status: OPEN` — of every stale item found, this is the most-thoroughly-resolved-yet-still-listed-open one.
Blocking: None. Recommendation: mark RESOLVED, reference ADR-010.

### 42. Open Question Discipline
Classification: **PROCESS** — not a decision item, it defines how this very file should be used. Not scored.

---

## Stale-item summary (recommend updating `docs/OPEN_QUESTIONS.md`, not done by this document)

| # | Item | Resolved by |
|---|---|---|
| 6 | Question Editing and Historical Attempts | ADR-009 |
| 7 | Question Version Reference | ADR-009 |
| 9 | Next Best Action Persistence | ADR-010 |
| 32 | Manual Practice Outside Today | ADR-012 + `submit-answer.ts` (implemented, tested) |
| 37 | Recalculation Strategy | ADR-012 |
| 41 | Duplicate Attempt / Idempotency Protection | ADR-010 (implemented, extensively tested) |

Partially stale (base mechanism decided; a narrower sub-question remains genuinely open):

| # | Item | Decided part | Still open |
|---|---|---|---|
| 8 | Learner State Persistence | UserQuestionProgress persistence (schema) | Aggregate Learner State persistence |
| 11 | Mastery Scale | Representation shape (category enum) | Exact threshold values |
| 13 | Misconception Rule | State-machine mechanism | Exact threshold/weight values |
| 14 | Confidence Scale and Role | Scale (low/medium/high), optionality | Non-misconception effects; capture UX |
| 23 | Minimal Material Model | Base table shape (schema) | `material_type` enum values |
| 28 | Question Retirement vs Deletion | De facto "cannot hard-delete" via FK RESTRICT | An actual designed retirement/archive flow |
| 33 | Multiple Active Courses | Per-Course session independence (ADR-011) | Hard limits; cross-Course exam-date competition |
| 36 | Source of Truth for Derived Values | Hierarchy for implemented layers | Aggregate Learner State layer |

---

## Synthesis: smallest decision set per milestone

An item may appear under more than one milestone. This lists only items with
**Medium or higher blocking/urgency** for that milestone — it is not the full 42-item
list repeated five times.

### A. Auth implementation
- **#1** User↔Course Relationship — the named blocker (`CLAUDE.md` §4).
- **#25** Auth/RLS/storage sub-decision — cannot be finalized independently of #1.
- **#27** Data Deletion Semantics — account deletion is part of any real Auth/identity lifecycle; can be deferred briefly but should not be ignored indefinitely once real accounts exist.

### B. Global Today implementation (NOT approved — see `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`)
- **#33** Multiple Active Courses — this is the literal premise of Global Today.
- **#3** Today Session Boundary — "the day" must be defined once, globally, not per Course.
- **#35** Learner Time Zone — same reason as #3.
- **#16** Today Session Size — a combined plan needs its own sizing decision (see Global Today draft for why per-Course sizes don't simply add).
- **#17** Today Composition — cross-Course balancing is a new instance of this same open question.
- A **new** decision beyond ADR-011's scope: whether/how Global Today composes with the already-decided per-Course Today (ADR-011 does not answer this; it is not the same as reopening #34).

### C. First usable UI (Today + Quiz, even pre-Auth in a dev/demo harness)
- **#1** User↔Course Relationship — even a placeholder UI needs to know how a user "has" a Course.
- **#16** Today Session Size — the UI cannot render "today's plan" without a concrete item count.
- **#29** Basic Progress Definition — what the learner sees after answering.
- **#18** Explainability of Selection — what text accompanies a Today item (data model exists; copy does not).
- **#3** Today Session Boundary — needed to decide when the UI should show "today is done" vs. a fresh plan.

### D. Ruppin classroom demo
- **#1** User↔Course Relationship — real students need real access.
- **#24** Content Entry for First Pilot — how the demo's Questions/Materials get into the system at all.
- **#39** Pilot Content Ownership — especially relevant if a real Ruppin instructor's material is used.
- **#16** Today Session Size — the demo needs a concrete, decided session length.
- **#3** / **#35** Today Session Boundary / Timezone — a live classroom session crossing a boundary must behave predictably.
- **#4** Starter Experience Eligibility — every demo participant is a new learner on day one; without this, everyone sees an empty Today.

### E. Production pilot (beyond a single classroom demo)
Everything in D, plus the items whose cost of being wrong grows sharply with real, ongoing usage:
- **#2** Effective V1 Exam-Date Hierarchy
- **#20** Active User KPI Denominator / **#21** Week Boundary for KPI — needed before the primary KPI (`docs/PRODUCT.md` §15) can be reported honestly.
- **#26** Analytics Provider — needed to capture the KPI events at all.
- **#27** Data Deletion Semantics — required once real personal data accumulates.
- **#28** Question Retirement vs Deletion — content lifecycle at scale.
- **#35** Learner Time Zone — a single fixed pilot timezone (explicitly allowed as a temporary measure in `docs/DATABASE.md` §26) may no longer be acceptable across a wider user base.
- **#10** Engine Versioning Granularity — needed before a second Learning Engine version is ever shipped against real accumulated learner data.

---

## Explicitly out of scope for this document

- No item's actual answer is proposed here beyond noting where an ADR/schema already
  provides one.
- `docs/OPEN_QUESTIONS.md` itself is unmodified — updating its per-item `Status:` lines
  (per the stale-item table above) is a follow-up action for a maintainer/product
  owner, not performed by this triage.
- Global Today and Course/Access-model product-direction analysis are covered in their
  own documents (`docs/GLOBAL_TODAY_DESIGN_DRAFT.md`, `docs/COURSE_ACCESS_MODEL_DRAFT.md`)
  where they exist as part of this same hardening session; this document only cites
  them for cross-reference.

# ADR-017: Starter / New-Material Exposure V1

Status: ACCEPTED

## Context

`docs/OPEN_QUESTIONS.md` #4 (Starter Experience Eligibility) and #5
(Starter Sampling Strategy) have been OPEN since before Global Today
(ADR-016). ADR-016 §13 resolved the *framing* question — New Material
Exposure and Starter Experience are one mechanism family, Exposure is an
extension of Starter, not two competing mechanisms — but explicitly left
the eligibility/sampling policy itself undecided.

`docs/NEW_MATERIAL_EXPOSURE_MODEL.md` is a design-analysis-only document
(never an ADR) that worked out the shape of the problem without deciding
numbers: it named four candidate approaches for where "exposure state"
should live (§6) and recommended, as an assessment rather than a decision,
that options (b)/(c) — deriving exposure status from Attempt history
rather than introducing new persisted state — are most consistent with
this codebase's existing bias toward pure derivation over independently
maintained flags (the same reasoning ADR-010 already used to reject a
placeholder `UserQuestionProgress` row).

A real gap this blocked, found during Night-Run development (see
`docs/DEV_STATUS.md`'s "Blocked: unseen-question / new-material exposure
eligibility" entry, since closed by this ADR): a fresh learner with an
active `LEARNER` membership, zero Attempts, and zero `UserQuestionProgress`
rows receives an EMPTY DailyPlan, because `next-best-action.ts` only
generates candidates from existing `UserQuestionProgress`, and
`today-planner.ts` deliberately does not fabricate `NEW_LEARNING`/
`EXPAND_COVERAGE` filler when ranked candidates are empty. This left every
brand-new learner with nothing to do on day one — a real product gap, not
a hypothetical one.

This ADR makes the V1 decision `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`
deliberately declined to make, closes `docs/OPEN_QUESTIONS.md` #4/#5, and
authorizes Slice 5's implementation. It is intentionally narrow and
conservative — a fallback-only mechanism, not a redesign of Today's
ranking model.

## Decision

### 1. Unseen definition

A Question is **unseen** for a learner when the learner has no prior real
`Attempt` for that Question.

Explicitly: the ABSENCE of a `UserQuestionProgress` row is NOT by itself
proof of "unseen" — historical Attempts are the source of truth (a
progress row could in principle be missing for other reasons; Attempt
history is never inferred from progress-row absence). In practice, under
this codebase's existing `submitAnswer` semantics, a `UserQuestionProgress`
row is created on first Attempt, so the two are expected to coincide — but
the rule is stated against Attempts, not against progress-row existence,
to avoid a future refactor of progress-row lifecycle silently changing
unseen-eligibility semantics.

A Question is only eligible for selection at all when it also satisfies
every existing availability rule: active `LEARNER` membership in an
active/non-archived Course, current eligible `QuestionVersion`, and any
other existing archive/availability constraint next-best-action generation
already enforces for ordinary candidates. New-material selection does not
relax any existing eligibility rule — it only adds a new candidate SOURCE
for questions that already pass every existing filter.

### 2. Fallback-only policy (this is the core decision)

Today generation already ranks ordinary candidates — `REVIEW_DUE`,
`RELEARN_LAPSE`, `REPAIR_MISCONCEPTION`, `STRENGTHEN_MEMORY` — via
`next-best-action.ts`/`next-best-action-ranking.ts`, unchanged by this ADR.

V1 rule:

1. Generate every existing normal candidate first, exactly as today.
2. If AT LEAST ONE normal candidate exists: **do not** add any unseen
   question. New-material exposure never mixes with ordinary review in
   V1 — a learner with real review need sees only that need.
3. If ZERO normal candidates exist (the only case this ADR actually
   changes): activate the new-material fallback (§3).

This directly answers `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §10's novelty
budget question for V1 in the simplest possible way: the novelty budget
IS the fallback condition itself — new material only ever appears when
there is no review need competing for the same DailyPlan, so there is no
mixing-ratio calibration to get wrong yet. This is a deliberately more
conservative choice than `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` §7's
"conservative production default candidate" (at most 2 new topics/day
mixed alongside review) — that richer mixing model remains available for
a future revision once real usage data exists; V1 ships the smallest
correct behavior that closes the empty-Today gap.

### 3. Starter count: up to 3, no filler

When the fallback activates, select up to **3** unseen questions.

- 3+ eligible unseen questions exist → select exactly 3.
- 1–2 eligible unseen questions exist → select only those (1 or 2 items).
- 0 eligible unseen questions exist → Today may be legitimately EMPTY.
  Do not fabricate filler content to hit a nonzero count.

No mixing with review (§2). No per-Course fairness quota — the unseen
pool spans all of the learner's active `LEARNER` memberships exactly like
ordinary candidate generation already does (ADR-016), never guaranteeing
per-Course representation.

### 4. Deterministic selection — no randomness

Selection among eligible unseen questions must be deterministic for the
same persisted state and explicit time (`.claude/rules/learning-engine.md`
"Learning Engine behavior should remain deterministic").

Ordering, in priority:

1. Any existing pedagogical/authoring order field on the Question, if the
   schema already has one for this purpose.
2. Otherwise, stable ordering by `created_at` (earliest first), tie-broken
   by `id`.

No random sampling. This is a V1 simplification, not a claim that
authoring order or creation order is pedagogically optimal — calibration
of the actual selection HEURISTIC (difficulty spread, topic balance, exam
relevance — the considerations `docs/OPEN_QUESTIONS.md` #5 originally
listed) remains explicitly deferred, same as `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`
§6/§7 already flagged. What this ADR fixes for V1 is only that the
ordering is REPRODUCIBLE, not that it is pedagogically tuned.

### 5. Placement is not evidence

Selecting an unseen Question into a DailyPlanItem does **not** create a
`UserQuestionProgress` row and does **not** constitute evidence of
anything (`docs/NEW_MATERIAL_EXPOSURE_MODEL.md` §3's core principle,
reaffirmed here: "exposure is not evidence of durable memory"). Only a
real `Attempt`, created through the existing `submitAnswer` pipeline when
the learner actually answers, creates evidence — exactly the same
pipeline and the same rules as any other DailyPlanItem (Slice 1). A
skipped new-material item remains "unseen" from an evidence perspective
(no Attempt occurred), even though it is resolved (as `SKIPPED`) for that
frozen day's plan (ADR-016 §19) and will not reappear in the SAME plan.

### 6. Daily/frozen behavior

Unchanged from ADR-016's existing frozen-plan rules, restated for this
case specifically: once unseen items are selected into a DailyPlan, they
stay fixed for that plan (no re-selection mid-day). The next local day's
generation recalculates from scratch: a Question the learner actually
answered is no longer unseen; a Question the learner skipped is still
unseen (no Attempt) and may be selected again on a future day under the
same policy above.

### 7. Nomenclature

Reuses `next-best-action.ts`'s own already-proposed name rather than
inventing a new one: the candidate/action type is **`NEW_LEARNING`** (that
file's doc comment already names `NEW_LEARNING`/`EXPAND_COVERAGE` as the
two placeholder names it deliberately did not implement; `NEW_LEARNING` is
adopted here as the one actual value — `EXPAND_COVERAGE` is not used, to
avoid two names for one concept).

A new priority tier, **`NEW_MATERIAL`**, is introduced alongside the
existing four (`REMEDIATION`, `DUE_REVIEW`, `LOWER_SEVERITY_REPAIR`,
`STRENGTHEN`) — new material is never a REMEDIATION-severity concern, and
reusing an existing tier would misrepresent its priority semantics. Given
§2's fallback-only rule, `NEW_MATERIAL` candidates never actually compete
in the same ranked list as the other four tiers in V1 (they only appear
when the other four are entirely absent from that day's plan) — the tier
still exists as its own named value for correctness/observability, not
because V1 needs inter-tier ranking logic for it.

`reasons` (the existing `NextBestActionReason` list already carried by
`DailyPlanItem`) gains one new value: **`UNSEEN_MATERIAL`**.

## Consequences

- Closes `docs/OPEN_QUESTIONS.md` #4 and #5 for V1 (both updated to
  RESOLVED, pointing here) — the exact eligibility condition (§1–2), count
  (§3), and ordering (§4) are now decided. Finer sampling calibration
  (difficulty spread, topic balance, exam relevance, richer mixing with
  review) remains explicitly open future work, not blocked by this ADR.
- Requires a schema change (Slice 5): `daily_plan_items.action_type`'s
  CHECK constraint gains `'NEW_LEARNING'`, `daily_plan_items.tier`'s CHECK
  constraint gains `'NEW_MATERIAL'` — additive, forward-only, per
  `.claude/rules/postgres.md`.
- Requires a new discovery query (Slice 5): find eligible unseen questions
  across a learner's active `LEARNER` memberships, efficiently (no N+1),
  selecting only non-grading fields needed to create a `DailyPlanItem`
  with the exact current `QuestionVersion`.
- Does not change `next-best-action.ts`'s existing 4 candidate types, their
  ranking weights, or `today-planner.ts`'s existing ranking behavior when
  normal candidates exist (§2's fallback-only rule is exactly what
  preserves this).
- Does not create `UserQuestionProgress` rows speculatively (§5) — no
  "fake progress" risk.
- A fresh learner with an eligible Course containing ≥1 unseen Question
  now receives a non-empty Today on day one, closing the real gap
  described in Context.

## Related Documents

- `docs/OPEN_QUESTIONS.md` #4, #5 (RESOLVED by this ADR)
- `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` (design analysis this ADR decides
  against — option (b)/(c) chosen, per that document's own assessment)
- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016
  §13 — framing decision this ADR builds on)
- `src/domain/learning/next-best-action.ts` (existing candidate types,
  unchanged; doc comment named `NEW_LEARNING`/`EXPAND_COVERAGE` as
  deliberately unimplemented placeholders — resolved to `NEW_LEARNING`)
- `src/domain/learning/today-planner.ts` (existing "does not fabricate
  filler" behavior, unchanged when normal candidates exist)
- `docs/DEV_STATUS.md` "Blocked: unseen-question / new-material exposure
  eligibility" (the concrete gap this ADR closes)

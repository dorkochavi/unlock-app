# Global Today — Application Flow (DESIGN ONLY)

Status: **DESIGN PSEUDOCODE — NOT AN ADR, NOT DECIDED, NOT IMPLEMENTED.**

This document sequences the behavior `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
commits to, at the level of "which layer owns which step," mirroring the
pseudocode-in-comments style of `src/application/learning/today-session.ts`
and `src/application/learning/submit-answer.ts`. It contains no TypeScript,
no schema, and implements nothing. Where a flow depends on the persisted
architecture for Global Today (own entity vs. composition vs. hybrid —
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §9), that dependency is called out
explicitly; the option comparison itself is not repeated here — see
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` (written in parallel this
session) for that decision.

## 0. Working assumption for this document (PROVISIONAL — SUPERSEDED LEAN, SEE NOTE)

`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §10 leans toward **Option C** (a
lightweight `GlobalTodayPlan` that *references* `(courseId,
todaySessionItemId)` pairs drawn from the existing, unmodified
`TodaySession`/`TodaySessionItem` rows — ADR-011 stays exactly as accepted).
Every flow below is written against that lean, because the task asked for
"the most likely shape" at a point when `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`
had not yet landed, not because it was decided.

**Reconciliation note (added after both documents landed, same session):**
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` was completed in parallel and
recommends a *different* shape than the lean assumed here — its **Option A**
(replace `today_sessions`/`today_session_items` entirely with a single
`DailyPlan`/`DailyPlanItem` entity; Course Today becomes a pure read-time
`WHERE course_id = X` filter over it), not the reference-hybrid this
document assumed. Its stated reason: `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§3's "same plan, not two plans" framing forecloses the reference-hybrid's
own premise of independent per-Course generation continuing to run
alongside Global generation — see that document's §0 lettering-crosswalk
and §4 for the full reasoning. The steps below tagged **[persistence,
PROVISIONAL]** are exactly the ones that would need to be rewritten against
a single `DailyPlan`/`DailyPlanItem` entity instead of a
`GlobalTodayPlan`-references-`TodaySessionItem` shape; the domain-layer
steps (ranking/planning reuse) are unaffected either way, per
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3. This document is left as originally
written (not rewritten) so the reasoning trail stays visible; treat
`GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` §4 as the current recommendation for
any future implementation, not this document's §0.

**Second reconciliation note (post-decision, ADR-016 now ACCEPTED):** Option
A (single `DailyPlan`/`DailyPlanItem` entity, Course Today as a read-time
filter) is no longer just `GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s
recommendation — it is the accepted architecture
(`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`, Status:
ACCEPTED; `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §1). Any future
implementer should read every **[persistence, PROVISIONAL]** step below as
"rewrite against `DailyPlan`/`DailyPlanItem`," not as a still-open choice
among the `GlobalTodayPlan`-references-`TodaySessionItem` shape this
document was drafted against. This document's own flagged gaps remain live
under Option A too and are not resolved by the architecture decision alone:
§3.d/§3.f's pre-truncation-visibility tension (whether Global ranking sees
each Course's full candidate pool or only its own already-truncated
selection) still needs an explicit answer, and §9's second-order
Global-vs-Course adaptation-extension gap is unaffected by which
architecture option was chosen.

Provisional new concepts used below, named for clarity only (not a schema
proposal):

- `GlobalTodayPlan` — one row per `(userId, plannedForDate)`, analogous to
  `TodaySession` but with no `courseId`.
- `GlobalTodayPlanItem` — one row per selected item: `(globalTodayPlanId,
  courseId, todaySessionItemId, position)`. It stores **no** copy of
  `status`/`completedAt` — those are always read live from the referenced
  `TodaySessionItem`, per the product rule that Global and Course views
  share one underlying fact (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §2, §3).
  A denormalized status copy would reintroduce exactly the double-counting
  risk Option C is chosen to avoid by construction
  (`GLOBAL_TODAY_DESIGN_DRAFT.md` §9, Option C pros).
- `CourseMembershipRepository.listActive(userId)` — a **new port**, not yet
  in `src/application/learning/ports.ts`, returning non-archived,
  non-revoked `CourseMembership.courseId`s (ADR-015). No code for
  `CourseMembership` exists anywhere in `src/` today — this is the first
  place it would be needed.
- `getOrCreateGlobalTodayPlan` — a new application function, structurally
  parallel to `getOrCreateTodaySession`.

Layer legend (matching `CLAUDE.md` §2 / `docs/ARCHITECTURE.md` §3, and the
task's own five labels): **domain**, **application**, **persistence**,
**API**, **UI**.

---

## 1. First open Today today (either view)

Preconditions: no `TodaySession` and no `GlobalTodayPlan` exist yet for
`(userId, plannedForDate)`, for any Course.

```text
1.  UI:          learner opens Today (Global or a specific Course) — the
                 concrete entry point is Flow 3 or Flow 4; this flow is the
                 shared generation machinery both call into.
2.  API:         resolves userId from the authenticated principal only
                 (never client-supplied — CLAUDE.md §6, ADR-015
                 Consequences), resolves plannedForDate from the client's
                 reported local day (application-layer concern; no
                 timezone logic in domain/persistence per ADR-010).
3.  application: whichever entry point was opened calls its own
                 getOrCreate*/get* function (Flow 3 for Global, Flow 4 for
                 Course) — this flow describes what "first open" means
                 underneath either.
4.  application: [PROVISIONAL, depends on which view was opened first —
                 see Flow 3/4] generation is idempotent per key: whichever
                 call runs, `findByKey`/`findByKey`-equivalent runs INSIDE
                 the same transaction as the create, so a concurrent second
                 open (Flow "two devices," see
                 GLOBAL_TODAY_CONCURRENCY_REVIEW.md) cannot double-generate
                 for the same key — this reuses ADR-010's
                 "INSERT ... ON CONFLICT DO NOTHING RETURNING + fallback
                 SELECT" pattern, unchanged in shape.
5.  domain:      generateNextBestActionCandidates -> rankNextBestActionCandidates
                 -> generateTodayPlan (today-planner.ts) — pure, no I/O,
                 identical pipeline reused unchanged
                 (GLOBAL_TODAY_DESIGN_DRAFT.md §3).
6.  application: resolves each planned Question's current QuestionVersion
                 (today-session.ts's existing pattern) and writes the
                 result as frozen TodaySessionItem rows (per Course).
7.  persistence: TodaySession + TodaySessionItem rows committed, one
                 transaction, per Course (ADR-010's transaction boundary,
                 unchanged).
8.  application: [PROVISIONAL, Option C] if the Global view triggered
                 generation, a GlobalTodayPlan row + GlobalTodayPlanItem
                 rows referencing the just-created TodaySessionItems are
                 also committed — see Flow 3 for the merge/selection step.
9.  UI:          renders the generated plan (filtered by Course, or
                 unfiltered, depending on which view is open).
```

Note: "whichever comes first" (product spec §5) means the FIRST view opened
determines whether Course-session generation happens as a side effect of a
Global open (Flow 3, which must generate every active Course's session it
draws from) or stands alone (Flow 4, Course-only). Either way, by the time
generation finishes, the per-Course `TodaySession` rows this day will ever
have are fixed — this is the frozen-by-default guarantee (product spec
§11), not something either view can later silently redo.

---

## 2. Reopen same Today (either view, same local day)

```text
1.  UI:          learner reopens Today (Global or Course) later the same
                 local day.
2.  API:         resolves userId, plannedForDate as in Flow 1.
3.  application: getTodaySession (Course) or the Global read-equivalent —
                 a PURE READ. No candidate generation, no ranking, no
                 write. today-session.ts's own doc comment: "Pure read —
                 no side effects, matching 'Today resume' being a plain
                 lookup with no planning/generation logic on this path at
                 all." The Global equivalent must have the identical
                 property.
4.  persistence: findByKey (Course) / GlobalTodayPlan findByKey-equivalent
                 [PROVISIONAL] — no INSERT attempted at all on this path.
5.  UI:          renders the SAME frozen items as the first open, with
                 whatever status (pending/completed/skipped) has since
                 changed via Flows 5/6/8.
```

No domain step here at all — this is the same "generation and execution
are separate operations" principle ADR-010/`today-session.ts` already
establish for Course Today, extended unchanged to Global Today under
Option C, because a Global read never recomputes ranking either.

---

## 3. Open Global Today

```text
1.  UI:          learner opens the Global Today view.
2.  API:         resolves userId (authenticated principal), plannedForDate.
3.  application: getOrCreateGlobalTodayPlan(userId, plannedForDate, uow)
                 [NEW, PROVISIONAL]:
    a. application: read GlobalTodayPlan by (userId, plannedForDate). If
                    found, return it (Flow 2's read path) — done.
    b. application: [NEW ORCHESTRATION RESPONSIBILITY — does not exist
                    today for any single-Course call]
                    CourseMembershipRepository.listActive(userId) — every
                    Course this learner has a non-archived, non-revoked
                    CourseMembership for (ADR-015 §7, §9, §17 of the
                    product spec).
    c. application: for EACH active Course, call
                    getOrCreateTodaySession({userId, courseId,
                    plannedForDate}, ...) — this is Flow 1/4's machinery,
                    invoked once per active Course. Each call is
                    independently race-free (ADR-010's existing
                    INSERT...ON CONFLICT pattern, per-Course key) but there
                    is no NEW lock spanning "all of this learner's Course
                    sessions together" — see
                    GLOBAL_TODAY_CONCURRENCY_REVIEW.md for why this matters
                    under concurrent Global opens.
    d. domain:      [TENSION, FLAGGED NOT RESOLVED] the product spec (§7)
                    requires ranking need ACROSS all active Courses with no
                    quota — the cleanest way to honor that is to rank a
                    MERGED candidate pool (concatenating
                    generateNextBestActionCandidates output across every
                    active Course's UserQuestionProgress, then one call to
                    rankNextBestActionCandidates — GLOBAL_TODAY_DESIGN_DRAFT.md
                    §3's "clearest reuse-unchanged finding") BEFORE any
                    per-Course truncation happens. But step (c) above
                    already truncates each Course's own candidates via that
                    Course's own TodayPlannerPolicy.maxItems when
                    generating its per-Course TodaySession. If the Global
                    plan is built by selecting only from ALREADY-TRUNCATED
                    per-Course items (pure Option C, "reference what
                    already exists"), a genuinely high-need item that
                    didn't make one Course's own top-N could be invisible
                    to Global ranking even though it would rank above a
                    lower-need item from a different Course that DID make
                    its own per-Course cut. This is a real design gap in
                    Option C as literally described, not resolved by this
                    document — GLOBAL_TODAY_ARCHITECTURE_REVIEW.md must
                    decide whether Global ranking runs over each Course's
                    pre-truncation candidate pool (requiring the
                    per-Course generation call in (c) to expose more than
                    it persists) or accepts this visibility gap as a
                    known Option C cost.
    e. domain:      rankNextBestActionCandidates over whichever pool (d)
                    resolves to; generateTodayPlan with a
                    TodayPlannerPolicy shaped for §6's dynamic size (no
                    fixed N — this policy variant does not exist in
                    today-planner.ts and is itself unbuilt, per
                    docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md).
    f. application: for each selected NBA candidate, resolve which Course
                    it belongs to (questionId -> questions.course_id, the
                    same boundary-recovery GLOBAL_TODAY_DESIGN_DRAFT.md §4
                    describes) and which TodaySessionItem (from step c's
                    per-Course session) already represents it. [OPEN
                    QUESTION carried from (d): if the item was NOT in that
                    Course's own persisted session because of the
                    truncation gap, there is no TodaySessionItem to
                    reference yet under pure Option C — either that
                    Course's session generation must be redone with a
                    higher effective maxItems when it is also feeding
                    Global, or Global falls back to a lesser-ranked but
                    already-persisted item. Not resolved here.]
    g. persistence: [PROVISIONAL] INSERT GlobalTodayPlan ... ON CONFLICT
                    (user_id, planned_for_date) DO NOTHING RETURNING, same
                    idempotent-create shape as TodaySession
                    (ADR-010/ADR-011's pattern, reused). If it lost the
                    race, fall back to SELECT (Flow 2's read path) instead
                    of inserting GlobalTodayPlanItems for a plan this
                    transaction does not own — see
                    GLOBAL_TODAY_CONCURRENCY_REVIEW.md, "two tabs create a
                    Daily Plan."
    h. persistence: INSERT GlobalTodayPlanItem rows referencing the
                    winning transaction's selected (courseId,
                    todaySessionItemId, position) tuples, same transaction.
4.  UI:          renders the merged, globally-ranked plan; per-item, the
                 UI can navigate into that item's own Course context
                 (Flow 6) using the referenced todaySessionItemId — there
                 is no separate Global item identity a learner ever acts
                 on independently of the real TodaySessionItem.
```

---

## 4. Open Course Today

```text
1.  UI:          learner opens Today scoped to one specific Course.
2.  API:         resolves userId, plannedForDate, courseId (from route/UI
                 state — courseId is not a security-sensitive identity the
                 way userId is, but a membership/authorization check
                 belongs at the API/persistence boundary once Auth exists,
                 per ADR-015 Consequences — not built yet).
3.  application: getOrCreateTodaySession({userId, courseId,
                 plannedForDate}, context, uow) — EXACTLY today's existing
                 function (today-session.ts), completely unmodified by
                 Global Today under Option C
                 (GLOBAL_TODAY_DESIGN_DRAFT.md §8's "fully additive" case).
4.  domain:      generateNextBestActionCandidates -> rankNextBestActionCandidates
                 -> generateTodayPlan, scoped to this Course only, exactly
                 as today.
5.  persistence: TodaySession/TodaySessionItem rows for this Course,
                 unchanged shape/keys from ADR-011.
6.  UI:          renders this Course's plan. If a GlobalTodayPlan already
                 exists for today (because Global was opened first, or a
                 prior Course open elsewhere already triggered Flow 3 for
                 a DIFFERENT Course), this Course's items are unaffected —
                 Course Today never reads or depends on GlobalTodayPlan at
                 all under Option C; the dependency is one-directional
                 (Global references Course sessions, never the reverse).
```

Note: if Course Today is opened AFTER Global Today already generated this
Course's session as a side effect of Flow 3 step (c), this flow's step 3
simply finds the existing session (Flow 2's read path) — there is exactly
one generation event for this Course today regardless of which view
triggered it, by the same `findByKey`-before-create pattern.

---

## 5. Complete item from Course Today

```text
1.  UI:          learner answers the Question presented for a specific
                 TodaySessionItem, inside the Course Today view.
2.  API:         SubmitAnswerCommand assembled; userId from authenticated
                 principal, todaySessionItemId from the item the learner
                 was actually shown (client-supplied, but validated below —
                 unchanged from today).
3.  application: submitAnswer (submit-answer.ts) — COMPLETELY unmodified
                 by Global Today. Advisory lock, idempotency, QuestionVersion/
                 TodaySessionItem ownership validation, isCorrect
                 computation, learningSessionId derivation from
                 TodaySessionItem.todaySessionId (ADR-012 §5) — every step
                 as it exists today.
4.  domain:      applyAttemptToProgress / rebuildUserQuestionProgress as
                 needed (ADR-012) — no Course/Global concept reaches this
                 layer at all, exactly as GLOBAL_TODAY_DESIGN_DRAFT.md §6
                 point 1 already establishes ("evidence double-counting...
                 already structurally prevented").
5.  persistence: Attempt inserted, UserQuestionProgress upserted,
                 TodaySessionItem.status -> "completed",
                 TodaySessionItem.completedAt set — ONE write, to the ONE
                 row this item has ever had.
6.  UI:          Course Today view reflects the item as completed.
```

---

## 6. Same item reflected in Global Today

```text
1.  UI:          learner (same day, possibly same session, possibly later)
                 opens/refreshes the Global Today view.
2.  application: getOrCreateGlobalTodayPlan's read path (Flow 2) — or, if
                 the UI is already holding a live GlobalTodayPlan view,
                 simply re-fetches item status.
3.  application: [PROVISIONAL, Option C] for each GlobalTodayPlanItem, the
                 read path joins to the referenced TodaySessionItem to get
                 its CURRENT status/completedAt — this is a live join, not
                 a copy (see §0's note on why no status is denormalized).
4.  persistence: SELECT ... today_session_items WHERE id IN
                 (global plan's referenced ids) — a plain read, no write.
5.  UI:          shows the item completed — this is the SAME row Flow 5
                 wrote to in step 5, read through a different view. There
                 is no second "Global completion" event, record, or
                 credit — this is the concrete mechanism behind product
                 spec §14's "there is exactly one write, visible from both
                 views."
```

If Global Today is instead built as Option A (its own independently
persisted item), this flow would instead require an explicit
cross-table completion-propagation step — exactly the "genuine
cross-table guard" cost `GLOBAL_TODAY_DESIGN_DRAFT.md` §9 lists as Option
A's con. This document does not describe that variant further, since it
is not the leaned-toward shape.

---

## 7. Manually answer same Question outside Today

```text
1.  UI:          learner opens Manual Practice for a Course (not Today, in
                 either view) and answers a Question that also happens to
                 be planned as a TodaySessionItem (Course or Global) today.
2.  API:         SubmitAnswerCommand assembled with todaySessionItemId:
                 null, todaySessionId: null. learningSessionId is
                 CLIENT-supplied and client-owned for this path (ADR-012
                 §5 "Manual practice" branch) — Global Today introduces no
                 change here.
3.  application: submitAnswer — identical code path to Flow 5's step 3,
                 differing only in resolveLearningSessionId's branch
                 (todaySessionItem === null -> trusts command's value).
4.  domain:      applyAttemptToProgress — updates UserQuestionProgress
                 exactly as any other Attempt (product spec §14: "learning
                 state ... DOES update").
5.  persistence: Attempt inserted, UserQuestionProgress upserted. NO
                 TodaySessionItem is touched — there is no
                 todaySessionItemId on this command, so step 7 of
                 ADR-010's transaction boundary (mark item completed) is
                 simply never reached.
6.  UI:          Course Today's item AND Global Today's item (same
                 underlying row, Flow 6) both still show "pending" —
                 product spec §14/§19's worked example. Only a subsequent
                 significant-event check (Flow 9) — evaluated as part of
                 THIS same submitAnswer transaction, if it exists yet — may
                 alter FUTURE unresolved items; it never marks THIS item
                 completed as a side effect of the manual Attempt.
```

---

## 8. Skip

Skip has **zero implementation** anywhere in `src/` today — `status:
"pending" | "completed" | "skipped"` is a reserved schema/type value only
(`docs/PERSISTENCE_SCHEMA_V1.md`'s `today_session_items.status`,
`TodaySessionItem.status` in `ports.ts`). This flow is written as new
work, not a description of existing code.

```text
1.  UI:          learner explicitly chooses "skip" for a specific
                 TodaySessionItem, from either view (Course or Global —
                 the action targets the same underlying item either way,
                 per Flow 6's reasoning).
2.  API:         a new command, e.g. SkipTodayItem { userId,
                 todaySessionItemId, skippedAt } — NOT a SubmitAnswerCommand
                 variant; skip is explicitly "neither COMPLETED learning
                 nor scored as INCORRECT" (product spec §13), so it must
                 not flow through submitAnswer/applyAttemptToProgress at
                 all — inventing an Attempt for a skip would corrupt
                 evidence-quality counters (INVARIANT_MATRIX.md row 8) for
                 an action that produced no evidence.
3.  application: a new use case, e.g. skipTodayItem(command, uow) — NEW,
                 structurally parallel to submitAnswer but far simpler: no
                 domain engine call, no advisory lock needed UNLESS skip
                 and complete can race on the SAME item (see
                 GLOBAL_TODAY_CONCURRENCY_REVIEW.md, "Skip vs Complete
                 race"). Validates the item belongs to this user and is
                 still "pending" (not already completed/skipped) before
                 writing.
4.  domain:      none. Skip is pure state transition, no Learning Engine
                 involvement — product spec §13 is explicit that mastery
                 is not touched.
5.  persistence: TodaySessionItem.status -> "skipped",
                 TodaySessionItem.skippedAt (or a reused completedAt-style
                 column) set. No Attempt row, no UserQuestionProgress
                 write.
6.  UI:          both Course Today and Global Today (same row) show the
                 item resolved; product spec §13's "does not reappear in
                 the same Daily Plan" is automatically true because no new
                 candidate-generation pass ever runs again for this
                 already-frozen session/plan (Flow 2's read-only reopen).
```

---

## 9. Significant-event adaptation

This flow does not exist in any form today (`GLOBAL_TODAY_DESIGN_DRAFT.md`
§7: "today's model is 'generate once, never regenerate'"). Thresholds are
explicitly not decided (`docs/TODAY_ADAPTATION_MODEL.md`, product spec
§12/§20) — this document does not invent them; it only sequences where a
decision, once made, would plug in.

```text
1.  application: as part of submitAnswer's existing transaction (Flow 5
                 or Flow 7's step 3), AFTER applyAttemptToProgress
                 produces the updated UserQuestionProgress, a NEW check
                 evaluates whether this Attempt constitutes a "significant
                 learning event" per whatever domain predicate
                 TODAY_ADAPTATION_MODEL.md eventually defines (confident
                 wrong answer, misconception threshold crossing, etc. —
                 product spec §12's candidate list, not a committed rule
                 set).
2.  domain:      [NOT YET DESIGNED] a pure function, e.g.
                 detectSignificantLearningEvent(attempt, previousProgress,
                 updatedProgress) -> SignificantEvent | null — belongs in
                 src/domain/learning/, no DB/session concept, following
                 the same purity discipline as every other domain function
                 cited above.
3.  application: if a SignificantEvent is detected, load the affected
                 Course's TodaySession's remaining PENDING items (never
                 completed/skipped ones — product spec §12 "not allowed:
                 changing completed items"), and compute a SMALL
                 replace/insert of future items — this is new
                 orchestration with NO existing precedent
                 (GLOBAL_TODAY_DESIGN_DRAFT.md §7: "a same-day
                 partial-replan write path is new concurrency surface...
                 with zero precedent").
4.  persistence: within the SAME transaction as the triggering Attempt
                 (to avoid a separate race window), UPDATE/INSERT the
                 affected Course's TodaySessionItem rows for the
                 not-yet-resolved positions only. Already-completed/skipped
                 items are never touched (a WHERE status = 'pending'
                 predicate is a natural DB-level guard here, in addition
                 to the application-level check).
5.  application: [PROVISIONAL, Option C, SECOND-ORDER GAP] if this
                 Course's session also feeds an existing GlobalTodayPlan
                 for today, and the adaptation added a NEW
                 TodaySessionItem, the GlobalTodayPlan has no corresponding
                 GlobalTodayPlanItem for it yet — whether adaptation also
                 extends the frozen GlobalTodayPlan (violating its own
                 freeze unless treated as the same class of "minimal,
                 future-only" change) or leaves the new item Course-Today-
                 only until tomorrow's Global generation is NOT decided
                 anywhere in the cited docs. Flagged, not resolved.
6.  UI:          the affected view(s) show the adapted remaining items on
                 next read (Flow 2-style); already-rendered completed
                 items in the current UI session are never retroactively
                 changed.
```

---

## 10. Complete Daily Plan

```text
1.  application: "Done for today" (product spec §7 lifecycle, §13's
                 finish condition) is evaluated by checking that every
                 relevant TodaySessionItem's status is "completed" or
                 "skipped" — no "pending" remains.
2.  application: [OPEN, CONFIRMED BY CODE INSPECTION] there is no
                 persisted session-level completion write today —
                 `today-session-repository.ts`'s own doc comment states
                 ADR-010 step 7's "roll up TodaySession completion" is
                 "deliberately NOT implemented," and `today_sessions
                 .status`'s exact state machine is itself DEFERRED
                 (`docs/PERSISTENCE_SCHEMA_V1.md`). This document assumes
                 "Done for today" is computed at READ time from item
                 statuses (both for a single Course session and, under
                 Option C, for a GlobalTodayPlan by checking every
                 referenced item), not from a persisted plan-level status
                 column — the safer assumption given the state machine is
                 explicitly not decided, not an invented mechanism.
3.  UI:          on the read that observes all items resolved, renders
                 "Done for today" for that view. Global and Course "done"
                 are logically independent computed facts (Global's set of
                 referenced items need not equal any one Course's full
                 item set) — product spec §20 leaves "does completing all
                 Global items also complete the constituent Course
                 sessions" explicitly undecided; this flow does not answer
                 it.
4.  application: no automatic replenishment (product spec §7's real
                 finish line) — this is simply the ABSENCE of any further
                 candidate-generation call for this (userId, courseId or
                 global, plannedForDate) key today, which Flow 2's
                 read-only reopen already guarantees structurally.
```

---

## 11. Midnight while actively studying

```text
1.  UI:          learner's session (Course or Global Today) was opened
                 before local midnight on day D and is still open/in-use
                 at local time >= 00:00 on day D+1.
2.  application: NOTHING fires automatically. There is no clock-driven
                 server-side day-rollover process anywhere in this
                 codebase (no queue/cron infra — docs/ARCHITECTURE.md §34's
                 "no premature distributed architecture" already rules
                 this out for V1). The client continues holding whatever
                 TodaySession/GlobalTodayPlan object (keyed to day D) it
                 already fetched.
3.  API/UI:      any further action within this same continuing
                 session — completing an item, skipping, submitting an
                 answer — is scoped to day D's already-loaded
                 todaySessionItemId/globalTodayPlanId, unchanged. Nothing
                 about crossing midnight invalidates an in-flight
                 todaySessionItemId; submitAnswer has no day-boundary
                 check at all (it validates ownership/version/session
                 consistency, never "is this session's date == today").
4.  application: day D's plan is NOT retroactively frozen/expired by the
                 clock — it was already frozen at generation time (product
                 spec §11). Nothing changes about D's plan merely because
                 midnight passed.
```

Exact continuation-boundary mechanics (e.g. "how does the client itself
decide it is still 'in' day D's session versus needing day D+1's") are
explicitly deferred to `docs/TODAY_TIMEZONE_EDGE_CASES.md` (product spec
§15) — this flow only establishes that no server-side mechanism forces a
transition; the decision is client/application-layer, not built.

---

## 12. Reopen after midnight

```text
1.  UI:          learner opens (or fully re-launches, e.g. new day, first
                 interaction) Today — Global or Course — at local time on
                 day D+1, with no continuing session from day D.
2.  API:         resolves plannedForDate as day D+1 (application-layer
                 local-day computation, same open question as Flow 1 step
                 2 — ADR-010/OPEN_QUESTIONS.md #3).
3.  application: getOrCreate*(userId, courseId?, plannedForDate = D+1) —
                 no row exists yet for D+1's key (day D's row is a
                 DIFFERENT key, never reused) -> this is Flow 1's
                 first-open generation, run fresh, from CURRENT learning
                 state (which now reflects any day-D activity, including a
                 late-night session from Flow 11).
4.  domain:      full fresh candidate generation/ranking/planning — day
                 D's unresolved items are NOT carried over
                 mechanically (product spec §16); they may naturally
                 reappear if their underlying need is still elevated,
                 purely because the ranking pipeline is being run again
                 from scratch, not because of any explicit
                 backlog/carry-over code path (none exists, and none is
                 proposed here).
5.  persistence: a NEW TodaySession (Course) and/or GlobalTodayPlan row
                 for (userId, ..., D+1) — day D's rows are untouched,
                 remain queryable as history (product spec §18).
6.  UI:          renders day D+1's fresh plan.
```

---

## 13. Archive Course

```text
1.  UI:          learner archives a Course (sets
                 CourseMembership.archivedAt, ADR-015 §7/§9) — the
                 membership/access feature itself is unbuilt; this flow
                 describes the Today-side consequence once it exists.
2.  API/application: [NEW] an application-layer command sets
                 CourseMembership.archivedAt = now() for (userId,
                 courseId). Not part of the Today subsystem at all — a
                 membership-management concern.
3.  application: [CONSEQUENCE, PROVISIONAL] the NEXT time
                 getOrCreateGlobalTodayPlan runs its
                 CourseMembershipRepository.listActive(userId) call (Flow
                 3 step b) for a NEW plannedForDate, this Course is
                 excluded from the active-Course list, so it contributes
                 no candidates to that FUTURE Global plan.
4.  application: [EXPLICIT NON-CONSEQUENCE, frozen-by-default] archiving
                 mid-day does NOT retroactively touch:
                 - an already-persisted TodaySession/TodaySessionItem rows
                   for this Course, for TODAY's plannedForDate — they stay
                   exactly as generated, per product spec §11's freeze
                   rule, which is not conditioned on membership state;
                 - an already-persisted GlobalTodayPlanItem referencing
                   one of this Course's items for TODAY — same freeze
                   rule.
                 A learner can still open Course Today for an archived
                 Course today and complete/skip its already-frozen items
                 (ADR-015 §7: "remains manually practiceable"); this is
                 not a special case, it is simply Flow 5/8 running
                 unchanged against a row that already exists.
5.  UI:          if the archive happens WHILE Course Today or Global Today
                 for this Course is open in another tab, that tab's
                 already-rendered items are unaffected until it re-fetches
                 (see GLOBAL_TODAY_CONCURRENCY_REVIEW.md, "archiving a
                 Course while its Today is open in another tab").
```

---

## 14. Reactivate Course

```text
1.  UI:          learner reactivates an archived Course (ADR-015 §7:
                 "may be reactivated by the learner") — sets
                 CourseMembership.archivedAt = null.
2.  application: [NEW] symmetric to Flow 13 step 2 — a membership-layer
                 write, not a Today-subsystem concern.
3.  application: [CONSEQUENCE] the NEXT getOrCreateGlobalTodayPlan call
                 for a NEW plannedForDate includes this Course again in
                 listActive(userId), so it can contribute candidates to a
                 FUTURE Global plan.
4.  application: no retroactive effect on TODAY's already-frozen plan
                 (symmetric reasoning to Flow 13 step 4) — reactivating
                 mid-day does not insert this Course's items into a plan
                 already generated before reactivation. This is the same
                 "generate once" discipline, not a special Global Today
                 rule.
5.  UI:          this Course's own Course Today, opened fresh, generates
                 normally the next time IT is first-opened for a given
                 day (Flow 1/4) — reactivation does not itself trigger
                 generation.
```

---

## 15. Failed/retried submission

This flow is identical for Global-Today-triggered and Course-Today-
triggered submissions, because — under Option C — a Global Today item IS a
reference to a real `TodaySessionItem`; there is no separate "Global
Attempt" concept for `submitAnswer` to know about
(`GLOBAL_TODAY_DESIGN_DRAFT.md` §5: "Global Today introduces no new
idempotency risk by itself").

```text
1.  UI:          learner submits an answer for an item they reached via
                 EITHER view; client generates submissionId ONCE and binds
                 it to this logical attempt (ADR-010's "client retry
                 contract").
2.  API:         SubmitAnswerCommand assembled with the SAME
                 todaySessionItemId regardless of which view (Global or
                 Course) the learner was looking at when they answered —
                 there is exactly one real item identity to submit
                 against.
3.  application: submitAnswer's existing fast-path retry check
                 (findByUserAndSubmissionId) — if the network call failed
                 client-side but the server actually committed, retry
                 returns the ALREADY-committed ACCEPTED result
                 (wasIdempotentRetry: true), unchanged.
4.  application: if the retry's fields disagree with the original
                 command's canonical identity fields (ADR-010's field
                 list), IDEMPOTENCY_KEY_CONFLICT is returned — unchanged;
                 nothing about which view originated the request enters
                 that field list.
5.  persistence: UNIQUE (user_id, submission_id) is the actual safety net
                 under real concurrent retries (ADR-010) — unaffected by
                 Global Today, since no new column/uniqueness scope is
                 introduced for this path.
6.  UI:          whichever view the learner is CURRENTLY looking at
                 (possibly not the one they answered from, if they
                 switched tabs mid-retry) shows the resolved item on its
                 next read (Flow 6) — because it is the same row.
```

See `docs/GLOBAL_TODAY_CONCURRENCY_REVIEW.md` for the confirmation that
this flow introduces no NEW idempotency risk, only a restated one.

---

## Summary: what is genuinely new vs. reused

| Flow | Domain reused unchanged? | New application orchestration? | New persistence? |
|---|---|---|---|
| 1 First open | Yes | Existing (per-Course) | Existing |
| 2 Reopen | Yes (none needed) | Existing | Existing |
| 3 Open Global | Yes, with an unresolved pooling question (§3.d) | **Yes — GlobalTodayPlan generation, multi-Course orchestration** | **Yes, PROVISIONAL (GlobalTodayPlan/Item)** |
| 4 Open Course | Yes | None (unmodified ADR-011) | None |
| 5 Complete via Course | Yes | None | None |
| 6 Reflected in Global | n/a (read only) | New read/join path | New read path only |
| 7 Manual practice | Yes | None | None |
| 8 Skip | n/a (no domain call) | **Yes — entirely new use case** | **Yes — first real use of the reserved `skipped` status** |
| 9 Adaptation | **New domain predicate needed** | **Yes — first partial-replan write path ever** | **Yes — new item insert into an already-frozen session** |
| 10 Complete plan | n/a | Read-time computation only (no new write) | None (rollup stays unimplemented) |
| 11 Midnight active | n/a | None (absence of a mechanism, by design) | None |
| 12 Reopen after midnight | Yes | Existing, just a new key | Existing |
| 13 Archive | n/a | **Yes — CourseMembership write, not built anywhere yet** | **Yes — course_memberships table, per ADR-015** |
| 14 Reactivate | n/a | Same as 13 | Same as 13 |
| 15 Retry | Yes (fully) | None | None |

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (primary product reference, esp. §19)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (§3 reuse findings, §6 double-counting,
  §7 concurrency, §9 options, §10 lean)
- `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` (persistence-shape decision,
  written in parallel — not duplicated here)
- `docs/GLOBAL_TODAY_CONCURRENCY_REVIEW.md` (companion document, this
  session)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`,
  `011-today-is-course-scoped-v1.md`,
  `012-attempt-replayability-and-rebuild-semantics.md`,
  `015-user-course-membership-and-join-authorization-model.md`
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items`,
  DEFERRED state machine)
- `src/application/learning/today-session.ts`, `submit-answer.ts`,
  `ports.ts`

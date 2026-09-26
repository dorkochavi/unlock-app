# ADR-020: Course/Topic Practice Semantics V1 (Learning-Day Session Identity, Today Isolation)

Status: ACCEPTED (2026-09-26)

## Context

ADR-016 defines Manual Practice as opt-in learning outside Today that updates learner state but never resolves a
DailyPlanItem (§6, §8, §19, §21). No product surface or API for it exists yet. Course/Topic Practice (Run UX-02,
`docs/UX_SPEC.md`, `FUB-030`) is about to provide one.

Two parts of the current architecture are not safe to reuse as-is for that surface:

1. **Session identity.** ADR-012 §5 lets the client supply and own `learningSessionId` for Attempts without a
   DailyPlanItem ("manual practice"). `learningSessionId` decides whether a correct retrieval counts as same-session
   or as longitudinal spaced evidence (`learning-session.ts`, `retrieval-qualification.ts`). A client that sends a
   fresh id per answer could make every retrieval look spaced and inflate mastery — the same defect ADR-012 §5
   already closed for Today-attached Attempts.
2. **Today interaction.** ADR-016 does not say whether Practice may select a Question that is still pending in the
   learner's already-generated plan, nor what happens when Practice starts before Today's plan exists.

The FSRS consequences of practising early (scheduling policy) are learning-engine policy, owned by
`docs/LEARNING_ENGINE.md` §39A, not by this ADR.

## Decision

1. **Canonical invariant — one learner + one learning day = one server-controlled learning session.** The learning
   day is the learner-local calendar day already used for the DailyPlan (ADR-016, persisted learner timezone). Every
   Attempt the learner makes that day — from Today or from Practice — belongs to that one session. The client never
   chooses or influences the session identity of a Practice Attempt.
2. **Implementation choice (V1, not the product definition).** The session identity is the id of the learner's
   DailyPlan for that learning day, which Today-attached Attempts already use (ADR-012 §5). Practice therefore
   get-or-creates today's DailyPlan (existing idempotent operation) before it selects or accepts answers. A future
   change may introduce a dedicated session record without changing the invariant in (1).
3. **ADR-012 §5 is amended for Practice.** For Attempts without a DailyPlanItem that are submitted through the
   Practice surface, the server derives `learningSessionId` per (2); any client-supplied value is ignored and is not
   part of the command-identity comparison (same treatment as Today-attached Attempts). The generic client-owned
   path in ADR-012 §5 is no longer exposed by any product surface.
4. **Today is an immutable snapshot once generated (restates ADR-016 for Practice).** Practice never creates,
   injects, removes, resolves, reorders or reopens DailyPlanItems, and never reopens a completed Today. Practice
   Attempts change learner state (progress, FSRS, eligibility) and therefore affect FUTURE DailyPlans only.
5. **No double-serving.** Practice never selects a Question that has a PENDING DailyPlanItem in the learner's
   current-day plan. Items already COMPLETED or SKIPPED in that plan remain eligible (ADR-016 §19); Practice's own
   "already answered in this learning session" exclusion (LEARNING_ENGINE §39A) keeps them out of automatic batches
   on the same day. The same check is enforced when a Practice answer is accepted, not only at selection time.
6. **Eligibility V1.** Practice is available only for a PUBLISHED Course in which the caller holds an ACTIVE LEARNER
   membership (not revoked, not archived), and only for the current published QuestionVersion of a Question in that
   Course (and, for Topic Practice, currently in that Topic, ADR-018). Authentication precedes any privileged DB
   access; authorization fails closed.
7. **Temporary deviation from ADR-016 §16.** ADR-016 §16 says a Course the learner has archived
   (`CourseMembership.archivedAt != null`) "remains manually practiceable". V1 Practice requires an ACTIVE
   (non-archived) membership (rule 6), so learner-archived Courses are NOT practiceable in V1. Courses whose own
   status is ARCHIVED (or DRAFT) are also excluded by the PUBLISHED-only rule. This is a deliberate, temporary,
   fail-closed deviation until archived-Course/membership learner semantics are decided with `F-04b`; it is not a
   resolution of `F-04b`.

## Consequences

- A Practice session never needs a new table; DailyPlan get-or-create becomes a precondition of Practice
  (including the first-login timezone step Today already performs).
- Today and Practice answers on the same learning day are same-session for retrieval qualification: repeating a
  Question in Practice right after Today never counts as spaced retrieval.
- A learner who practises before opening Today still gets exactly one plan for the day, generated from the state
  at Practice start; later Practice answers do not change it (frozen snapshot, ADR-016 §3).
- Replay/rebuild (ADR-012) stays deterministic: `learningSessionId` and "has a DailyPlanItem" are both persisted
  on the Attempt.
- The practice-specific scheduling rule (early correct answers) is identifiable on replay because Practice
  Attempts are exactly those with `dailyPlanItemId = null` in V1; no source column is added. If another
  non-Today Attempt source is ever introduced, it must declare how it maps onto this distinction first.

## Alternatives Considered

- **Keep the client-owned token (ADR-012 §5 as written).** Rejected: lets a client manufacture spaced-retrieval
  evidence.
- **One server-generated session per Practice batch ("עוד 10" = new session).** Rejected: two batches minutes apart
  would count as spaced retrieval; also needs new persistence.
- **A new `learning_sessions` table now.** Deferred: not needed to enforce the invariant in V1.
- **Let Practice select pending Today items, or inject Practice into Today.** Rejected: double-serves Questions and
  breaks the Today snapshot (ADR-016 §3).

## Related Documents

- ADR-012 (Attempt replayability; §5 amended here for Practice), ADR-016 (§3, §6, §8, §16, §19, §21), ADR-017,
  ADR-018, ADR-015 (membership).
- `docs/LEARNING_ENGINE.md` §39A (Manual Practice policy: scheduling and selection).
- `docs/UX_SPEC.md` (Practice UX), `docs/FOLLOW_UP_BACKLOG.md` `FUB-030`.
- `docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md` (design evidence: affordance map, research, selector simulation).

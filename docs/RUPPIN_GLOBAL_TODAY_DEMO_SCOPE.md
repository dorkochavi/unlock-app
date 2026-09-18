# Ruppin Global Today Demo — Scope Triage (DRAFT)

Status: **SCOPE ANALYSIS ONLY — NOT AN ADR, NOT A COMMITMENT, NOT IMPLEMENTED.**

Purpose: with roughly one month until a demo at Ruppin (an academic
institution), triage what is actually required to prove UNLOCK's core
product thesis — *an adaptive daily plan that gets smarter from evidence*
(`docs/PRODUCT.md` §4, §1) — versus what is interesting Global Today
scope that should not distract from a realistic one-month build starting
from a genuinely empty UI/API/Auth layer.

This document does not redesign anything already decided. It takes as given:
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (product rules), ADR-011 (Course-scoped
Today, currently accepted V1 behavior, zero new schema required), ADR-015
(the `OPEN`-join-policy self-join flow — `QR → Course → sign in → join →
membership created → learn` — already the decided Ruppin demo onboarding
mechanism, not redesigned here), and `docs/ROADMAP.md` §19 (Pilot Readiness).

## 0. Starting point, stated plainly

As of this session's baseline: no UI beyond the Next.js scaffold
(`src/app/layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico`), no API
routes, no Auth wiring, no RLS policies. The domain/application Learning
Engine (`src/domain/learning/`, `src/application/learning/`) is comparatively
mature — 312 unit tests + 97 schema tests passing. The one-month clock is
therefore mostly an Auth+API+UI clock, not a learning-logic clock. Every
recommendation below is made with that asymmetry in mind: the hard, novel,
time-consuming part of the next month is wiring a real user in through a
real join flow and rendering a real screen, not inventing more ranking
logic.

---

## 1. The central scoping question: does the demo need Global (multi-Course) Today at all?

**RECONCILIATION NOTE (post-decision):** Dor's product-owner review has
**CONFIRMED this section's recommendation**, per
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7 / ADR-016 (ACCEPTED, §7 of the
decision checklist): multi-Course Global Today is NOT a hard demo
requirement — a bonus only if schedule allows. **One added nuance beyond
what this section argues below**: the correct `DailyPlan`/`DailyPlanItem`
architecture (ADR-016, Option A) must be built now, even though only the
single-Course vertical slice is demoed — the demo target is Course Today
served as a filtered view of a real `DailyPlan`, not a temporary
Course-only architecture (e.g. the old `today_sessions`/
`today_session_items` shape) that would need to be thrown away after the
demo to add Global Today later. This does not change §0's effort
assessment materially (`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` already
found Option A's migration risk low, additive, no seed data to migrate) but
it does mean "build Course Today the old ADR-011 way because it's faster"
is explicitly rejected — see
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` for the reordered plan this
implies.

**Conclusion: No. Recommend deferring Global (cross-Course) Today past the
Ruppin demo. Course Today, now built on the accepted `DailyPlan`/
`DailyPlanItem` architecture rather than ADR-011's superseded schema, is the
correct demo target.**

Reasoning:

- ADR-015 itself frames the `OPEN`-join self-join flow as "what supports the
  Ruppin classroom demo," and its own "Alternatives Considered" section
  explicitly characterizes Ruppin as "a Ruppin demo that has exactly one
  lecturer and one Course." A demo audience joining through one QR code into
  one `OPEN` Course produces exactly one active `CourseMembership` per
  learner, for one Course.
- Global Today's entire product value proposition (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
  §1, §7) is ranking learning need **across multiple active Courses** with no
  quota/fairness/floor — "80% from one Course is fine," "a Course with no
  exam may outrank a Course with a distant exam," etc. Every one of the
  worked examples in §19 of the product spec that actually demonstrates
  Global Today's distinguishing behavior (the three-Course example, the
  no-exam-outranks-distant-exam example, the 80%-concentration example)
  requires **at least two Courses with genuinely different learning-need
  profiles** to be observable at all.
- In a single-Course classroom demo, Global Today and Course Today render
  **the identical plan** — there is nothing left to rank across, because
  there is nothing else in the ranking set. An audience watching a live demo
  cannot distinguish "this is Global Today's cross-Course ranking at work"
  from "this is just Course Today" when there is exactly one Course in
  scope. Building Global Today's additional machinery (a Global view/filter
  layer, cross-Course candidate aggregation, whatever persistence shape is
  chosen per the parallel `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` — not
  yet available to this document, see note in §6) would add real
  implementation and testing surface for a distinction the audience
  physically cannot see.
- This is the strongest argument in this document and it does not depend on
  effort/time pressure alone — it is a demonstrability argument that would
  hold even with unlimited time: a one-Course pilot is not evidence for or
  against Global Today's value, in either direction.
- Course Today, by contrast, requires **zero new schema** (ADR-011 is
  already-accepted, already-keyed, already reasoned through) and the
  domain/application layer for it (Next Best Action ranking, Today plan
  generation, freeze semantics per ADR-010) is already built and unit-tested.
  The remaining work to demo it is Auth + one API surface + one UI screen —
  exactly the kind of scoped, estimable one-month project this triage should
  produce, versus Global Today's larger and partially-undecided persistence
  question (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20 lists the persisted
  architecture for Global Today as explicitly not decided).

If a future multi-course pilot or a demo audience spanning more than one
lecturer's Course becomes real, this conclusion should be revisited on its
own terms — it is a demo-scope conclusion, not a permanent verdict on Global
Today's value.

---

## 2. MUST HAVE FOR RUPPIN DEMO

These are the items without which the demo cannot honestly show the core
thesis at all, or without which a non-negotiable quality/safety boundary
would be crossed.

1. **Auth wiring with real `userId` derivation from the authenticated
   principal.** Non-negotiable per `CLAUDE.md` §6 and ADR-015's own
   consequences section ("`userId` continues to be derived only from the
   authenticated principal, never from client-supplied request data").
   Cannot be shortcut for demo speed — a demo that fakes identity is not
   demonstrating the product, and this is explicitly called out as a
   boundary this document will not recommend crossing regardless of the
   one-month deadline.
2. **The already-decided ADR-015 `OPEN`-join self-join flow**: QR → Course →
   sign in → join → membership created → learn. This is the entire
   onboarding mechanism for a classroom of Ruppin students and is already a
   settled decision — it is MUST HAVE by virtue of being the only decided
   onboarding path, not a new design decision this document is making.
3. **One Course Today** (ADR-011-scoped, single Course), including plan
   generation on first open, persistence, freeze-by-default, and normal
   resume behavior. This is the demo's centerpiece: a persistent, evidence-
   driven daily plan.
4. **Quiz execution against a Today plan item, producing a real immutable
   Attempt.** Without this there is no evidence loop to demonstrate at all —
   this is the "gets smarter from evidence" half of the thesis.
5. **Real idempotency + the advisory-lock/transaction model (ADR-010) for
   answer submission.** Non-negotiable per `CLAUDE.md` §6 ("idempotency"
   listed explicitly as non-negotiable) — a demo is exactly the situation
   where a flaky classroom network produces retried submissions live in
   front of an audience; skipping this risks a visible double-count bug at
   the worst possible moment, not just a theoretical integrity gap.
6. **Immutable Attempts (ADR-005) and real `UserQuestionProgress`
   persistence**, so that a second Today plan (later the same demo, or the
   next day) visibly reflects what was just answered. This is the single
   most important observable fact for proving the thesis — the plan must
   audibly/visibly change because of what a real student just did.
7. **The "Done for today" real finish line** (product spec §7) for at least
   one Course, so the demo can show a clean, honest completion state rather
   than an open-ended, unbounded quiz.
8. **Skip**, at minimum as a real state transition (resolved, not counted as
   incorrect, no replenishment). Cheap to build (already modeled in the
   domain), and it is the concrete evidence for "Today recommends, the
   learner decides" — a claim worth being able to demonstrate live, not just
   assert.
9. **Persisted history from day one, with no History UI** — confirmed
   applicable to the demo exactly as already decided for V1 generally
   (product spec §18, "History UI is not required for V1"). The demo does
   not need a screen showing past days; it needs the underlying rows to
   exist so that a second day's plan can visibly differ from the first
   (item 6 above depends on this, not on a UI for it).
10. **Baseline error/empty states** (S11/S12/S13/S14 from
    `docs/GLOBAL_TODAY_UX_STATE_MACHINE.md`) — at minimum the two "empty"
    states must be distinguishable, since Ruppin students are, almost by
    definition, new learners on day one (`docs/PRODUCT.md` §13's "new
    learner ≠ nothing to review" is directly and immediately relevant — the
    demo's very first cohort experience is exactly this state). An
    ungraceful blank screen or a misleading "nothing to review" message on a
    room full of first-time users would actively undermine the thesis being
    demonstrated.

## 3. SHOULD HAVE BEFORE V1 (not required for the Ruppin demo itself)

1. **Global (multi-Course) Today**, per §1's reasoning above — genuinely
   valuable, not observable in a one-Course classroom demo, and its
   persistence architecture is not yet decided
   (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20). Building it now would spend a
   large share of the one-month budget on a distinction the audience cannot
   perceive.
2. **New-material exposure (2–3 question illustrative sample).** Genuinely
   useful and cheap in isolation, but it adds a second content-selection
   mode on top of a Today implementation that itself needs to be built from
   nothing this month. If time allows after the MUST-HAVE list is solid,
   this is the next candidate to pull forward — it directly reinforces the
   thesis ("the plan adapts to what you don't know yet") — but it should not
   displace hardening the MUST-HAVE path.
3. **Significant-event adaptation (plan changing mid-session).** Thematically
   perfect for a demo ("watch the plan react to a wrong answer live") but
   its trigger thresholds are explicitly undecided
   (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12, §20) and building it requires
   the MUST-HAVE plan/session/Attempt pipeline to already be solid. Treat as
   a stretch goal only after items in §2 are demoed reliably end-to-end;
   do not let an undecided threshold model block the MUST-HAVE list.
4. **Exam-date input and exam-urgency amplification.** Valuable framing
   ("המבחן מתקרב") but requires exam dates to exist as real data for Ruppin's
   Course, which is a content/data-entry dependency outside the engineering
   critical path, not a code-complexity one. Include only if Ruppin's
   lecturer can realistically supply a real exam date before the demo;
   otherwise the "no exam" ranking path (already exercised by MUST-HAVE
   Course Today) is sufficient to show adaptive ranking.
5. **Course archive.** ADR-015-decided behavior, but a one-Course, one-month-
   old pilot has no realistic archive scenario to demonstrate — nobody will
   have accumulated a Course worth archiving by demo day. Zero demo value;
   real but deferred V1 completeness value.
6. **Manual Practice as a distinct, fully built path.** The product spec's
   completion semantics (§14) depend conceptually on Manual Practice
   existing, but the demo does not need a polished Manual Practice screen to
   show Course Today working — a minimal or entirely absent Manual Practice
   surface does not undermine the thesis, since the thesis is about Today's
   adaptivity, not about practice-mode breadth.
7. **Multi-device behavior** (the same learner starting on one device,
   continuing on another). Real product-quality concern, not something a
   live single-device classroom demo will exercise or need to exercise.

## 4. POST-V1

1. Any institutional-layer authorization source beyond `OPEN` self-join
   (ADR-015 §5's explicitly-deferred `AUTHORIZED_ONLY` mechanisms — roster
   import, admin provisioning, SSO). Not needed while Ruppin uses the
   already-decided `OPEN` flow.
2. Novelty-budget tuning across multiple new topics (product spec §10) —
   meaningless with one Course and a one-month-old content set.
3. Repeated-skip behavioral policy (explicitly undecided, product spec §20).
4. Full History UI (explicitly deferred beyond V1 by design, product spec
   §18) — not just deferred past the demo, deferred past V1 generally.
5. Timezone/DST edge-case handling beyond the qualitative local-day rule
   (product spec §15, `docs/TODAY_TIMEZONE_EDGE_CASES.md` territory) — a
   short, geographically-concentrated pilot at one institution is not where
   this risk materializes.
6. Cross-Course fairness/floor mechanisms — explicitly rejected as a
   permanent product rule (product spec §7), not merely out of scope for the
   demo.

---

## 5. Boundary this document will not recommend crossing

Regardless of one-month pressure, the following remain non-negotiable per
`CLAUDE.md` §6 and are listed in §2 as MUST HAVE, not optional:

- Real Auth and real `userId` derivation from the authenticated principal —
  never client-supplied.
- Idempotency on answer submission (ADR-010's advisory-lock + `(user_id,
  submission_id)` transaction model).
- Immutable Attempts (ADR-005) — no shortcut that allows rewriting history to
  "fix" a demo glitch live.
- No permissive placeholder RLS policies (`CLAUDE.md` §6) — if real RLS
  policies cannot be finished and tested in time, the fallback is narrowing
  the demo's data-access surface through the application layer, not writing
  a permissive placeholder policy to unblock the UI faster.

If the one-month timeline turns out to be incompatible with finishing these
safely, the correct response is narrowing the demo's functional surface
further (e.g. fewer question types, a smaller content set, a single fixed
demo account flow rehearsed in advance) — not relaxing any item in this
list.

---

## 6. Open dependency

This document was written before `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`
(a parallel in-session work item) had landed in the repository. If that
review surfaces a reason Global Today would be cheaper to build than assumed
here (e.g. a persistence shape that is nearly free on top of Course Today),
that would weaken this document's effort-based reasoning in §1 but not its
core demonstrability argument — a single-Course classroom audience still
cannot observe cross-Course ranking behavior no matter how cheap it is to
build. The recommendation to defer Global Today past the Ruppin demo should
be re-checked against that review once available, but is not expected to
change based on cost alone.

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (canonical product-language reference)
- `docs/GLOBAL_TODAY_UX_STATE_MACHINE.md` (companion document — which states
  from that machine map to this document's MUST-HAVE list)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011)
- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  (ADR-015)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (ADR-010)
- `docs/DECISIONS/005-attempts-are-immutable.md` (ADR-005)
- `docs/ROADMAP.md` §19 (Pilot Readiness)
- `docs/PRODUCT.md` §13 (new learner ≠ nothing to review)
- `CLAUDE.md` §6 (non-negotiable security/infra boundaries)

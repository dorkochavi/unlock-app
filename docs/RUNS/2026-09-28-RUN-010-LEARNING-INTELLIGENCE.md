# UNLOCK — Run 010 — Learning Intelligence

RUN_ID: `2026-09-28-RUN-010-LEARNING-INTELLIGENCE`
START_HEAD: `d39c882`
LAST_VERIFIED_HEAD: `b82d194`
RUN_STATUS: COMPLETE

Branch: `feature/run-010-learning-intelligence`

Status: **COMPLETE** — not merged, not pushed, no hosted mutation of any kind. Executed as a Long
Autonomous Run (thin parent orchestrator + fresh, sequential, scoped workers — `Agent` tool,
`subagent_type: general-purpose`, zero inherited context per worker — per
`.claude/skills/autonomous-run/SKILL.md`), the third such execution in this repository after Run
UX-03-QA2 and the DevOS Micro-Optimization Pass.

---

## 1. Run Goal

Move UNLOCK from finite-question Practice toward a genuinely adaptive learning system. Canonical
principle (given verbatim in the Run's own kickoff message): *"Learner chooses scope and duration.
UNLOCK chooses the learning sequence. Simple outside, intelligent inside."* Concretely: resolve
same-day Practice repetition/evidence semantics (`FUB-034`), investigate the FSRS short-due
calibration question (`OQ-044`), replace the hardcoded Today Plan size with a real budget policy and
add exam-urgency as an NBA amplifier, close a real cold-start Topic-clustering gap, surface
learner-facing selection reasons (`OQ-018`), audit learner/instructor readiness-language honesty,
close the confidence-capture gap that left misconception escalation permanently inert, investigate
PARTIAL grading, resolve the Author-can-learn-own-Course architecture question (`FUB-036`), and close
out with a bounded UI-polish carryover from hosted Preview QA.

## 2. Scope Completed

- **FUB-034 same-day Practice repetition** — a strict-phase Tier 4 "reinforcement" fallback in
  `selectPracticeBatch` (activates only once Tiers 1–3 are genuinely exhausted for the requested
  scope), weaker/incorrect-evidence-first then least-recently-answered-first, with an
  anti-immediate-repeat rule restricted to exact ties; extended the existing ADR-020 early-correct
  scheduler freeze so any 2nd+ same-day real Attempt never re-invokes a real FSRS scheduler
  transition, closing a mastery-inflation risk.
- **OQ-044 (FSRS short-due behavior)** — empirically confirmed as stock `ts-fsrs` v5.4.2 Learning-state
  design (a fresh card's first GOOD rating is genuinely due again in ~10 minutes), not a UNLOCK defect;
  no config change. Two adversarial audits requested mid-Run: the reinforcement scheduler freeze holds
  even against a genuinely-due-again-same-day Question (verdict: intentional, no change — reversing
  would reopen the exact gaming vector Tier 4 closed); the anti-immediate-repeat swap had a real bug
  (an unconditional swap could demote a materially stronger, uniquely-top candidate purely to avoid an
  immediate repeat) — found, fixed (swap now fires only on an exact priority tie), and a pre-existing
  green integration test that had the bug baked in as its own expected behavior was later found stale
  and corrected (see §4).
- **Today Plan Budget + exam urgency** — replaced the hardcoded `maxItems: 15` constant with a real
  tiered-bucket budget policy (`computeTodayPlanBudget`, bounded `min(15, max(coreNeed, 5))`,
  same-day-learning-step artifacts excluded from the due-workload count per the OQ-044 finding above);
  exam-date urgency wired as a bounded multiplicative NBA tie-break amplifier only (never crosses tier
  boundaries, neutral when no exam date is set, never invents an exam date).
- **OQ-018 selection reasons + cold-start diversification** — honest, non-numeric, per-item Today/
  Practice selection reasons mapped from real internal NBA tier/reason codes (no new taxonomy); found
  and fixed a real bounded bug where unseen-Question selection could cluster within one Topic,
  replaced with deterministic Topic-diversifying round-robin selection strictly inside ADR-017's
  existing envelope (unseen-only, max 3, no per-Course quota).
- **Readiness/progress honesty audit** — audited the shipped Run 009 Topic-state Progress view and
  instructor Insights against `LEARNING_ENGINE.md` §44's honesty principle; verdict: no defect found,
  both already correctly distinguish "insufficient evidence" from a real weak/negative signal.
  Preserved unchanged.
- **Confidence capture (OQ-014, V1-required half)** — wired the already-existing end-to-end confidence
  plumbing to a minimal sure/not-sure capture UI in both Today and Practice, closing the actual
  production gap (`submitPracticeAnswer` previously hardcoded `confidenceLevel: null`) that left
  misconception's `confidenceLevel === "high"` escalation gate permanently inert. Gate logic itself
  unchanged — only its input now actually arrives.
- **PARTIAL grading (FUB-034 item 3)** — investigated; no accepted direction or candidate-option list
  exists for this one (unlike confidence). A decision packet (3 options, no forced recommendation) was
  escalated; the product owner chose Option A (status quo — decline PARTIAL grading for V1). Recorded,
  not implemented, per that decision.
- **FUB-036 (Author-Can-Learn-Own-Course) — the Run's largest single item.** Re-confirmed the schema
  block was real and un-worked-around; delivered a decision packet with three schema-shape options; the
  product owner chose a fourth ("Option 4"): a separate, additive `course_authors` management-capability
  table, phased with a hard human gate before the destructive phase. Implemented in three gated phases
  (H.1 additive schema + backfill, H.2 application-layer authorization cutover, H.3 — after explicit
  human go-ahead — the destructive legacy-row migration, an author self-enrollment exception, and
  fail-closed last-author protection). Full detail in §4.
- **Hosted-QA polish carryover** — 4 bounded presentation items from real Preview QA: non-color-only
  correct/missed-correct answer feedback; an intentionally-sized, non-full-width Skip target so Submit
  stays the one dominant primary action; subtle lavender/purple Courses-card hover/focus/pressed states
  with the author-management entry kept a visibly secondary, non-competing action; consistent Progress
  card height/padding/status placement with the existing semantic color table only (no new colors, no
  dashboard/gamification/fake precision).

## 3. Scope Not Completed

- **PARTIAL grading real implementation** — explicitly declined by the product owner (status quo, Option
  A); `docs/FOLLOW_UP_BACKLOG.md` FUB-034 item 3 stays open/declined, not resolved, for a possible
  future revisit.
- **FUB-036 Option 4 optional H.4** (Insights CTE cleanup/polish) and new co-author-management UI —
  both explicitly declined by the product owner rather than let RUN010-H expand further; carried
  forward as `FUB-042`.
- **`revokeCourseAuthor`'s concurrency hardening** — the function is implemented and tested but not
  wired to any API route; its check-then-write last-author-protection race (no DB-constraint backing,
  unlike this module's other accepted races) must be hardened (e.g. `SELECT ... FOR UPDATE`) before any
  future Slice exposes it via an endpoint. Recorded in `FUB-042`.
- **`practice-vertical.test.ts`'s genuinely pre-Run010 `topicId` schema-test failure** — confirmed via
  bisection to predate this Run entirely (reproduced at `d39c882` itself); left untriaged, tracked by
  `FUB-041`'s own Promotion Trigger.
- **Question Management Workspace redesign** — deliberately out of scope throughout (explicitly Run011,
  `FUB-037`); the hosted-QA polish Slice was briefed not to touch it and didn't.

If none of the above applied, this section would read `None.` — it does not; every item above is a
real, named, intentionally-deferred boundary, not an omission.

## 4. Important Decisions

1. **FUB-036 Option 4 architecture (2026-09-29, product owner)** — a separate, additive `course_authors`
   table modeling management capability independently of `course_memberships`, which narrows to
   learner-participation-only. Three specific decisions approved alongside it: an author self-enrollment
   exception (an active Course Author may self-join their own otherwise-ineligible Course as an ordinary
   LEARNER, no special downstream treatment); last-author protection (`revokeCourseAuthor` fails closed
   rather than ever leaving a Course with zero active authors); phased pacing with a **hard human gate**
   before the destructive migration phase (H.3). Full text: `docs/FOLLOW_UP_BACKLOG.md` FUB-036.
2. **PARTIAL grading declined (2026-09-28, product owner)** — Option A (status quo) chosen from RUN010-G
   Half B's decision packet; no new grading/mastery/scheduler semantics invented.
3. **RUN010-H.4 declined (2026-09-29, product owner)** — explicit instruction not to let RUN010-H expand
   further once its approved scope (H.1–H.3) was KEEP; remaining polish/hardening items preserved as
   `FUB-042` instead.
4. **Pre-H.3 due-diligence finding and correction (2026-09-29)** — a due-diligence review requested
   before authorizing H.3 found that a recurring "2 pre-existing/unrelated schema failures" claim
   (`FUB-041`, repeated unverified through several Slices) was only half accurate: one failure genuinely
   predates the Run, but the other was introduced by RUN010-C's own intentional anti-immediate-repeat
   fix and never caught because that Slice's own commit never re-ran the schema suite. Fixed as a small
   standalone corrective commit before H.3 was authored, per explicit instruction, not folded into H.3.
5. **Human-gate policy (2026-09-28, product owner, mid-Run)** — from RUN010-E onward, do not pause for
   human review at every Slice boundary; continue autonomously unless a worker itself returns
   STOP/ESCALATE. Two named mandatory gates preserved regardless: FUB-036 reaching an actual
   schema/authorization decision point, and final Run close. This directive shaped the Run's own
   execution rhythm from RUN010-E through RUN010-J.

## 5. Implementation Summary

- **Domain**: `src/domain/course/types.ts` (`CourseAuthorGrant`/`isActiveAuthorGrant`/
  `hasActiveAuthorGrant`, `COURSE_AUTHOR_CAPABILITIES`); `src/domain/learning/progress-update.ts`,
  `learning-session.ts` (`deriveIsReinforcementAttempt`, scheduler-freeze extension);
  `src/domain/learning/today-plan-budget.ts`, `exam-urgency.ts` (new).
- **Application**: `src/application/practice/select-practice-batch.ts` (Tier 4 reinforcement,
  `rankReinforcementCandidates`, Topic-interleave carryover); `src/application/course/join-course.ts`
  (self-enrollment bypass), `revoke-course-author.ts` (new use case), `create-course.ts`,
  `get-course-context-for-learner.ts`, `list-my-courses.ts`, `ports.ts` (`CourseAuthorRepository`,
  `CourseRepositories.authors` now required), and 17 other authorization call sites across
  `topic/`, `question/`, `import/`, `insights/` cut over from `canAuthorCourse`/`isManagementRole` to
  `hasActiveAuthorGrant`.
- **Infrastructure/Persistence**: `src/infrastructure/postgres/course-author-{repository,mapper}.ts`
  (new); `postgres-course-unit-of-work.ts` and 2 other UnitOfWork classes updated to wire the now-
  required `authors` repository.
- **Migrations**: `supabase/migrations/20260929010000_course_authors_v1.sql` (H.1, additive:
  `course_authors` table + same-migration backfill); `20260929020000_course_membership_learner_only_v1.sql`
  (H.3, destructive-but-provably-redundant: deletes legacy OWNER/INSTRUCTOR `course_memberships` rows,
  narrows the `role` CHECK constraint to `LEARNER`-only). Both local-only; hosted application remains a
  separate human action.
- **API**: ~19 route files updated to wire the now-required `authors` repository (no functional route
  behavior change beyond the underlying authorization-source swap); `handle-get-course-context.ts`/
  `handle-get-my-courses.ts` gained an `isAuthor` DTO field.
- **UI**: `src/app/(learner)/today/question-card.tsx` (confidence capture, non-color-only
  correct/missed-correct feedback, Skip sizing), `src/app/(learner)/courses/course-row.tsx` (hover/
  focus/pressed states), `src/app/(learner)/progress/course-section.tsx` (card consistency); Practice
  batch/reason surfaces for OQ-018.
- **Documentation/Development OS**: `docs/FOLLOW_UP_BACKLOG.md` (FUB-034 items updated, FUB-036 full
  history, FUB-038 through FUB-042 added/resolved); `docs/OPEN_QUESTIONS.md` (OQ-044 addendum);
  `scratch/development_checkpoint.md` (Run-local orchestration state throughout — this file, not a new
  permanent document, per the autonomous-run skill's own model).

## 6. Verification Evidence

Per-Slice targeted evidence was produced and independently reviewed at every Slice (see
`docs/FOLLOW_UP_BACKLOG.md`'s per-Slice outcome writeups, especially FUB-036's H.1/H.2/H.3 entries, for
full per-Slice detail — not reproduced here per `.claude/rules/testing.md` §11's Run-End Acceptance:
valid Slice evidence is reused, not blindly replayed). Fresh, Run-level integration evidence gathered at
this Run's close, at final HEAD `b82d194`:

- **Full unit suite**: 1665/1665 PASS (162 files).
- **Full schema/PGlite suite**: 331/332 PASS (34/35 files). The one failure is exactly the already-
  classified genuine pre-Run010 `practice-vertical.test.ts` `topicId` mismatch (`FUB-041`) — confirmed
  the ONLY failure, nothing new introduced.
- **Typecheck**: clean.
- **Lint**: clean (0 errors; the same 1 pre-existing, unrelated warning every prior Run in this
  repository has also carried, `.claude/telemetry/statusline.mjs`).
- **Production build** (`next build`): clean, 39 routes compiled successfully (14 static, 25 dynamic).
- **Mocked-browser/Playwright evidence**: produced per-Slice where the change class warranted it
  (RUN010-I's own 4-item verification: 375px mobile, desktop, RTL, keyboard focus, no horizontal
  overflow, one dominant primary CTA with Skip visibly secondary — confirmed in a real headless
  Chromium session against the actual modified components). No new whole-Run browser walkthrough was
  authored at close — the per-Slice PGlite integration coverage (including a real end-to-end dual-role
  Author-Learner walkthrough through the actual `selectPracticeBatch`/`submitPracticeAnswer` pipeline at
  H.3) already proves the cross-cutting claims a Run-level browser pass would otherwise exist to prove,
  matching the precedent set by Run UX-03-QA2's own integrated-verification Slice.

**NOT proven by this Run** (stated honestly, matching every prior Run report's own convention): real
hosted Preview/Supabase integration; real hosted latency; true multi-connection concurrency (PGlite is a
single in-process engine); hosted application of either new migration (`course_authors_v1`,
`course_membership_learner_only_v1`) — both remain human/manual actions per `.claude/rules/postgres.md`.

## 7. Review Evidence

Reviewer selection was made per-Slice by each Slice's own worker under `/review-commit`'s risk-based
criteria (not automatic ceremony):

- **RUN010-B** (Practice reinforcement, FSRS-adjacent): `unlock-reviewer` — NO BLOCKING FINDINGS (1 nit
  fixed directly, 1 deferred as `FUB-038`).
- **RUN010-C** (FSRS/anti-repeat audit): `unlock-reviewer` — NO BLOCKING FINDINGS (1 non-blocking note).
- **RUN010-D** (budget/exam urgency): `unlock-reviewer` — NO BLOCKING FINDINGS (2 non-blocking, both
  addressed as doc-only notes).
- **RUN010-E** (OQ-018/cold-start): `unlock-db-reviewer` (1 correction, fixed, 2 non-blocking) +
  `unlock-reviewer` (1 claim-accuracy correction, addressed by recording `FUB-040` rather than
  overstating).
- **RUN010-G** (confidence capture): `unlock-reviewer` + `unlock-security-reviewer` — both NO BLOCKING
  FINDINGS (1 non-blocking each, both addressed).
- **RUN010-H.1** (`course_authors` schema): `unlock-db-reviewer` — NO BLOCKING FINDINGS (3 non-blocking
  notes, no action required).
- **RUN010-H.2** (authorization cutover): `unlock-security-reviewer` + `unlock-reviewer` — both
  independently NO BLOCKING FINDINGS (6 non-blocking documentation/cleanup notes, none actioned).
- **RUN010-H.3** (Migration B + self-enrollment + last-author protection): `unlock-db-reviewer` +
  `unlock-security-reviewer` + `unlock-reviewer` — all three independently NO BLOCKING FINDINGS. One
  substantive non-blocking DB-reviewer finding (the `revokeCourseAuthor` concurrency race, §3/`FUB-042`)
  correctly deferred rather than fixed under time pressure, since the function is not yet wired to any
  route.
- **RUN010-I** (UI polish): `unlock-reviewer` — PASS, no blocking findings (1 informational-only note
  confirming a deliberate visual distinction, not a bug).

No DB or security reviewer was used for Slices with no persistence/authorization surface (C, D, F, I),
consistent with `.claude/rules/testing.md` §3's "no schema/DB reviewer merely because the project has a
database" guidance. RUN010-A and RUN010-F were pure analysis/audit with zero diff, so no reviewer was
dispatched (`review-commit`'s own zero-diff criterion).

## 8. Run Telemetry

**NOT CLEANLY AVAILABLE for this Run specifically — a real recurrence of a previously-tracked drift
pattern, not a missing-instrumentation gap.** `docs/DEV_STATUS.md`'s Development OS Active Observations
already tracked "RUN_ID attribution drift" (telemetry keeps accumulating under whatever `RUN_ID:` value
`docs/CHATGPT_PLAN.md` currently declares, until that field is changed) as a `WATCH` item after Run
UX-03 broke a two-Run streak by setting its own fresh `RUN_ID` at start. This Run did not repeat that
practice: per the autonomous-run skill's own minimal model, it tracked all orchestration state in
`scratch/development_checkpoint.md` and correctly did not create a mid-Run `CHATGPT_PLAN.md` entry — but
that also meant `CHATGPT_PLAN.md`'s `RUN_ID:` field stayed on the prior `2026-09-28-DEVOS-MICRO-OPT-001`
value for this Run's entire duration, so `.claude/telemetry/summarize.mjs` for
`2026-09-28-RUN-010-LEARNING-INTELLIGENCE` returns 0 events/0 sessions, while the same script for
`2026-09-28-DEVOS-MICRO-OPT-001` returns 3089 events / 7 sessions — a mix of that earlier Run's own
legitimate telemetry AND this entire Run's, with no reliable way to cleanly separate them after the
fact. Per the Run Report template's own explicit instruction ("do not estimate missing runtime
metrics"), no cost/duration/token figures are reported here. See §9 for the resulting Development OS
follow-up.

## 9. Follow-Up Backlog

- `FUB-038` — reinforcement scheduler-freeze scoped to "any earlier attempt," not "any earlier RATED
  attempt" (currently unreachable in production). RECORDED.
- `FUB-039` — a card touched only via same-day reinforcement can't graduate out of FSRS "Learning" state
  that day (bounded to one day, resolves next real-day touch). RECORDED.
- `FUB-040` — residual OQ-018 gaps: cross-Course pooling still `createdAt`-only, not Topic-aware;
  `STRENGTHEN_MEMORY`/"exam approaching" have no honest OQ-018 mapping; the `/api/daily-plan/today` DTO
  still exposes raw tier/reasons/actionType at the wire level (pre-existing, not a UI leak, but a real
  API-contract gap). RECORDED.
- `FUB-041` — RESOLVED this Run. One of its two originally-reported schema/PGlite failures was
  genuinely pre-Run010 (confirmed via bisection to `d39c882`); the other was a RUN010-C-introduced stale
  test, now fixed. Its own Promotion Trigger (triage the genuine pre-Run010 `topicId` failure) remains
  open, unrelated to this Run's own scope.
- `FUB-042` — new this Run. FUB-036 Option 4's declined optional H.4 scope (Insights CTE cleanup) +
  `revokeCourseAuthor`'s required concurrency hardening before any future route wiring + new
  co-author-management UI, all explicitly deferred by product-owner instruction rather than expanding
  RUN010-H further.
- **Development OS**: the RUN_ID-attribution-drift `WATCH` item (`docs/DEV_STATUS.md`'s Active
  Observations) has now recurred a second time, via a different mechanism than the one previously
  tracked (a Run using the autonomous-run skill's own `scratch/development_checkpoint.md` model, rather
  than a Run simply forgetting to update `CHATGPT_PLAN.md`'s field). Worth a `CHANGE` consideration: the
  autonomous-run skill's own Phase 0 preflight (§2) could be extended to require setting
  `CHATGPT_PLAN.md`'s `RUN_ID`/`START_HEAD` fields at Run start even when the Run otherwise tracks its
  own state in the scratch checkpoint, specifically so telemetry attribution stays correct — this Run
  did not do that, and it is the second Run-level pattern (not yet three) to show the gap this way.

## 10. Manual / Hosted Actions

- Applying either new migration (`20260929010000_course_authors_v1.sql`,
  `20260929020000_course_membership_learner_only_v1.sql`) to hosted Supabase — `supabase link`/
  `supabase db push` were never invoked by this Run, per `.claude/rules/postgres.md`.
- Deciding whether/when to merge and deploy this branch (which also still carries the unmerged Run
  UX-03 + QA1 + QA2 product-experience work from before this Run started) remains a human decision, not
  attempted by this Run.
- No push of any kind was performed.

## 11. Final Repository State

```text
Branch: feature/run-010-learning-intelligence
Closing HEAD: the Run-close documentation commit, created immediately after this report — derived from
              git after that commit exists (never self-cited by this file itself, per the Handoff
              Model this repository already uses instead of a retired "Final HEAD" self-reference)
LAST_VERIFIED_HEAD (code/verification): b82d194
Working tree: clean
Push state: not pushed
Deployment state: not deployed by this Run
Hosted database state: unchanged by this Run (both new local migrations NOT applied hosted)
```

## 12. Result

```text
RUN_010_COMPLETE
```

FUB-036 (Author-Can-Learn-Own-Course) is fully implemented and working — the Run's own largest and
riskiest item, closed through a deliberate 3-phase gate rather than a single risky commit. Next Run
(Run 011 — PDF/AI, per `docs/DEV_STATUS.md`'s roadmap list) is not automatically begun by this Run; it
remains the product owner's decision when to start it, and separately, whether/when to merge this branch
(which still also carries the unmerged Run UX-03/QA1/QA2 product-experience work) toward `main`.

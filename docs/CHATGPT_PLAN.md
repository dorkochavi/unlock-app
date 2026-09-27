# UNLOCK — Run UX-03-QA1 — Preview QA Corrections

PLAN_VERSION: 002
RUN_ID: 2026-09-27-UX-03-QA1
BASE_HEAD: 8b98dcb
STATUS: **COMPLETE (locally)** — all Slices QA1-A through QA1-H done; see `docs/RUNS/2026-09-27-UX-03-QA1.md` for the full Run report and final QA disposition table. Final HEAD `0442c91`, not merged/pushed/deployed.

This is a pre-merge correction Run, NOT Run 010/011. Run UX-03 was completed locally and pushed to Preview; the product owner then performed hands-on QA using a real 30-question course (`מבוא לכלכלה התנהגותית — QA`) and filed 15 findings. See the pasted Run brief (not duplicated here) for full scope, per-finding detail, guardrails and stop conditions; this file owns the ordered Slice queue, classification table and status only, per `CLAUDE.md` §2/§4. All work stays local on `feature/run-ux-03-product-experience`; no push/merge/deploy; Run 010/011 are not started.

## 0. Finding Classification

| # | Finding | Class | Slice |
|---|---|---|---|
| 1 | Bulk review/publish for imported Questions | IMPLEMENT NOW (reuse `publishQuestion` per-id, no new source-of-truth) | QA1-E |
| 2 | Explanation after every submitted answer | IMPLEMENT NOW | QA1-B |
| 3 | Reveal correct answer(s) after submission | IMPLEMENT NOW | QA1-B |
| 4 | Answer-option order must not teach the test | IMPLEMENT NOW (client-side stable per-presentation shuffle) | QA1-B |
| 5 | Question order must not mirror import/ID order | IMPLEMENT NOW, tie-break only (Topic-interleave among fully-tied NBA candidates; no ranking/priority change) | QA1-C |
| 6 | Assessment-pattern leakage (position/length/style bias in content) | RECORD FOR RUN 011 (content-quality critic) | — |
| 7 | Practice batch completion learning summary | IMPLEMENT NOW (existing batch data only) | QA1-C |
| 8 | Practice must not dead-end (open-ended same-day repetition) | DESIGN + RECORD FOR RUN 010 (evidence/scheduler semantics) — NOT implemented this Run | QA1-C (record only) |
| 9 | Today plan size / Daily Plan Budget | DESIGN + RECORD FOR RUN 010 — NOT changed this Run | QA1-C (record only) |
| 10 | Progress: acknowledge effort before mastery certainty | IMPLEMENT NOW (existing attempted/total data only) | QA1-D |
| 11 | Topic detail off top-level Progress, into Course context | IMPLEMENT NOW | QA1-D |
| 12 | Consistent top-left logout | IMPLEMENT NOW | QA1-F |
| 13 | Canonical Hebrew label `"היום שלי"` | IMPLEMENT NOW (copy audit) | QA1-F |
| 14 | Hosted loading feels slow | IMPLEMENT NOW where measured/evidence-backed; else recorded | QA1-G |
| 15 | Learning-not-grading tone | IMPLEMENT NOW (folded into QA1-B/C copy) | QA1-B/C |
| PARTIAL | MULTIPLE_CHOICE "partially correct" | Confirmed: no canonical PARTIAL outcome exists (`isCorrect: boolean` only, `src/domain/learning/answer.ts`/`types.ts`). RECORD FOR RUN 010; not invented this Run. | QA1-B (record) |

## 1. Slice Queue

1. **QA1-A — Grounding + Run plan.** DONE — findings verified against repository reality (explanation/correct-answer columns exist and are already excluded from the pre-answer learner-safe read path `LearnerQuestionContentRepository`/`PostgresLearnerQuestionContentRepository`; grading is `isCorrect: boolean` only, no PARTIAL; NBA ranking's final tie-break is plain `questionId` ascending, shared with Today generation — must not be touched directly; Progress/Course page IA already split the right way structurally (Course page already renders `TopicList`); `publishQuestion` is a clean single-Question transaction safe to call per-id in a loop for bulk publish).
2. **QA1-B/C/D — Learning feedback, Practice presentation, Progress IA (DONE `814eace`).** Post-submit explanation + correct-answer reveal for Today and Practice (shared `QuestionCard`); new POST-submit-only `AnswerFeedbackContentRepository` read path; stable per-presentation answer-option shuffle; Practice Topic-interleave tie-break (`interleaveByTopic`, Tier 1/Today untouched) + batch-completion learning summary; Findings 6/8/9 + PARTIAL grading recorded (`docs/FOLLOW_UP_BACKLOG.md` FUB-034/FUB-035), not implemented; Progress reduced to Course-level activity summary.
3. **QA1-E — Instructor bulk publish (DONE `ab03784`).** Selection + "Publish selected" / "Select all valid" on the Course-manage Questions list, calling the existing `publishQuestion` use case once per selected id; honest partial-failure reporting.
4. **QA1-F — Shell/copy (DONE `cea7219`, `0442c91`).** Consistent top-left sign-out via a new shared `LearnerUtilityBar` + the instructor shell; canonical `"היום שלי"` Hebrew copy audit closed (0 remaining non-compliant instances); convention recorded in `docs/UX_SPEC.md` §12 item 58.
5. **QA1-G — Loading/performance (DONE, audit only — no code change).** Code-level journey audit found no new/fixable client-side fetch waterfall; recorded honestly, no speculative fix applied.
6. **QA1-H — Integrated verification + Run close (DONE `0442c91`).** Full QA matrix incl. a real mocked-browser Playwright pass (17/17 checks), `docs/RUNS/2026-09-27-UX-03-QA1.md`, `docs/DEV_STATUS.md` update, telemetry summary, final disposition table. STOP — not merged/pushed/deployed; Run 010/011 not started.

## 2. Guardrails (unchanged from Run UX-03, still binding)

No new Learning Engine/scheduler/mastery/PARTIAL semantics; no Today mutation; no new persistence/schema beyond what is explicitly justified; no push/merge/deploy/hosted mutation; Hebrew/RTL-first, mobile-first; Visual Contract (`docs/UX_SPEC.md` §11-§12) remains authoritative.

---

## Historical — Run UX-03 Plan (superseded; reference only — see `docs/RUNS/2026-09-27-UX-03.md` for the Run report)

STATUS: **COMPLETE (locally)** — all Slices UX3-1 through UX3-7 done; see `docs/RUNS/2026-09-27-UX-03.md` for the full Run report. Phase A audit COMPLETE (`7d04f47`). UX3-1 COMPLETE + product-owner checkpoint APPROVED WITH CALIBRATION CORRECTIONS (`9eefe3d`, `01fd917`) — Visual Contract recorded in `docs/UX_SPEC.md` §11-§12. UX3-2 COMPLETE (`c969e69`). UX3-3 COMPLETE (`46bb7ee`). UX3-4 COMPLETE (`770b374`). UX3-6 COMPLETE (`b81ff01`). UX3-5 COMPLETE (`f5ca16c`). UX3-7 COMPLETE (`e6b91da` + this Run report). Final HEAD `e6b91da`, not merged/pushed/deployed. Fresh RUN_ID established per DevOS longitudinal review recommendation (`docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §8.2) so UX-03 telemetry is not attributed to the closed `2026-09-26-UX-02` folder. Run UX-02's own plan content is preserved below this Run's own content is written above it, and the full historical UX-02 plan/carried-over Slice-B table is retained further down for reference until archived.

This Run is mostly autonomous, with one intentional product-owner checkpoint after UX3-1 (visual-system direction). See the pasted Run brief (not duplicated here) for full scope, decisions, guardrails, and stop conditions; this file owns the ordered Slice queue only, per `CLAUDE.md` §2/§4.

## 1. Run Goal

Make UNLOCK feel like one intentional, coherent, fast and comfortable product across its V1 user-facing surfaces (learner, instructor, auth, authoring, import, progress/insights). No new product capabilities; product gaps found during UX work are recorded/deferred (`docs/FOLLOW_UP_BACKLOG.md`) unless they make an existing V1 flow unusable.

## 2. Authority

- `docs/UX_SPEC.md` owns durable UX/product rules (navigation model, Learn Mode, visual system principles) — implemented, not redesigned.
- This Plan owns Run UX-03 Slice order/scope only.
- Unchanged and binding: ADR-016/017/018/020, `LEARNING_ENGINE.md`, `.claude/rules/*` — no learning/role/auth semantics change in this Run.

## 3. Phase A — Product Experience Audit (COMPLETE 2026-09-27)

Read-only inspection of the actual repository implementation (not docs) across every listed learner/instructor surface, real journey traces via Link/router targets, and a motion/loading pass. Full method: real file reads + Grep across `src/app/**`, `src/components/**`, journeys traced through actual route/link targets (not assumed).

### 3.1 Visual system finding

The learner surface (`src/app/(learner)/**`) is a fully realized token-based system (100% semantic tokens + shared primitives: `Button`/`Card`/`PageHeader`/`StateBlock`/`StatusPill`). The two pre-product entry points (`src/app/login/page.tsx`, `src/app/join/[courseId]/page.tsx`, `src/app/page.tsx`) and the entire instructor surface (`src/app/instructor/**`) are a different, older raw-Tailwind (`zinc`/manual `dark:`) visual language with **zero** shared-primitive usage and no button-hierarchy at all (the instructor Course-manage page had ~18 identically-weighted `bg-zinc-900` buttons/links on one screen).

### 3.2 UX debt map

**P0 — broken/confusing V1 experience**
1. Instructor Course-manage page (`instructor/courses/[courseId]/page.tsx`) — no button hierarchy among Create Question / Add Topic / Import / Publish / Item Analysis. → **UX3-1 (DONE)**: migrated to tokens/primitives with primary/secondary/tertiary weights.
2. `login/page.tsx`, `join/[courseId]/page.tsx` — raw styling on the two screens every user sees first. → **UX3-3**.
3. Instructor Course-manage page: Course-metadata fetch → Questions fetch is a real sequential waterfall (`instructor/courses/[courseId]/page.tsx:270-292` pre-Slice numbering). → **UX3-6** (measure first).

**P1 — high-value coherence/usability improvement**
4. Instructor dashboard reachable only via one small tertiary footer link on `/courses` — buried for any OWNER/INSTRUCTOR. → **UX3-2**.
5. No instructor nav shell (Courses/Students/Insights) despite `DEV_STATUS.md`'s stated direction. → **UX3-2**.
6. Instructor Course-manage page mixed metadata/Topics/Questions/Import/Insights in one flat page. → **UX3-1 (DONE)**: now Card-sectioned; further IA cleanup deferred to UX3-2 if needed.
7. Learner Course page: Course context loads, then Topics load separately — a visible two-stage reveal. → **UX3-1 (DONE)**: skeleton added to smooth the visual jump; the underlying two-request shape itself is a UX3-6 measurement candidate, not changed here.
8. No route-level `loading.tsx`/skeleton anywhere — plain text loading state everywhere, causing layout jumps. → **UX3-1 (DONE)** for the two representative surfaces (`Skeleton`/`SkeletonRows` primitive added); propagate elsewhere only where a real jump is observed (UX3-3/UX3-4).
9. Instructor question editor and import page fully raw-styled, same issue as #2 at sub-surface level. → **UX3-4**.
10. Item Analysis page paginates fetches correctly (`Promise.all`) but is still raw-styled. → **UX3-4**.

**P2 — worthwhile polish**
11. Root `/` splash raw-styled (low priority, not on a critical path). → **UX3-4** (bundle with #9/#10) or defer to `FOLLOW_UP_BACKLOG.md` if time-boxed out.
12. Instructor side has no "active section" nav affordance once a nav exists (tied to #5). → **UX3-2**.
13. Today/Practice progress-bar transition had no reduced-motion guard. → **UX3-1 (DONE)**: global `prefers-reduced-motion` convention added in `globals.css`.
14. `TopicList` "תרגול ›" trailing affordance could be visually stronger. → deferred, `FOLLOW_UP_BACKLOG.md` (cosmetic only).
15. Ad hoc `<Link className="rounded-md border ...">` mimicking a secondary button instead of `ButtonLink`. → fixed for the instructor Course-manage page in UX3-1; recurs on other unmigrated instructor pages, folded into UX3-4.

### 3.3 Journey audit (worst finding)

Instructor "entry → Course" is the worst journey in the app: `/` → Courses tab → small tertiary "instructor dashboard" link → `/instructor/courses` → course card = **4 clicks**, with a low-discoverability step 3 (P1 #4). All other traced journeys (learner Today/Course/Practice/Topic-Practice/Progress; instructor create/edit/publish Question, Structured Import, Topics, Insights) are 0–3 clicks with no dead ends or duplicate navigation.

### 3.4 Motion/loading audit

No `prefers-reduced-motion` handling existed anywhere pre-UX3-1 (now fixed globally). No skeleton loading existed anywhere pre-UX3-1 (now available via `Skeleton`/`SkeletonRows`, applied to the two representative surfaces). One genuine fetch waterfall confirmed in the instructor Course-manage page (Course metadata → Questions, sequential); Item Analysis's existing `Promise.all` pattern is the model to point to when addressing it in UX3-6 (measure-first, per Run brief).

## 4. Slice Queue

1. **UX3-1 — Visual System & Shared Interaction Foundation (DONE `9eefe3d`; calibration corrections DONE `01fd917`).** Representative surfaces: Today (verified as reference/no regression), learner Course page (skeleton added), instructor Course-manage page (full token/primitive migration + button hierarchy, then desktop two-column composition + danger-variant/primary-hierarchy calibration after the product-owner checkpoint). New shared primitives: `Skeleton`/`SkeletonRows`, `Input`/`Select`/`Label`, `Button` `dangerSecondary`/`dangerTertiary` variants. Global `prefers-reduced-motion` convention. **Checkpoint: APPROVED WITH CALIBRATION CORRECTIONS** — Visual Contract recorded in `docs/UX_SPEC.md` §11-§12; Save-vs-Publish and Archive/Remove-Topic hierarchy fixed; desktop composition fixed on the reviewed surface.
2. **UX3-2 — Navigation / information architecture (DONE `c969e69`).** Focused IA check first (per checkpoint caution): confirmed no "Students" surface or any other fabricated destination exists anywhere in `src/app/instructor/**` — no nav shell built. Instead: instructor-dashboard link on `/courses` promoted to a header button (data-driven from the already-fetched `course.role`, no new request) for users with an OWNER/INSTRUCTOR membership; `/instructor/courses` and `/instructor/courses/new` migrated to tokens/primitives (moved up from UX3-4 since they're the entry point this Slice touches) with a 2-column desktop grid. General review caught and fixed a duplicate-primary-CTA regression on the empty-course state.
3. **UX3-3 — Learner surface convergence (DONE `46bb7ee`).** Token/primitive migration for `login/page.tsx`, `join/[courseId]/page.tsx`. Checked Today (reference, unchanged) and Progress (single-phase load, no staged reveal — no skeleton needed per the Plan's own "only where a real layout jump is observed" rule) — no further changes warranted.
4. **UX3-4 — Instructor / authoring / import convergence.** Token/primitive migration for question editor, import page, item-analysis page, root `/` splash (items 9/10/11 — courses-list/new-course already done in UX3-2).
5. **UX3-5 — Motion / feedback / loading.** Subtle pressed/pending feedback; any further motion convention needs surfaced by UX3-2–UX3-4.
6. **UX3-6 — Evidence-backed performance fixes.** Measure first: instructor Course-manage sequential fetch (item 3), learner Course-page two-request shape (item 7 follow-up). Fix only if material; record as `FOLLOW_UP_BACKLOG.md` otherwise.
7. **UX3-7 — Integrated V1 experience verification and Run close.** End-to-end experience review of major journeys, before/after calibration matrix (learner/instructor × mobile/desktop, auth/entry, authoring/import), telemetry summary, Run report, `DEV_STATUS.md` update.

The audit may refine these boundaries if later repository evidence supports a better decomposition; no ceremony Slices.

## 5. Guardrails

No new product capability, role/permission change, or Learning Engine/Today/Practice semantic change. No fake functionality. Reuse first; new shared primitives only where real duplication/inconsistency is shown (per audit). Hebrew/RTL-first, mobile-first. No push/merge/deploy/hosted mutation. `PLAN_CONFLICT`/HARD STOP per `CLAUDE.md` §4/§17 and the Run brief's stop-condition list (new product semantics, role/permission changes, Learning Engine semantic changes, non-additive schema change not justified by a direct UX defect, privacy/security decisions, destructive/hosted actions, major new dependency).

## 6. Verification

Per `.claude/rules/testing.md`, UI/presentation change-class: typecheck + lint + targeted mocked-browser evidence (375px mobile, desktop, dark mode, RTL, keyboard/focus, loading/disabled states, no horizontal overflow, reduced-motion where relevant). No schema/DB/security reviewer merely because the project has those layers — reviewer selection stays with `/review-commit` per actual changed-surface risk. Full unit/schema suites reused unless a Slice touches shared domain/application logic (none planned before UX3-6, and even then only if the fix requires it).

## 7. Open Human Items

1. Required checkpoint after UX3-1 (visual-system direction) — see `scratch/development_checkpoint.md`.
2. Hosted Auth Redirect URL allow-list for `next=` values (carried from UX-01/UX-02, still open, non-blocking).
3. OQ-044 (FSRS learning-step calibration, carried, non-blocking, unrelated to this Run).

---

## Historical — Run UX-02 Plan (superseded; reference only — see `docs/RUNS/2026-09-27-UX-02.md` for the Run report)

## 1. Run Goal

Give learners bounded, learner-initiated Course Practice and Topic Practice that use the one existing learning pipeline (Question → Answer → Attempt → Progress → FSRS), never touch Today's plan, and use a server-controlled learning session. Run UX-02 is a standalone learner Run, not a roadmap Product Run.

## 2. Authority

- Session identity, Today isolation, eligibility: ADR-020 (ACCEPTED).
- Scheduling and selection policy: `docs/LEARNING_ENGINE.md` §39A (ACCEPTED).
- Presentation: `docs/UX_SPEC.md` §10 (ACCEPTED) and §1–§8 (accepted).
- Unchanged and binding: ADR-005, ADR-008, ADR-010, ADR-012 (§5 amended for Practice by ADR-020), ADR-015, ADR-016, ADR-017, ADR-018; `.claude/rules/learning-engine.md`, `auth.md`, `api.md`, `postgres.md`.

## 3. Approved Decisions (2026-09-26)

1. Practice is learner-initiated from a Course or Topic; no top-level Practice tab; Today Complete keeps "המשך ללמוד" → `/courses` and never auto-starts Practice.
2. One pipeline, no second Learning Engine; every Practice answer is a real Attempt.
3. Scheduling: never-scheduled → initialize; due → normal review; early incorrect → normal review (may pull earlier); **early correct → evidence/progress only, NO scheduler review** (FSRS state, due date and last-review baseline unchanged). This rule applies to Practice Attempts only.
4. Selector reuses the canonical NBA ranking, scoped to Course/Topic; excludes Questions pending in today's plan and Questions already answered in this learning session; then unseen; then broader coverage (§39A).
5. One learner + one learning day = one server-controlled learning session; V1 implementation = today's DailyPlan id; Practice start get-or-creates today's plan. The client never chooses the Practice session id.
6. V1 eligibility: PUBLISHED Course + active LEARNER membership only (explicit temporary deviation from ADR-016 §16; `F-04b` not solved here).
7. Once today's plan exists, Practice never mutates, resolves, injects into or reopens it.
8. Batches of up to 10, then explicit "עוד 10".
9. No separate Topic page in V1; Topic Practice starts from Topic rows on Course/Progress.
10. Practice Skip (adopted after P0.5/P0.6): tertiary "דלג", no Attempt / progress / mastery / misconception / FSRS change, never counted as incorrect, excluded for the rest of the current Practice run. A Practice run is the current continuous visit on the Practice screen — a presentation concept, NOT the learning-day session; a refresh or re-entry may clear skip exclusions in V1 (accepted).
11. Q1: the canonical NBA ranking is kept unchanged in Practice (not-due strengthen/remediation candidates stay above unseen Questions); no Practice-specific ranking difference.
12. Q2: "due within minutes after the first answer" is recorded as OQ-044 (CALIBRATION, non-blocking); not solved in this Run unless it proves to be a correctness bug.
13. `practiceAvailable` is a server-computed Course-context field.

## 4. Run-Start Contract

Branch `feature/run-ux-02-practice` from `main` at `d052e5c`; `HEAD == BASE_HEAD` or one deliberate docs-only P0 commit above it. Clean tree. No push, no hosted mutation, no hosted migration.

## 5. Repository Facts (inspection, 2026-09-26)

- `submitAnswer` (`src/application/learning/submit-answer.ts`) already accepts `dailyPlanItemId = null`; it validates only version/question/Course consistency — no membership, Course status, current-version or Topic check for that path. The only callers today are the DailyPlan routes.
- Scheduler update: `nextSchedulerMemory` (`src/domain/learning/progress-update.ts:603`) reviews on every ratable Attempt; no early gate. Rebuild/replay uses current logic (ADR-012 §2).
- `learningSessionId` is client-owned for non-Today Attempts (ADR-012 §5); Today uses `dailyPlanId`.
- NBA pieces are pure and Course-agnostic (`next-best-action.ts`, `next-best-action-ranking.ts`); the scope loop is inline in `generate-daily-plan-for-resolved-inputs.ts`. `listForUser(userId, courseId)` and `findUnseenQuestions(userId, courseId, limit)` are Course-scoped; nothing is Topic-scoped.
- `DailyPlanRepository.findByKey({userId, plannedForDate})` reads today's plan; get-or-create lives in `get-or-create-daily-plan-for-today.ts` (timezone required).
- `LearnerQuestionContentRepository` never selects `correct_answer`; it has no authorization filter (caller must scope).
- No practice route, table or UI exists. No `learning_session_id` index found in migrations.

## 6. Slices

Lifecycle per `.claude/skills/implement-slice`; verification per `.claude/rules/testing.md`; reviewers chosen by `/review-commit` (expected choices noted).

### P0 — Docs / Design (DONE — the Run UX-02 design commit)
ADR-020 (ACCEPTED), `LEARNING_ENGINE.md` §39A (ACCEPTED) + golden scenario N, ADR-012 §5 and ADR-016 §16 pointers, ADR README / `CONTEXT_MAP` entries, `UX_SPEC.md` items 10–12, §9 and new §10, `FUB-030` → PROMOTED, OQ-044, this Plan. **P0.5–P0.7** (affordance map, research pass, selector simulation with the real engine): `docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md`; simulation harness in untracked `scratch/ux02/`. **Gate: MET** — ADR-020, §39A and §10 ACCEPTED 2026-09-26; OQ-044 recorded.

### P1 — Domain: Practice early-correct scheduling rule
- `nextSchedulerMemory` (or its caller): when the Attempt has no DailyPlanItem, prior scheduler memory exists, the rating is GOOD (full-evidence correct) and `answeredAt < previousMemory.scheduledReviewAt` → return the previous memory unchanged, not a lapse. All other cases unchanged.
- Confirm (read, then test) how lapse resolution, misconception and mastery treat an early correct Practice Attempt under existing evidence rules; no change to those rules.
- Engine version increment (`PRODUCTION_ENGINE_VERSION`, §47).
- Tests: §39A cases 1–5 table; boundary `answeredAt == scheduledReviewAt` (due); Today-attached early correct unchanged; replay parity (incremental == `rebuildUserQuestionProgress`) including out-of-order; golden scenario N.
- Review: general (learning-engine invariants).
- **Stop:** if the rule needs a persisted source column or changes Today results.

### P2 — Application + persistence: selector and Practice answer
- Learning-session resolver: get-or-create today's plan → session id = plan id (TIMEZONE_NOT_SET handled like Today).
- Eligibility: PUBLISHED Course, active LEARNER membership; Topic belongs to the Course and is not archived.
- Read ports (Postgres + PGlite tests): in-scope published Questions with current version and Topic; Course progress filtered to scope; unseen in scope; Question ids answered in a learning session (`attempts.learning_session_id`); pending plan items' Question ids.
- `selectPracticeBatch(scope, limit 10, skippedHint)`: exclusions (pending in Today, answered this learning day, client skip hint — narrowing only) → reuse NBA candidate generation + ranking on in-scope progress (extract a scope-parameterized helper from the DailyPlan core ONLY if Today output is provably unchanged; otherwise call the pure functions directly) → unseen (ADR-017 order) → broader coverage (earliest `scheduledReviewAt`, then id). Returns learner-safe content via `LearnerQuestionContentRepository` plus `hasMore`; deterministic for fixed state/time/hints. Tests reproduce the P0.7 scenarios S1–S8.
- `submitPracticeAnswer`: eligibility; Question in scope with its CURRENT version; not pending in today's plan; server-derived `learningSessionId`; `dailyPlanId`/`dailyPlanItemId` null; delegates to `submitAnswer` in one transaction (ADR-010); idempotent by `submissionId`; returns `isCorrect` only.
- Index on `attempts (user_id, learning_session_id)` only if the answered-in-session query needs it (additive migration; DB review; hosted application stays a human action).
- Review: general + DB (security if authorization logic is non-trivial).
- **Stop:** new session table needed; Today generation behavior changes; eligibility needs an undecided product rule.

### P3 — API
- `GET /api/courses/:courseId/practice?topicId=&skip=` → `{ scope: { kind, title }, items[], hasMore }` (learner-safe content only; `skip` = client-held skipped ids, validated, narrowing only).
- `GET /api/courses/:courseId/context` gains a server-computed `practiceAvailable` (LEARNER + active non-archived membership + PUBLISHED Course); inspection found the endpoint checks neither Course status nor membership archival today.
- `POST /api/courses/:courseId/practice/answer` `{ questionId, questionVersionId, submissionId, selectedAnswer, topicId? }` → `{ isCorrect }`; client never sends a session id or time.
- Auth before DB and before body parsing; stable outcomes → 401 / 403 / 404 / 409 (pending in Today, stale version) / 422 (timezone); no leakage. Route auth/DB-ordering and outcome tests, following existing route test patterns.
- `safe-redirect` allowlist extended exactly for the Practice route (sign-in `next=`).
- Review: security (+ general).

### P4 — UI
- Route `/courses/[courseId]/practice` (`?topic=&from=course|progress`), Learn Mode throughout (`useLearnMode`, `QuestionCard` reused with Practice Skip semantics, scope title in the context bar), batch-end card (counts only) with "עוד 10" only when `hasMore`, no-more-questions state, error / expired / unavailable states, Exit → origin (UX_SPEC §10).
- Entry points: Course page primary "תרגול בקורס" only when `practiceAvailable`; shared `TopicList` rows become one "תרגול ›" link each (Course page, Progress). Update `UX_SPEC.md` §9 rows to "done".
- Mocked Playwright matrix (375 / desktop / dark / RTL / keyboard / focus / overflow / one primary CTA / exit & back / signed-out `next=` / exhausted / error).
- Review: general.

## 7. Guardrails

No second Learning Engine or ranking policy; no Today mutation; no client-chosen session id or answer time; auth before DB; fail closed on unresolved eligibility; no correct answer or scoring exposed; no percentages; no gamification; no new UI framework; Hebrew/RTL-first, mobile-first.

## 8. Verification

- P1: focused domain tests + replay parity; full unit suite (shared learning primitive changed).
- P2: application tests + PGlite schema/repository tests; migration evidence only if an index is added.
- P3: route tests; typecheck, lint, build.
- P4: mocked browser matrix. **Mocked evidence does not prove real Supabase integration**; a Preview walkthrough with an isolated QA learner (human-provided) is the real-integration check.
- Real multi-connection concurrency (Practice answer vs Today answer on the same Question) relies on the existing per-(learner, Question) advisory lock; PGlite does not prove it.

## 9. Acceptance (Run-level)

- §39A scheduling cases proven by tests, Today behavior unchanged, replay parity holds.
- Practice never selects or accepts a Question pending in today's plan; never mutates the plan.
- Practice Attempts carry the server-derived learning-day session id.
- Only PUBLISHED Courses with active LEARNER membership; Topic scope honored.
- Learner can start Course/Topic Practice, answer up to 10, continue with "עוד 10", reach an honest exhausted state; UX_SPEC §10 states verified in the browser (mocked).
- Engine version incremented; `DEV_STATUS` + Run report; nothing pushed.

## 10. Stop Conditions

`PLAN_CONFLICT` or stop for Dor if: a persisted source column, session table or non-additive migration is needed; Today generation or answers would change; eligibility needs an undecided rule (archived semantics, `F-04b`); a hosted action is required.

## 11. Open Human Items

1. (Done 2026-09-26) ADR-020, `LEARNING_ENGINE.md` §39A and `UX_SPEC.md` §10 accepted.
2. (Done 2026-09-27) Preview walkthrough with an isolated QA learner — manual Preview QA gate PASSED by the product owner; see `docs/RUNS/2026-09-27-UX-02.md` §5a.
3. (Carried) hosted Supabase Auth Redirect URL allow-list check for `next=` values.
4. OQ-044 (FSRS learning-step "due within minutes") — open calibration, non-blocking.

---

## Carried-over context — Slice B Pilot Readiness Verification (verification only; NOT part of Run UX-02)

Date 2026-09-26; base `1866680` (`origin/main`; CI on `1866680` and `d3dfa9d` verified as success via the public GitHub API, read-only and without credentials, during the Q5 check). Nothing was changed or fixed; no source/config/dependency edits. Raw evidence: untracked `scratch/sliceB/`.

**Environments actually used:** Production read-only (`GET` on `/`, `/login`, an unknown path, one static asset, one unauthenticated API route); LOCAL production build (`next build` + `next start`) with network-mocked Playwright scripts and a forged, unsigned expired session cookie (no real account or credentials). **Not available / not done:** no isolated test accounts, no `E2E_*` fixture, no Preview URL, so no authenticated measurement of any kind. `.env.local` points at the real hosted project, so authenticated local runs are not safe without isolated test accounts.

| Question | Verdict | Key evidence |
|---|---|---|
| Q1 Error UX | NO ISSUE | Q1a (mocked offline / 500 / HTML body / 401): Today, Progress, Courses, instructor Courses show Hebrew retry or sign-in states; answer failure shows an inline Hebrew error. Q1b: no `error.tsx`/`not-found.tsx`/`global-error.tsx`; unknown route = default English 404; a forced structurally wrong 200 body reaches Next's default English "This page couldn't load / Reload / Back" (recoverable). Reaching it needs the server to break its own typed DTO contract. |
| Q2 Auth/session | NEEDS MORE EVIDENCE | Q2-A and Q2-C proven at HTTP + UI level (forged expired cookie with invalid refresh token: API 401, auth cookie cleared, Today/Progress/Courses/instructor pages show the sign-in state; no 500). Q2-B NOT proven (real refresh with a valid refresh token after natural expiry); static reading only: server `getUser()` refreshes an expired session (`auth-js` `__loadSession`) and Route Handlers can write cookies. Confirmed recovery-UX gaps below stand independently of Q2-B. |
| Q3 Accessibility | NEEDS MORE EVIDENCE | Only Today (mocked plan, 375/320 px, RTL) was exercised in a real browser: no blocker found (no overflow, logical Tab order, native focus ring, all controls keyboard-operable, options 46 px / submit 48 px). Login/signup, join-through-auth, join, Progress and all instructor flows were NOT exercised (instructor flows: source inspection only). Non-blockers seen: focus falls to `body` after Submit/Continue; feedback/error text not in a live region; sign-out (20 px) and Skip (36 px) are small targets; `text-emerald-600` info text 3.77:1; instructor option inputs are named by placeholder only. |
| Q4 Today performance | NEEDS MORE EVIDENCE | Client waterfall observed: cold Today = 1 GET (first login adds POST timezone + GET), Answer = 1 POST, Continue = 0 requests. No timing measured. Existing FUB-026 evidence (DB statements fast, many sequential round trips, `max=5` p95 4.85 s/3.18 s under 30 concurrent learners) not re-interpreted. |
| Q5 CI/build | NEEDS MORE EVIDENCE | Proven: `npm run build` passes with all `.env.example` variables blanked (78 s, local Windows, cache state not controlled); client factories read env only when called. Read-only public GitHub API (no credentials): CI run on `1866680` and `d3dfa9d` = success; the `main` ruleset contains only `deletion`, `non_fast_forward`, `required_linear_history` (no required status checks, no pull-request rule), consistent with ADR-019 §3 (required checks deferred). So a failed build does not block updating `main` via GitHub rules, and per ADR-019 `main` is the Vercel Production Branch. NOT determined: what Vercel does when a build fails (no `vercel.json`; project settings need auth). Whether a CI build adds worthwhile value is therefore not concluded. |
| Q6a Basic headers | NEEDS MORE EVIDENCE | Production sends only `Strict-Transport-Security`. Per header: **`X-Content-Type-Options` — NO ISSUE** (JSON/JS served with correct content types; no user-uploaded content is served back). **`Referrer-Policy` — NO ISSUE** (no outbound links found in `src`; browsers apply a strict default when absent — general platform knowledge, not tested). **`Permissions-Policy` — NO ISSUE** (only `navigator.clipboard.writeText` on a user click, instructor Course page). **Framing protection (`X-Frame-Options` / `frame-ancestors`) — NEEDS MORE EVIDENCE:** a local page embedding Production `/login` in a cross-site iframe rendered the full login form (2 inputs), so the login page is frameable. The open item is a DECISION, not an experiment (see the list below): the auth cookie is `SameSite=Lax`, so an authenticated view would not receive the session cookie in a cross-site frame; the residual concern is clickjacking of the login form itself. |
| Q6b CSP | NO ISSUE | No unsafe HTML sinks (`dangerouslySetInnerHTML`/`innerHTML` absent), no third-party scripts/fonts/iframes; 2 inline Next bootstrap scripts. A strict CSP needs nonces (dynamic rendering, currently static pages) — high compatibility cost for low pilot benefit. |

**Confirmed sub-finding: expired-session recovery UX gaps** (Q2; observed and reproduced with mocked/forged-session tests; low severity; not a pilot blocker on its own). Missing Q2-B evidence does not cancel these:
- (a) 401 sign-in links go to plain `/login` without `next`, so re-login lands on `/today` (join preserves its intent).
- (b) Instructor mutation calls (save/publish) have no 401 branch and show a generic "failed" message (form state is kept).
- (c) A 401 during an Answer drops the learner's selection with no "not saved" message (the item stays pending).

**Confirmed blockers:** none. "No confirmed pilot blocker" is not the same as "everything is fine": several rows are evidence gaps, and the confirmed recovery-UX gaps above are real though non-blocking.

**NEEDS MORE EVIDENCE (missing / owner / smallest step):**
- Q2-B — missing: an observed request after natural access-token expiry with a valid refresh token. Owner: human. Smallest step: provide one isolated test learner (credentials via `E2E_*` env vars, never chat) and the hosted JWT lifetime; then sign in, wait past expiry, answer a question (Claude observes status/`Set-Cookie`/UI).
- Q3 — missing: rendered/keyboard walkthrough of login/signup, join-through-auth, join, Progress and the instructor flows. Owner: human provides isolated test accounts (learner + instructor + throwaway Course); Claude then walks the flows.
- Q4 — missing: authenticated single-user timings (cold/warm Today, Answer, Continue, N ≥ 5) on Preview and local, judged against the A/B/C bands ("no interruption / noticeable but acceptable / clearly blocking") fixed before measuring. Owner: human (isolated learner + a Course with published questions + Preview URL), then Claude measures.
- Q5 — missing: what Vercel does when a build fails (blocks or promotes) and any Vercel-side build gating. Owner: human. Smallest step: read Vercel Project → Git/Deployments settings (and GitHub Settings → Rules for `main`, already partly visible publicly) and report what is required. Unverified platform behavior: a failed Vercel build normally does not promote to Production.

**Q6a framing protection — open DECISION (not missing evidence; owner: human):** decide whether the framability of `/login` and other public pages (observed: the Production `/login` renders inside a cross-site iframe) justifies adding framing protection before the pilot. No QA account and no further test are needed. If chosen, a possible future action is the framing header via `headers()` in `next.config.ts`; this is not `ISSUE CONFIRMED`, and nothing is applied.

**Observed follow-up candidates (not required by any verdict; nothing applied):** Hebrew `not-found`/`error` boundaries; `next` on 401 sign-in links; 401 branch in instructor mutations; `role="status"`/focus management on Today feedback; four basic response headers via `headers()`; CSP only as Report-Only on Preview if a trigger appears; a CI build step. These are candidates for a later Pilot UX / Readiness decision, not an open Slice.

**Human actions / decisions still open:**
- (a) Isolated QA test data on the single hosted Supabase project, clearly named (e.g. `QA-SliceB-*` accounts and Course, no real Ruppin content), added to the pre-pilot QA cleanup (`docs/PILOT_READINESS.md` item 12; mention only).
- (b) Hosted JWT lifetime.
- (c) Preview URL.
- (d) GitHub/Vercel merge- and deploy-gating facts for Q5.
- (e) Decide whether to close Q4 before the pilot (recommended: yes — Today is the core loop) and Q2-B (may be closed slightly later but must stay explicit).
- (f) Q6a: DECISION REQUIRED (not evidence required): decide whether framing protection is needed before the pilot.

**Boundary note:** Course/Topic Practice (learner-controlled study beyond the finite Today plan) remains a separate future product-design task; nothing here constrains it. Today's completion copy already mentions free practice.

---

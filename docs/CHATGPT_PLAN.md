# UNLOCK — Run UX-02 — Course & Topic Practice

PLAN_VERSION: 001
RUN_ID: 2026-09-26-UX-02
BASE_HEAD: d052e5c
STATUS: APPROVED — P0 and P0.5–P0.7 (design, research, selector simulation) accepted 2026-09-26 and committed on `feature/run-ux-02-practice`; ADR-020, `LEARNING_ENGINE.md` §39A and `UX_SPEC.md` §10 ACCEPTED. P1–P4 COMPLETE locally 2026-09-27 (commits on `feature/run-ux-02-practice`, not pushed); see `docs/RUNS/2026-09-27-UX-02.md`. Remaining: human Preview walkthrough with an isolated QA learner.

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
2. Preview walkthrough with an isolated QA learner after P4.
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

# UNLOCK — Run UX-01 — Learner UX Foundation (UX-1 Shell + Browse, UX-2 Learn Mode)

PLAN_VERSION: 001
RUN_ID: 2026-09-26-UX-01
BASE_HEAD: 032153e
STATUS: COMPLETE — Step 0 (`eec16ae`), UX-1 (`174d30b`, corrections `5861c31`, `4b0b728`) and UX-2 (`29f9087`) committed locally on `feature/run-ux-01-learner-ux` (not pushed). Mocked browser evidence only. See `docs/RUNS/2026-09-26-UX-01.md`.

## 1. Run Goal

Turn the existing learner app (Today / My Courses / Progress, inline Today answer flow) into a coherent, calm, Hebrew/RTL-first, mobile-first product by implementing the already-decided UX direction in `docs/UX_SPEC.md`. Two Slices only: UX-1 (Learner Shell + Browse) and UX-2 (Learn Mode).

No Learning Engine, API, schema or question-selection change. Presentation and client-side interaction only.

Naming: "Run UX-01" is a standalone learner-UX Run. It is NOT a Product Run in `docs/UNLOCK_ROADMAP.md`; Product Run 010/011/012 keep their roadmap meanings.

## 2. Authority and Scope

- `docs/UX_SPEC.md` is the UX authority. Do not redesign freely; do not invent UX during implementation.
- **Course/Topic Practice (UX-3) is OUT of Run UX-01.** It is DEFERRED, blocked by an explicit Early Practice + FSRS semantics decision (see §7 and `FUB-030`). No Practice route, API, session model or Practice-shaped CTA ships in this Run.
- A Topic page is out of scope; Topic information stays on Course/Progress.
- After UX-1 and UX-2 are complete and browser-verified, decide whether Practice becomes a later extension or a new Run.

## 3. Run-Start Contract

Branch `feature/run-ux-01-learner-ux` from `main`; `HEAD == BASE_HEAD` (`032153e`) or one deliberate docs-only commit above it (Step 0). Clean working tree. No push, no hosted mutation.

## 4. Repository Facts (mapping, 2026-09-26)

- `src/components/` is empty. Buttons, pills, cards, rows, signed-out/loading/error/empty blocks and the `ViewState` fetch pattern are copy-pasted across `src/app/(learner)/today/page.tsx` (501 lines), `courses/page.tsx`, `courses/[courseId]/page.tsx`, `progress/page.tsx`.
- Tailwind v4; raw `zinc-*` utilities inline; tokens only `--background`/`--foreground` in `src/app/globals.css`.
- `(learner)/layout.tsx` wraps ALL learner pages in `LearnerNav` (`learner-nav.tsx`, text-only bottom bar, `nav-items.ts`, three tabs). No shared page header. RTL/`he` fixed in `src/lib/locale.ts`; strings in `src/messages/he.ts`.
- Today: server selects questions (`GET /api/daily-plan/today`); answer/skip via `POST /api/daily-plan/items/[itemId]/{answer,skip}`. Option button and feedback live only inside `TodayAnswerCard`. The complete screen has no next step; 401 sign-in links lack `next=`.
- No Practice code or routes. No Topic page. "Early Practice" appears in no ADR.
- Tests: Vitest covers logic files only (no DOM). Playwright is configured (Desktop Chrome + Pixel 7) with no screenshots; only the real hosted Supabase project exists, so UX verification uses `page.route` mocks.

## 5. Slices

Follow `.claude/skills/implement-slice/SKILL.md`; verification per `.claude/rules/testing.md`; reviewers per `review-commit`.

### UX-1 — Learner Shell + Browse
- **Touch:** `(learner)/layout.tsx`, `learner-nav.tsx`, `nav-items.ts`, `globals.css`, courses / course / progress pages, Today landing / empty / complete states (not the question flow).
- **Primitives** only where proven shared by UX-1/UX-2; candidate set `Button` (primary/secondary/tertiary), `StatusPill`, `Card`/`Row`, `StateBlock` (loading/error/signed-out/empty), `PageHeader`. No fixed count; no framework, Tailwind plugin or component library. Final list confirmed at INSPECT.
- Semantic tokens in `globals.css` (no frozen hex).
- Nav polish (functional icons, clear active state), header, one dominant primary CTA per screen.
- Progress: state rows become actionable only through an EXISTING valid destination — no invented behavior.
- **Today landing:** answers "what should I do now?" with one primary CTA ("התחל ללמוד" / "המשך ללמוד").
- **Today Complete:** a real success state, not an empty state; small summary using ONLY data already in the current DTO/state (no invented metrics; smallest honest version if data is thin, richer summary documented as deferred). Primary CTA "המשך ללמוד" → `/courses` (temporary bridge, documented in `UX_SPEC.md` §9). Optional secondary/tertiary CTA "לצפייה בהתקדמות" → `/progress`. No "סיימתי להיום" navigation action.
- **Course cards:** communicate what the Course is, current learning state, what is worth doing next — existing data only.
- **No fake Practice:** no "תרגל" / "המשך ללמוד בקורס" control that leads nowhere. The Course page's primary action uses an existing valid destination (e.g. `/today`) or is omitted; the future Topic CTA is omitted.
- **Stop:** any need for an API/schema/Engine change; pressure to add Practice affordances.

### UX-2 — Learn Mode
- **Touch:** `today/page.tsx` (split out `TodayAnswerCard`); `QuestionOption` / `QuestionProgress` / `FeedbackBlock` only if Learn Mode genuinely needs them. Learn Mode hides the normal navigation: because `LearnerNav` currently applies to every learner route, this needs a layout change (route group or layout-level condition) — choose the smallest at INSPECT.
- Focus mode; constrained width; context title; subtle progress indicator; question state `default → selected → submitted → feedback`; correct/incorrect as learning feedback (incorrect is NOT red-error styling); inline feedback; one "המשך" CTA after answering; sticky mobile CTA where practical; exit behavior; loading/error/signed-out; session complete.
- Feedback content is limited to what the answer response provides (currently `isCorrect`); richer explanation is deferred, not invented.
- **Slice B findings folded in** (no wider auth-architecture work): `role="status"`/accessible feedback; focus management after Submit/Continue; `next=` on learner 401 sign-in links; explicit "answer not saved" recovery on 401; larger Skip/sign-out targets; `text-emerald-600` contrast fix.
- Question selection and server behavior unchanged.
- **Review:** UX-2 touches the answer flow — reviewer selection via `/review-commit`.
- **Stop:** any change to question selection, answer/skip API contract, or Learning Engine.

## 6. Guardrails

`UX_SPEC.md` is authority; no free redesign; no new UI framework/plugin/library; reuse first, extract only proven-shared patterns; no wholesale page rewrites; mobile-first; Hebrew/RTL-first; one dominant primary CTA per screen/state; Browse ≠ Learn; no gamification; no Learning Engine/API/schema change; no fake functionality. Missing optional presentation metrics are not `PLAN_CONFLICT`; `PLAN_CONFLICT` only for a real contradiction with approved scope/spec or repository constraints.

## 7. Deferred — UX-3 Course/Topic Practice (not in this Run)

Blocked by the Early Practice + FSRS semantics decision. After UX-1/UX-2, first determine whether it is an architectural invariant (→ ADR) or a narrower learning-policy decision (→ an existing canonical learning/design document); the required output is the semantics, not document ceremony. No ADR is created now. Later implementation would also need a route exposing manual-practice `submitAnswer` (auth first, `learningSessionId`). Tracked in `docs/FOLLOW_UP_BACKLOG.md` (`FUB-030`).

## 8. Verification

- Typecheck, lint, and existing unit tests for touched logic.
- Mocked Playwright (`page.route`) with screenshots: 375px mobile and desktop; RTL; keyboard; loading / error / signed-out / empty; Today complete; long Hebrew question / Course / Topic text; selected / correct / incorrect; focus after feedback; no horizontal overflow; exactly one visually dominant primary CTA per state; predictable exit/back behavior.
- Screenshots are test evidence per existing repo conventions; no committed screenshot artifacts unless repo/testing rules justify them.
- **The Run report must state that mocked-Playwright evidence does NOT prove real authenticated Supabase integration.**

## 9. Acceptance Criteria (Run-level)

- UX-1 and UX-2 behavior matches `docs/UX_SPEC.md`; temporary bridges are documented in `UX_SPEC.md` §9.
- No Learning Engine, API, schema, selection or migration change (proved by diff).
- Every §8 verification item exists and is green, with the honesty statement above.
- No non-working Practice affordance ships.
- `DEV_STATUS` reflects only durable truth; Run report written; nothing pushed.

## 10. Stop Conditions

Stop for Dor if: HEAD/working tree conflicts with the Run-start contract; a real `PLAN_CONFLICT` (§6); an API/schema/Engine change appears necessary; scope pulls in Practice, a Topic page, or a new UI framework; a hosted action is required.

## 11. Handoff

Close with the canonical protocol (`DEV_STATUS` → Run report → final Git state → stop). Do not start UX-3 or any Practice work automatically; report the decision point described in §7. Do not push.

---

## Carried-over context — Slice B Pilot Readiness Verification (verification only; NOT part of Run UX-01)

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

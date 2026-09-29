# Slice B — Pilot Readiness Verification (2026-09-26) — ARCHIVED

Status: HISTORICAL / RESTRICTED. Archived verbatim from `docs/CHATGPT_PLAN.md` by Run `2026-09-29-DEVOS-V1.3-CONSOLIDATION` (DEVOS-V1.3-B) so the Plan can stay current-execution-only. It was verification-only and NOT part of Run UX-02. Still-open human decisions/evidence gaps (Q2-B, Q3, Q4, Q5, Q6a) and the expired-session recovery UX gaps are pointed to from `docs/DEV_STATUS.md` (human/manual actions).

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

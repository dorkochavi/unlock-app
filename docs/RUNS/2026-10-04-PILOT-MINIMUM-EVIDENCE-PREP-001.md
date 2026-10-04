# UNLOCK — Run Report: 2026-10-04-PILOT-MINIMUM-EVIDENCE-PREP-001

Run: `2026-10-04-PILOT-MINIMUM-EVIDENCE-PREP-001`
Status: PARTIAL (all decision-independent engineering done; human decisions/checks remain)
Baseline (START_HEAD): `9f6abcf` (one local commit above remote feature `3d2000f`; remote `main` `be97aba`)
Code commit: `1a433eb`. Branch `feature/run-010-learning-intelligence`, local only, NOT pushed.
HOSTED_MUTATION: NONE. REMOTE_GIT_MUTATION: NONE. Dashboards / Production not accessed.

## 1. Goal
Reduce engineering uncertainty for PILOT_READINESS 13(a) (product-event evidence) and 13(b) (runtime/error visibility); prepare, not decide, OQ-039 and dashboard-dependent items.

## 2. Findings (hypotheses)
- H1 confirmed: all 26 routes already logged unexpected faults with constant route labels; Vercel records status per request. The gap was log *content*: raw error objects (a PostgreSQL CHECK-violation `detail` echoes the whole failing row incl. learner id and selected answer), and `INVALID_SELECTED_ANSWER` logged `JSON.stringify(<submitted answer>)` unbounded at error level on an expected 400.
- H2 confirmed: joins, plans, accepted answers, item resolution and repeat behavior derive from authoritative records; no event vocabulary invented. `today_opened` remains FUB-023/OQ-026.
- H3 confirmed: nothing built persists or exposes learner-level data.

## 3. Delivered
- `src/lib/ops-log.ts`: allow-listed bounded summary (name, SQLSTATE/system code, constraint/table/column, message only for application errors, ≤8 stack frames); never reads DB detail/where/hint/query/parameters/cause; never throws. 138 logging sites replaced (136 `logUnexpectedError`, 2 `logClientRejection`) (API handlers/routes, 5 UoW rollback paths). Answer-echoing logs replaced by constant `warn`. Learner id removed from two provisioning-fault logs.
- `scripts/pilot-evidence-aggregates.sql`: 5 read-only aggregate queries.
- `docs/PILOT_EVIDENCE_OPERATIONS.md`: class-window contract, flow→evidence map, field classification, dashboard checklist, OQ-039 packet.

## 4. Evidence
| Check | Result |
|---|---|
| `src/lib` + `src/app/api` unit tests (66 files, 495 tests; includes 11+ ops-log, 10 outcome-class/leak tests) | PASS (after security-review fixes) |
| PGlite `pilot-evidence-aggregates.test.ts` (3) | PASS (schema-level only; not hosted data) |
| `tsc --noEmit`, eslint on touched dirs | PASS, no warnings in scope |
| `git diff --check` | PASS |
| Security review (`unlock-security-reviewer`) | 0 HIGH; MED-1 (logger could throw in catch) FIXED+tested; MED-2 (system-error messages carry host/port) FIXED+tested; LOW-1 userId in 2 logs FIXED; LOW-2 questionVersionId (server content id) ACCEPTED+documented; residual: application-error messages logged bounded |
Not rerun: full unit, schema suite, build, e2e (no change to their surfaces beyond log calls; stated, not proven). Reviewer's not-checked: every codemod site individually — covered by typecheck + 495 tests.

## 5. Not done / human
See operations doc §5 (S1–S4, V1–V2, H1) and §6 (OQ-039 options A/B/C, no recommendation). 13(a)/13(b) NOT READY.

## 6. DevOS review (Measure → Interpret → Compare → Act)
- Files most needed: PILOT_READINESS, CHATGPT_PLAN, targeted greps of OPEN_QUESTIONS/FOLLOW_UP_BACKLOG/CAPABILITY_MAP (never read whole), 3 handlers. Context stayed narrow; no old Run reports read; no notable rereads.
- Friction: shell/heredoc escaping of U+2028 in a regex cost three rounds; an `npx prettier` probe tried to install a package (avoid; use repo tooling only).
- KEEP: grep-first grounding; mechanical codemod + typecheck/tests as net; reviewer after tests. WATCH: unicode/escape-heavy edits via the Write tool; keep such regexes built from escapes. CHANGE: none (one-off observations not promoted).

## 7. Review-fix addendum (post-commit adversarial review)
Original PARTIAL close above is unchanged. Adversarial integration review of `9f6abcf..3050bbc` (unlock-reviewer + unlock-security-reviewer) verdict: **KEEP_WITH_FIXES**, 0 HIGH.
Fixes (this addendum's commit): (1) `frames()` bypass closed — frames only from the frame-shaped contiguous tail after the header, header cut out by locating the message; regression tests. (2) Two raw `console.error` sites converted to constant-text `logUnexpectedError`. (3) 28 unhandled-outcome branches now log the fixed-vocabulary `kind`/`outcome` via `logUnhandledOutcome` (UNRECOGNIZED otherwise); focused handler test. (4) Learner ids removed from `submit-answer.ts` thrown messages; narrow non-learner id exception documented; no zero-identifier claim. (5) Site count corrected to 138; "all 5xx sanitized" wording tightened. (6) Seeded PGlite proof for all 5 aggregate queries (current-members join semantics, UTC bucketing, plan/practice split, completed/skipped/pending, 3-day vs 2-day vs out-of-window repeat, skips not counted); SQL comments state UTC-by-design and now()-anchoring.
Verification: see section 4 table plus full unit suite, four UoW DB tests and pilot-evidence PGlite suite (results in the fix commit message / final report); security re-review of the fix delta recorded below.
Status unchanged: 13(a) and 13(b) remain NARROWED, not READY (human acceptance: derivation-only 13(a); log watcher + cadence + Vercel retention for 13(b)); OQ-039 unresolved; no push.
Evidence for the addendum: full unit suite 169 files passed / 1 skipped, 1982 tests passed / 4 skipped; UoW DB tests (daily-plan, course, import, question UoW + practice) and pilot-evidence PGlite suite (8 tests) pass; `tsc --noEmit`, eslint (src, pilot-evidence test), `git diff --check`, `verify-run-close` pass. Running the UoW DB tests caught a real defect in the first fix pass: the `supabase` vitest config has no `@/` alias, so infrastructure files must import `ops-log` relatively (fixed; the unit suite alone would not have caught it). Full unit suite was run before that import-path-only change; typecheck and the DB suites ran after it.
Security re-review of the fix delta (`3050bbc` to worktree): no HIGH/MED. frames() bypass closed. Two LOW accepted: (1) a synthetic/mutated stack with no real frames and frame-shaped text could be logged (needs a stack/message mismatch; not request-driven); (2) frame locations are `[^\s()]+` so a frame-shaped token without whitespace could carry text (not realistic: frames are code paths). `logUnhandledOutcome` values are application-code discriminants, fixed UPPER_SNAKE vocabulary. Not run: full schema suite, build, E2E (no new schema/UI/build-surface change).

# Run Report — 2026-10-09-BROWSER-ISOLATION-STUDY-001

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted/Supabase mutation, migration, schema or dependency change; no AI API or Google contact). Docs only; nothing was executed (no dev server, browser, network or Docker).
START_HEAD `4b28bb9`; Plan-open commit `ddf5b43`; LAST_VERIFIED_HEAD `f512a4e`. Local commits unpushed and not deployed; `origin/main` is not Production. Scratch (git-ignored): `scratch/telemetry/**`.

## Goal
Find the smallest safe architecture for rendered Design Audit evidence without hosted Supabase/Postgres/Production/external contact. Read-only and design-first; prototype only if every gate is met.

## Slices and commits
| Slice | Commit | Content |
|---|---|---|
| Plan | `ddf5b43` | Plan identity open |
| C1 | `08ad499` | `docs/BROWSER_ISOLATION_DESIGN.md` (escape-path map, Q3 technique analysis, options matrix, recommendation, rendered-audit plan, prototype decision) + CONTEXT_MAP COLD row |
| C2 | (decision) | DESIGN ONLY: the prototype gate is not met |
| Review corrections + routing | `f512a4e` | 5 security-review corrections applied; FUB-070/071/072 |
| Z | (Run close) | Close docs |

## Findings (evidence class: source-read; nothing executed)
- Design Audit 001 Pass 0 FAIL was **partially right**: the Playwright harness is unsafe (`npm run dev`, ambient `.env.local`, `reuseExistingServer`; public `GET /api/courses/:id` reaches `getPool()` without auth, so `join-errors.spec` ran against the hosted DB, read-only), but it was too conservative about the mocked-browser technique: all audited pages are client-rendered, and with `/api/**` fulfilled in the browser no route handler, `getUser` or `getPool` runs.
- The Q3 technique isolated browser-originated traffic and route handlers. It did NOT isolate the Next server (inherited `.env.local`, a pre-existing server in `names.mjs`, no request log, no server-side deny). The supportable Q3 claim is "mocked-browser, fixture API", not "zero server-side hosted contact".
- Server-side escapes: `next/font/google` (Heebo), Next dev registry check (`registry.npmjs.org`, not covered by `NEXT_TELEMETRY_DISABLED`), SWC download (VERIFY), lazy hosted `getPool()`, a reused dev server's cached pool, `@next/env` filling any unset key from `.env.local`. No proxy, middleware, instrumentation, analytics or email egress found.
- Options: local Supabase (needs Docker, absent), dedicated test project (still hosted, human-gated), route-only mocking (cheap, low fidelity), composition-root fakes (~26 routes build repositories inline, high maintenance, touches the auth boundary), PGlite browser harness (needs a new dependency or adapter), hardened Q3 technique. **Recommended: Option E+**: own Next server on a free loopback port, every `.env.local` key name overridden with a dead value, a `--require` network guard with startup canary, browser-side route abort plus fixture `/api/**`, and a request log with end-of-run assertions. No dependency, no product change.
- Honest limit: only an OS-level egress deny can prove absence of hosted contact from native/OS paths; the JS guard is the only preventive layer, the browser and assertion layers are detective.

## Prototype decision
DESIGN ONLY. Technically feasible (three small scratch scripts) but the gate is unmet: isolation is unproven until executed, the reviewer agreed to the design not a run, and the human has not approved a first run.

## Review
Independent security review (`unlock-security-reviewer`): ACCEPT_WITH_CORRECTIONS; 0 BLOCKER; 4 CORRECTIONS applied (env scrub does not stop `.env.local` loading; guard scope plus canary; "layers independent" overclaim; no-reuse must be enforced) plus First-run gates (OS egress deny, preflight host check, `/login`-only dry run, post-run pool/guard-log assertions, cookie-less context, reviewer + human approval).

## Verification (evidence class: structural / diff review)
`git diff 4b28bb9 --stat` lists docs only (no `src/`, tests, config, package or schema change). `git diff --check` clean. No tests, build, typecheck or browser run: no executable change (freshness basis `.claude/rules/testing.md` §2/§3 documentation-only).

## Routed
FUB-070 (build harness after first-run gates), FUB-071 (make Playwright webServer safe by default / decide `join-errors.spec`), FUB-072 (rendered Design Audit Pass 1, blocked on FUB-070).

## Mechanism evidence
3 fresh workers (study, security reviewer, docs) sequential; parent did no study or code work. The security reviewer caught a materially wrong claim in the study (env scrub), which a general or no review would likely have missed.

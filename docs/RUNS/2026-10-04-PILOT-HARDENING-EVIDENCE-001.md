# UNLOCK — Run Report: 2026-10-04-PILOT-HARDENING-EVIDENCE-001

Run: `2026-10-04-PILOT-HARDENING-EVIDENCE-001`
Status: COMPLETE
Result: PASS (local evidence only; real pilot NOT approved)
Baseline (START_HEAD): `be97aba` (= remote feature = remote `main`; `v0.2.0` -> `fff8c40`)
Branch: `feature/run-010-learning-intelligence` (local commits only, not pushed; push is a human action)
HOSTED_MUTATION: NONE. REMOTE_GIT_MUTATION: NONE.

## 1. Goal
Increase pilot confidence with local, read-only, reversible work: restore drill (FUB-009), real-PostgreSQL evidence for
`revokeCourseAuthor` (FUB-042 item 7), Auth redirect audit, pilot-readiness matrix. Not a product Run; not Run 011. No `src/`
product change.

## 2. Slices
| Slice | Commits | Result |
|---|---|---|
| A | `ae43c07` | Run identity + grounding. |
| B | `b818a90` | Restore drill: public schema + data + migration history restored into a disposable local Docker PostgreSQL 17.6 (supabase image); row counts match, FK/author checks pass, hosted-isolation proof, resources destroyed. Auth restore PARTIAL (auth DDL not in the dump; `handle_new_auth_user` trigger must be recreated). |
| C | `1c534df`, `8409881` | Opt-in real-PG two-connection test (`npm run test:real-pg`, `UNLOCK_REAL_PG_URL`, localhost only), 14/14. N1 last-author invariant PROVEN; N2 no corruption; N3 stale-actor window observed (A authorized, B revokes A, A still completes; invariant holds). `src` unchanged. |
| D | `0c12526`, `b8568cb` | Auth redirect audit: no app-side open-redirect gap (allowlist-only `next`, fixed-shape `emailRedirectTo`, no server callback/Host use); extra negative tests. |
| E | `336d3d3` | Pilot-readiness matrix, 45 rows: PROVEN_READY 7, HUMAN_CHECK 14, EXTERNAL/HOSTED_CHECK 5, OPEN_DECISION 8, ENGINEERING_GAP 1 (auth-aware restore runbook), DEFERRED_NON_BLOCKER 10. |
| F | `3dda311` | Independent review (`unlock-reviewer`) found a hostname-guard bypass (`?host=` query override) in the real-pg test; fixed (`assertLocalPgUrl`, explicit config pieces, default-run guard test) and weak redirect tests strengthened; re-review: no findings. |
| G | this commit | Run-close docs. |

Slice evidence: `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-{B-restore-drill,C-revoke-concurrency,D-auth-redirect,E-pilot-readiness-matrix}.md`.

## 3. Evidence (provenance; at `3dda311`)
| Evidence | Result | Provenance |
|---|---|---|
| `tsc` | clean | automated, local (worker-reported) |
| eslint | clean | automated, local |
| full `npm test` | 164 files / 1747 pass | automated, local |
| `npm run test:real-pg` | 14 passed against a local `postgres:17` container; 14 skipped when env unset | automated, local real PostgreSQL (not hosted) |
| Restore drill | counts / FK / author checks PASS | local disposable PG 17.6, from existing backup |
| Schema/PGlite | not rerun | reuse basis: no migration/SQL/repository change |
| Build | not rerun | reuse basis: no app code/config change |
| Independent review | no findings after fix | `unlock-reviewer`, re-review |

Limits: local PostgreSQL does not prove hosted Supabase behavior, managed Auth, or production network behavior.

## 4. Backlog / decision outcomes
- FUB-009 NARROWED, not closed. Remaining: human-owned ownership/frequency/RPO/RTO, Supabase plan + PITR check,
  retention/encryption; optional auth-aware restore runbook (engineering gap).
- FUB-042 item 7: 7(c) CLOSED; 7(a) cosmetic, no defect, kept deferred (tie to OQ-043 C); 7(b) HUMAN DECISION (may a
  mid-flight-revoked author complete a revoke?) before `revokeCourseAuthor` is wired to a route. Kept in FUB-042 rather than a
  new OQ: nothing ships until it is wired and it shares the OQ-047 gate.
- Auth redirect: remaining human check of Supabase dashboard URL Configuration (Site URL; Redirect URLs accept
  `/login?next=...`; no broad wildcards); fails safe. Non-security UX note: `/instructor/courses/new` is not allowlisted for
  `next` and falls back to `/today`.

## 5. Human decisions / actions outstanding
FUB-042 7(b); OQ-047; Supabase dashboard Auth URL check; backup ownership/RPO/RTO/plan/PITR/retention (FUB-009); the matrix's
HUMAN_CHECK / OPEN_DECISION rows; Content gate unchanged (`docs/PILOT_READINESS.md`). Pushing is human.

## 6. Rollback note
Local commits only (`be97aba..HEAD`): `git revert` them (or reset the unpushed branch by human choice). No hosted, Production,
Vercel, Auth, tag or remote change was made, so nothing hosted needs reverting. Restore-drill containers were destroyed.

## 7. DEVOS
Mechanism: thin parent + fresh sequential workers; 7 subagents dispatched.
TELEMETRY (one compact summary read): 1 session, 0 compactions, highest ending context 12%. 0 main-context file reads / 21
subagent reads; re-read rate 19% (4 re-reads, all of the real-pg test and safe-redirect files by successive fresh workers:
expected from sequential isolated review/fix, no DevOS change implied). Hand-back avg ~37 chars (29 of 36 completions
measured). 5 tool failures (Docker Desktop daemon went down once mid-Run; relaunched; no result affected); Docker restarts 1.
STOP events 0 (one HUMAN_DECISION item, FUB-042 7(b), recorded; no path blocked).
WATCH: per-slice attribution showed only A/B because the parent appended CURRENT_SLICE lines in
`scratch/development_checkpoint.md` instead of rewriting a single current line (`autonomous-run` §13); fix = keep one
CURRENT_SLICE line. Mechanism overall: KEEP (provisional).

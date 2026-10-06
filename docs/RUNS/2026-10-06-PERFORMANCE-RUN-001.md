# Run Report — 2026-10-06-PERFORMANCE-RUN-001

Status: `COMPLETE` (local only; no push, deploy, or hosted mutation)

Baseline: `e261f65` (Plan-only commit `cc56f14`)

## 1. Goal
Instrument -> reduce round trips -> remove blocking UX, without weakening learning-evidence integrity. Owner: FUB-026.

## 2. Slices
| Slice | Result | Commit |
|---|---|---|
| A Instrumentation | `Server-Timing` + pool statement timing on 8 routes; PGlite statement-counter test helper | `c247288` |
| B Today repeat open | 8 stmts/5 calls -> 3 plain reads on existing plan; generation unchanged | `82a9069` |
| C Answer paths | AUDIT ONLY. Today 14 (replay 8), Practice 17 (replay 12); no exact duplicate; proposals A/B/C deferred | none |
| D Progress | STOP: loader already parallel; N+1 inherent without new aggregate endpoint | none |
| E Practice continuity | background next-batch fetch only after last answer ACCEPTED; inline pending/error | `370d62b` |
| F Client refreshes | STOP: `router.refresh()` x4 probably redundant, unproven | none |

## 3. Evidence / limits
Counts are PGlite statement counts (not latency, not pool queueing). Local tests prove structure only. Post-region
(Vercel Frankfurt, human-reported change 2026-10-06, not deployed) latency is NOT measured. Details: FUB-026 addendum.

## 4. Review
Slices A, B, E: unlock-reviewer on actual diffs, no BLOCKER/CORRECTION; one NOTE fixed (E: moreStatus reset). DB/security
reviewers not warranted (no SQL/transaction/auth change).

## 5. Human actions
Review; push; deploy (picks up Frankfurt region + these changes); verify Function region; smoke; measure via `Server-Timing`;
approve or amend proposed budgets (FUB-026).

---

## Production Evidence Addendum (2026-10-06, after Run close)

Everything below is **HUMAN-REPORTED by Dor** (manual browser observation of `Server-Timing` response headers); not automated E2E, not load-tested. Sections 1-5 above remain as known at Run close.

### Deployment / region
- Production deployment at `155dff7` is Ready; the Vercel Function Region change is active (`x-vercel-id` on measured requests begins `fra1`). Supabase is `eu-central-1` / Frankfurt, so Functions and database are region-aligned. (Before: Functions `iad1`, a real mismatch.)
- Performance Run 001 code is deployed together with the region change.

### Human smoke (Production)
Login PASS; Today PASS; Answer PASS; Skip PASS; Practice PASS; Practice next-batch transition PASS (Dor: "working extremely well"). Author -> "learn this course" was smoke-tested earlier in the release cycle.

### Practice answer — 5 single-user samples
| # | total ms | db ms | dbwait ms | dbn |
|---|---|---|---|---|
| 1 | 151.0 | 42.6 | 24.4 | 17 |
| 2 | 142.6 | 33.2 | 0.3 | 17 |
| 3 | 126.1 | 38.6 | 17.9 | 17 |
| 4 | 106.4 | 34.9 | 0.3 | 17 |
| 5 | 107.6 | 38.3 | 0.2 | 17 |

Mean total ~127 ms. `dbn=17` matches the local audit (Practice answer 17 statements).

### Today repeat — 5 samples
| # | total ms | auth ms | uc ms | content ms | dbn | dbwait ms |
|---|---|---|---|---|---|---|
| A | 228.0 | 183.0 | 39.5 | 4.5 | 4 | 25.6 |
| B | 401.2 | 348.3 | 44.0 | 8.0 | 4 | 27.0 |
| C | 107.6 | 88.7 | 13.9 | 4.0 | 4 | 0.1 |
| D | 106.3 | 73.2 | 28.2 | 3.9 | 4 | 18.6 |
| E | 89.6 | 52.3 | 30.1 | 4.6 | 4 | 0.4 |

Dor believes B (~401) and D (~106) were refreshes and C (~108) and E (~90) were navigations (approximate, human-reported attribution).

### Interpretation
- Single-user Practice Answer is consistently fast (~106-151 ms server-side) in this small sample. This is NOT comparable to the historical 30-learner burst baseline (Answer p95 ~3.18 s, Today p95 ~4.85 s at pool=5); do not read it as "3.18 s became 127 ms".
- Today repeat is usually ~90-228 ms server-side with one ~401 ms auth-heavy outlier. `dbn=4` is identical in all samples, structurally consistent with the Slice B fast path being active in Production (local audit: 3 plain plan-path reads + 1 post-plan content read; the 4 = 3 + 1 decomposition is inferred, not separately observed).
- Region alignment, the Today fast path and Practice continuity were deployed together; their individual contributions cannot be separated and no causality split is claimed.
- Proposed budgets in FUB-026 remain **PROPOSED — HUMAN APPROVAL REQUIRED**. Current single-user evidence is directionally compatible with an instant-feeling experience for the measured flows; it does not approve them.

### WATCH
- Today repeat `auth` variability (52-348 ms; one outlier ~401 ms total). WATCH only, not a proven systemic bottleneck; tracked under FUB-026, no new task.
- Multi-user load behavior after region alignment is unmeasured (burst baseline unchanged).

### Operational lesson
When collecting browser timing evidence, capture Response Headers only; do not expose Request Headers (cookies/tokens). Session was rotated by sign-out/sign-in after a screenshot exposed cookie data. No credential material is stored in the repo.

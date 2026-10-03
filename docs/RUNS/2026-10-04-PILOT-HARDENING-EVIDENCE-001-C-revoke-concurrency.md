# PILOT-HARDENING-EVIDENCE-001 Slice C - `revokeCourseAuthor` real-PostgreSQL concurrency evidence (FUB-042 item 7)

RUN_ID 2026-10-04-PILOT-HARDENING-EVIDENCE-001, SLICE C, START_HEAD `b818a90`. Product code (`src/`) unchanged.

## Provenance

- **Environment:** disposable local container `unlock-pg-conc-1`, image `public.ecr.aws/supabase/postgres:17.6.1.166`
  (PostgreSQL 17.6, x86_64), bound `127.0.0.1:54339`, throwaway database created/dropped by the test; all repo migrations applied
  in order over a minimal `auth.users` stub. Container destroyed at slice end. No hosted contact, no `.env.local`.
- **What ran:** the REAL `revokeCourseAuthor` use case, REAL `PostgresCourseUnitOfWork` + `PostgresCourseAuthorRepository`, REAL
  `pg` driver, up to three separate one-connection pools (separate backends). Interleavings were forced by a statement-level
  hook decorator around the connection (pause after actor-auth read / after the FOR UPDATE lock); blocking was proven via
  `pg_stat_activity` (`wait_event_type = 'Lock'`). Randomised-jitter loops complement the forced cases.
- **Durable form:** `supabase/tests/real-pg/revoke-course-author.real-pg.test.ts`, opt-in `npm run test:real-pg` with
  `UNLOCK_REAL_PG_URL` (host guard hardened in the 6/n fix: strict URL parse, any query string/fragment/multi-host/non-postgres protocol refused, PGHOSTADDR/PGSERVICE/PGSERVICEFILE fail closed, pg config built from parsed pieces not the raw string; guard unit-tested in the default run by `src/infrastructure/postgres/real-pg-url-guard.test.ts`; skipped when unset; excluded from `npm test` and `npm run test:schema`).
- **Negative control:** a naive count-then-revoke (no `FOR UPDATE`) under the same forced interleaving DOES leave zero active
  authors, so the harness can detect the N1 defect.
- **Limits:** one local server; says nothing about hosted Supabase/Supavisor. Not wired to any route.

## Results

14 tests, 14 passed, 4 consecutive runs (one earlier run was lost to a Docker Desktop crash, not a test result).

| Scenario | Interleaving | Observed |
|---|---|---|
| N1 control | naive code, both read count=2 then both revoke | zero active authors (defect reproducible) |
| N1 forced | A holds FOR UPDATE uncommitted; B (real 2nd backend) | B observed blocked on Lock; after A commit B = `LAST_AUTHOR`; 1 active |
| N1 jitter x60 | 2 authors revoke each other | 60/60 `LAST_AUTHOR+REVOKED`; 1 active every time |
| N1 jitter x40 | 2 authors self-revoke | never zero |
| N1 jitter x40 | 3 authors, 3 connections, ring A->B->C->A | active >= 1 every time |
| N1 jitter x30 | two Courses, shared connections | per-Course counts independent (no cross-Course interference) |
| N2 sequential | re-revoke already revoked | `NOT_A_GRANT_HOLDER`; count and `revoked_at` unchanged |
| N2 forced | two actors revoke same target (3 authors); loser blocked on lock | `REVOKED` + `NOT_A_GRANT_HOLDER`; exactly 2 remain |
| N2 jitter x50 | same, randomised | always `[NOT_A_GRANT_HOLDER, REVOKED]`, 2 remain |
| N2 jitter x40 | revoke already-revoked target racing revoke of another | never zero |
| N3 forced (3 authors) | A paused after auth; B revokes A (commit); A resumes revoking C | A (now revoked) still `REVOKED` C; 1 active (B) |
| N3 forced (3 authors) | A paused after auth; B revokes A; A resumes revoking B | both `REVOKED`; only C remains |
| N3 forced (2 authors) | same, A targets B | A = `LAST_AUTHOR`; invariant protects |
| N3 no window | actor revoked BEFORE start | `NOT_AUTHORIZED` |

## Findings and classification

- **N1 / FUB-042 item 7(c): PROVEN on real PostgreSQL.** `FOR UPDATE` + READ COMMITTED re-check serializes revokes on one Course;
  the last-author invariant (>= 1 active author) never broke. 7(c) can close.
- **N2: no defect.** Already-revoked grants are invisible to the locked active list, so no overwrite/double count occurs via the use case.
- **N3 / item 7(b) actor-auth-before-lock: REAL but INVARIANT-SAFE stale-snapshot window, observed.** A revoked actor can complete one
  in-flight revoke. The last-author invariant still holds. Classification: provable behavior, not data corruption. It is NOT
  resolved by canonical semantics: `ports.ts` documents the equivalent "demoted actor could still complete one in-flight write" as an
  accepted race for the module (revokeCourseMembership/setCourseJoinPolicy), but no ADR/doc decides it for `course_authors`
  (ADR-015 only requires a non-revoked grant; strictly-serial semantics would say `NOT_AUTHORIZED`). Whether a mid-flight revoked author
  may complete is a product/authorization semantics choice -> **HUMAN_DECISION_REQUIRED**; code left unchanged. If decided "strict", the
  fix is small (derive actor authorization from the locked rows) and the two N3 "OBSERVED" tests flip to `NOT_AUTHORIZED`.
- **(a) missing `and revoked_at is null` in `revoke()` SQL: cosmetic / defense in depth.** Unreachable via the use case (target comes
  from the locked active list; N2 proves it). Not changed: the port contract (`ports.ts`) deliberately documents `revoke()` as an
  unconditional UPDATE mirroring `CourseMembershipRepository.revoke`, and repeated-revoke timestamp semantics are an open decision
  (OQ-043 C). Adding the guard would alter a documented contract -> leave deferred; no behavior defect.

## Recommended FUB-042 item 7 status

- 7(c): **close** (real-PG evidence, this report; test is the durable proof, run via `npm run test:real-pg`).
- 7(a): **keep, narrowed** to "optional hardening; decide together with OQ-043 C repeated-revoke semantics". No defect.
- 7(b): **keep, narrowed** to "needs a human decision (may a mid-flight revoked author complete?); invariant-safe either way". Reconsider
  before wiring `revokeCourseAuthor` to a route (item 7 promotion trigger unchanged).

## Verification

Real-PG suite 14/14 x4 (fresh); typecheck and eslint clean; `supabase/tests/postgres/revoke-course-author.test.ts` 5/5 and
`src/application/course` 100/100 (src unchanged, reuse basis); default `npm test` / `test:schema` exclude the new suite.

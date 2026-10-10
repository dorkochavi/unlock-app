# Run 2026-10-10-PILOT-CLEAN-SLATE-RESET-001 — Clean Slate reset: audit + dry-run

Status: COMPLETE (preparation only)
RUN_ID: 2026-10-10-PILOT-CLEAN-SLATE-RESET-001
START_HEAD: `0f18123`. NO HOSTED MUTATION. NO PUSH. Nothing was deleted.

## Outcome
- Schema audit from migrations: 12 public tables + Auth. Instructor authority is per-Course (`course_authors`); no global Admin role; `public.users` has no FK to `auth.users`; all FKs RESTRICT; `questions`↔`question_versions` cycle; no import/audit tables; no app Storage usage.
- Deliverables: `scripts/pilot-clean-slate-inventory.sql` (SELECT-only, human-run), `docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md` (preserved-account procedure, backup gate, SQL / Auth / Storage boundaries, Decision Packet).
- Verdict: reset **BLOCKED_PENDING_BACKUP** (last Production backup 2026-10-04; no `pre-destructive` backup). Hosted counts not taken (agents hold no hosted credentials): human commands in the runbook §5.

## Evidence (class: PGlite only, NOT hosted)
`supabase/tests/postgres/pilot-clean-slate-inventory.test.ts` 9/9: inventory is read-only and commits no id; covers every public table; reset SQL on a fully seeded schema deletes FK-safely, keeps only the preserved `users` row, is re-runnable, and aborts without change for an absent preserved id, an unreplaced placeholder, and an unknown public table. `auth_*`/`storage` queries and `lock_timeout`/multi-connection behaviour are unexercised.

## Review
DB reviewer: no blocker. Corrections applied: preserved id must also exist in `auth.users` (`preserved_auth_identity`; §6B gated), in-transaction schema-drift guard (+test), mandatory FULL restore drill and write-freeze ordering, A→B window note.

## Remaining boundaries
Auth deletion is irreversible; hosted restore unproven; Free plan (no PITR). Execution needs `HUMAN_APPROVAL_REQUIRED: PILOT CLEAN SLATE RESET`.

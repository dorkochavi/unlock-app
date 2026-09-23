# Classroom burst sanity (Pre-Pilot S3)

Two harnesses. Neither is production load-testing infrastructure, and neither
claims production capacity.

## 1. Local synthetic — real Postgres, real application layer (no HTTP)

Runs join → first Today (×2 concurrent) → first answer (×2 concurrent, same
`submissionId`) for N learners through the real use cases and production
composition roots over real `pg.Pool` connections. Uses a throwaway database
created and dropped by the test. **Local only — never point this at a hosted
project.**

```bash
# 1) a disposable local Postgres (the Supabase Postgres image, no Supavisor)
docker run -d --name unlock-burst-pg -p 54329:5432 -e POSTGRES_PASSWORD=burstpw \
  public.ecr.aws/supabase/postgres:17.6.1.166

# 2) run (30 and 40 learners)
BURST_DATABASE_URL=postgres://postgres:burstpw@127.0.0.1:54329/postgres BURST_LEARNERS=30 npm run test:burst
BURST_DATABASE_URL=postgres://postgres:burstpw@127.0.0.1:54329/postgres BURST_LEARNERS=40 npm run test:burst

# 3) clean up
docker rm -f unlock-burst-pg
```

JSON reports land in `scratch/burst/` (git-ignored, disposable).

## 2. HTTP burst against a running app + real Supabase Auth (Dor-owned)

`burst-hosted.mjs` drives the real routes (`/api/user/timezone`, join,
`/api/daily-plan/today`, answer) with real Supabase sessions. It **creates
hosted rows** (memberships, DailyPlans, Attempts), so it is a Dor-owned action.
It has not been executed against hosted from this repository; smoke-test with
`BURST_LEARNERS=2` first.

Safety:
- use a **dedicated throwaway Course** (OPEN + PUBLISHED, with at least ~10
  published Questions) — not the pilot Course; leave it, or archive it. There is
  no delete tooling; deleting learner history is a deliberate manual decision;
- test accounts use a recognisable pattern (`burst{n}@…`);
- secrets come only from environment variables and are never printed;
  `SUPABASE_SERVICE_ROLE_KEY` is needed only by the provisioning script and must
  never be committed.

```bash
export NEXT_PUBLIC_SUPABASE_URL=...            # from your .env.local
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # from your .env.local
export BURST_EMAIL_PATTERN='burst{n}@example.test'
export BURST_PASSWORD='<a throwaway password>'
export BURST_LEARNERS=2                        # smoke first, then 30 / 40

# A) create the confirmed test accounts (uses the service-role key; hosted mutation)
export SUPABASE_SERVICE_ROLE_KEY=...           # only for this command
node scripts/burst/provision-burst-users.mjs --yes-mutate-hosted
unset SUPABASE_SERVICE_ROLE_KEY

# B) run the app against the target project, then the burst
npm run build && npm start                     # or point BURST_BASE_URL at a deployed URL
export BURST_BASE_URL=http://localhost:3000
export BURST_COURSE_ID=<throwaway course uuid>
node scripts/burst/burst-hosted.mjs
```

The report separates the paced **sign-in phase** (`auth` — Supabase Auth
provider friction, rate limits) from the **burst** (`timezone`, `join`,
`today`, `answer`), classifies failures (`AUTH_PROVIDER`, `APPLICATION_5XX`,
`DB_OR_POOLER`, `TIMEOUT`, `TRANSPORT`, `UNEXPECTED_4XX`), and gives
min/p50/p95/max latency per step.

The answer step sends ONE logical submission (same `submissionId`) twice
concurrently. It passes on `200 + 200`, or `200 + 409` where the 409 code is
`ITEM_ALREADY_RESOLVED` or `SUBMISSION_ID_REUSED`; anything else fails (`409 + 409`,
another 4xx, any 5xx, a timeout, or an unexpected body). The report's
`duplicateAnswerOutcomes` tallies which case occurred, and failures record the
application error code. See `docs/FOLLOW_UP_BACKLOG.md` FUB-025.

Running the app **locally** against hosted Supabase measures your machine ↔
Supabase latency (and the local TLS/CA setup), not Vercel. Running against the
deployed Vercel URL is the closer proxy for classroom conditions.

## What each layer can and cannot prove

| Question | Local synthetic (1) | HTTP harness (2) | Real phones (S4) |
| --- | --- | --- | --- |
| One plan / one Attempt per learner under concurrent opens and duplicate submits | yes | yes (via HTTP outcomes) | — |
| Concurrent real Postgres connections, no serialization/unique failures | yes (direct connection) | yes (through the pooler) | — |
| Supavisor transaction-pooler limits, upstream pool size, hosted latency | no | **yes** | — |
| Supabase Auth rate limits / email confirmation throughput | no | partly (sign-in only; accounts are pre-confirmed) | **yes** |
| Vercel cold starts / function concurrency | no | only if run against the deployed URL | — |
| QR/link flow, mobile UX, RTL, Wi-Fi/cellular, real signup friction | no | no | **yes** |

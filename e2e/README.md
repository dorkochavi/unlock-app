# Browser Golden-Path E2E V1 (Run 004 Slice 7)

## What exists

- [Playwright](https://playwright.dev) (`@playwright/test`) as the browser E2E
  harness — no browser test framework existed in this repo before this Slice.
- `playwright.config.ts` (repo root): starts/reuses `npm run dev`, runs against
  `E2E_BASE_URL` (default `http://localhost:3000`), on desktop + a mobile
  viewport project.
- `e2e/join-errors.spec.ts`: fixture-free coverage of the malformed/nonexistent
  join-link error path (Slice 5's fixed 404 behavior). Needs no test account
  or seeded Course — a malformed id and a random well-formed UUID never
  correspond to a real row.
- `e2e/golden-path.spec.ts`: login → join an OPEN course → Today → answer →
  feedback → continue → reload-safe state. **Skips itself** unless
  `E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD`, and `E2E_OPEN_COURSE_ID` are all
  set (see `e2e/env.ts`).

## The exact constraint this harness was built under

This development environment has **no local Supabase/Docker stack** — there is
no `docker` binary available, and this repo's `.env.local` is configured
directly against the real **hosted Ruppin pilot Supabase project**
(`supabase/.temp/linked-project.json` confirms a real linked project; no local
Supabase instance exists as an alternative).

Per `CLAUDE.md` / `docs/CHATGPT_PLAN.md`, this Slice must not autonomously:

- create a hosted Supabase Auth user,
- create a hosted Course or CourseMembership, or
- otherwise mutate the hosted project,

in order to manufacture golden-path fixture data. That is exactly what a full
automated golden-path run would otherwise require (a real logged-in learner,
a real OPEN course with real content).

**Consequence:** this Run installed and wired a real Playwright harness with a
real golden-path spec, but did **not** execute `golden-path.spec.ts` in this
session — that spec cannot complete anyway without fixture data (a real
logged-in learner, a real OPEN course) only a human can safely decide to
create. This is a documented Plan-level blocker, not a silently skipped
requirement (`docs/CHATGPT_PLAN.md` S7: "Do not silently skip the
requirement").

The fixture-free `join-errors.spec.ts` has the same environment dependency
(it still needs the app running against *some* configured Supabase/Postgres
to answer the public course lookup) but performs only read-only,
unauthenticated requests against ids that cannot correspond to real data, so
it was actually installed (`npx playwright install chromium`) and run in this
Run, against a real `next dev` server using this repo's own `.env.local`
(the real hosted Ruppin project) — **2/2 passed**, verifying the Slice 5
malformed/nonexistent-course-id fix at the real browser level, with no
hosted mutation performed.

## Running it yourself

```bash
npx playwright install chromium   # already done in this Run's environment

# Fixture-free error-path coverage — safe against any configured environment,
# already run once in this Run (2/2 passed):
npm run test:e2e -- join-errors.spec.ts

# Full golden path — only after you decide how to provide real fixtures,
# e.g. a dedicated non-production Supabase project, or a manually created
# hosted test learner + OPEN course you are comfortable using for this:
E2E_LEARNER_EMAIL=... E2E_LEARNER_PASSWORD=... E2E_OPEN_COURSE_ID=... \
  npm run test:e2e -- golden-path.spec.ts
```

## Narrower equivalent already in place

The golden path this suite would exercise is already covered, end to end,
at lower test layers — unit, application, and PGlite integration — per
`docs/DEV_STATUS.md`'s Verification State. This E2E suite is additional
browser-level confidence on top of that, not the only proof the flow works.

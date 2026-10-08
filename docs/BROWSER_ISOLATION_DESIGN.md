# UNLOCK — Browser Isolation Design (rendered audits with zero hosted contact)

Status: DRAFT design (Run 2026-10-09-BROWSER-ISOLATION-STUDY-001, Slice C1).
Evidence class: **source-read only — no execution was performed** (no server, browser, network or test run). Every claim below is a reading of repository source at HEAD ddf5b43, not an observed behavior. Items marked VERIFY need a run before being relied on.

## 1. Verdict summary

- Every audited page (`/today`, `/progress`, `/courses`, `/courses/[id]`, practice, `/login`, `/join/[id]`, all `/instructor/**`) is a `"use client"` page that talks to the server only through `fetch("/api/**")` in effects. The learner layout is a server component but makes no auth/DB call. There is **no `src/proxy.ts` / `src/middleware.ts`**. So SSR of these pages performs no DB or Supabase call.
- Hosted DB is reachable only from `src/app/api/**` route handlers (`getPool()` is lazy, called after auth). Hosted Supabase Auth is reachable from route handlers (`getUser()`) and from the browser client (sign-in, sign-out, recovery check).
- The Q3 mocked-browser technique isolated **browser-originated** hosted contact correctly by construction (route handlers never ran because `/api/**` was fulfilled in the browser; non-localhost aborted). It did **not** isolate the Next server process: it spawned `npm run dev` with the ambient env (so `.env.local` loaded), with no server-side deny or request log. Residual server-side escapes are small (Google Fonts fetch, Next telemetry/update checks) and unproven.
- Design Audit 001 Pass 0 FAIL was **partially right**: right that the Playwright harness (`reuseExistingServer`, ambient `.env.local`, no abort) is not isolated and that isolation was unproven; too conservative in treating the technique as unusable, since for client-rendered pages with `/api/**` fulfilled no hosted call path exists in source.
- Recommendation: **Option E+** (Q3 technique hardened: scrubbed env pointing at dead loopback ports, Node-level outbound deny preload, font/telemetry neutralized, request/connection log asserted) with a fixture table per surface. No new dependency, no schema/product change.
- Prototype: feasible within existing architecture, but default remains DESIGN ONLY; spec in section 7.

## 2. Architecture map and escape paths

Hops: BROWSER -> NEXT CLIENT -> NEXT SERVER (RSC / route handlers; no proxy/middleware) -> AUTH (Supabase cookies, `getUser`) -> DB (`pg` Pool) -> EXTERNAL.

| # | Hop | Escape path (source) | Class |
|---|---|---|---|
| 1 | Browser | Client bundle inlines `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (`browser-client.ts`); used on sign-in, sign-out (`learner-utility-bar.tsx`, `instructor/layout.tsx`), login recovery check (`login/page.tsx` effect, only when `?mode=recovery`) | BLOCKABLE-IN-BROWSER |
| 2 | Browser | `fetch("/api/**")` from every page (same-origin to Next server) | BLOCKABLE-IN-BROWSER (fulfill) |
| 3 | Browser | Third-party asset/script | BLOCKABLE-IN-BROWSER; none found in source |
| 4 | Next server | `next/font/google` Heebo in `src/app/layout.tsx`: dev/build fetches from Google on the server; the browser only sees `/_next/static/media` | SERVER-SIDE (VERIFY: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` exists in Next source and can neutralize) |
| 5 | Next server | Next anonymous telemetry (`telemetry.nextjs.org`), dev registry/version check, SWC download if missing | SERVER-SIDE (`NEXT_TELEMETRY_DISABLED=1` covers telemetry; others VERIFY) |
| 6 | Route handlers | `createSupabaseServerClient()` uses `NEXT_PUBLIC_SUPABASE_URL` from env; `auth.getUser()`. With **no auth cookie**: supabase-js `_getUser` returns `AuthSessionMissingError` with no network call (read in `auth-js/GoTrueClient.ts`). With a cookie holding an access token: GET `${SUPABASE_URL}/user` | SERVER-SIDE (conditional on cookie) |
| 7 | Route handlers | `getPool()` -> `new Pool(DATABASE_URL)`; reached only after authentication (per `api.md`), **except** `GET /api/courses/:id`, a deliberately public route that calls `getPool()` directly | SERVER-SIDE; anonymous hosted DB contact on that one route |
| 8 | Route handlers | pool cached on `globalThis.__unlockPgPool` in dev; a reused dev server keeps a hosted pool | SERVER-SIDE |
| 9 | Harness | `playwright.config.ts` `webServer: npm run dev`, `reuseExistingServer` outside CI, ambient env incl. `.env.local` (hosted Ruppin); `join-errors.spec.ts` was run this way and hit the hosted DB read-only via #7; no abort route | SERVER-SIDE |
| 10 | Any | Email/SMTP, analytics, `@vercel/*` runtime calls | NONE found in `src` (grep `fetch(`, `process.env`, `https?://`) |

Per surface (assuming `/api/**` fulfilled in the browser):

| Surface | Server-side hosted contact | Browser-side hosted contact |
|---|---|---|
| Today, Practice, Courses, Course, Progress | none (rows 4-5 only) | none, except sign-out click |
| Login | none (SSR) | sign-in submit; recovery check (row 1) |
| Join `/join/[id]` | none if `GET /api/courses/:id` fulfilled; **hosted DB if not** (row 7) | none |
| Instructor courses / course / topics / question editor / import / publish | none (client pages, client layout) | sign-out only |

## 3. What the Q3 technique actually isolated

Source: `scratch/q3-a11y-night-001/{probe,names}.mjs` (git-ignored) and the Q3 Run report.

Did: `playwright-core` chromium (not Playwright Test, so not `playwright.config.ts`); either `--base` of an already-running server (`names.mjs` requires it) or it spawned `npm run dev -- -p <free port>` in the repo root with **inherited env** (`probe.mjs`); per context `page.route("**/*")`: abort when host differs from the server host, fulfill `/api/**` from in-script JSON, else continue; he-IL locale, widths 320-430.

Isolated: all browser-originated traffic to anything but the Next origin; all route handlers (so no `getUser`, no `getPool`, no DB). Covers every surface whose data arrives via `/api/**`.

Did not isolate or prove: the Next server's own egress (rows 4-5); `.env.local` was loaded by the spawned server (hosted URLs existed in its env, merely unused); `names.mjs` used a pre-existing server (Q3 report notes a stray dev server on port 3107) of unknown env/pool state; no request log recorded or asserted; auth behavior only as scripted by the mock.
Honest claim it supports: "mocked-browser, fixture API". Not supported: "zero server-side hosted contact" (true by code reading, unobserved).

## 4. Options matrix

Ratings: H high / M medium / L low (for cost columns lower is better).

| Option | Safety | Fidelity | Setup | Maint. | Auth realism | DB realism | Network isolation proof | CI | Local dev | Context cost |
|---|---|---|---|---|---|---|---|---|---|---|
| A Local Supabase stack | H once running | H | H: needs Docker (none, per e2e README) + CLI | M | H | H | local only; hosted still reachable if env wrong | M | L-M | M |
| B Dedicated test Supabase project | M: still hosted; creating/linking is a human action (CLAUDE.md §6) | H | H, human-gated | M | H | H | cannot be "zero hosted" | M | M | M |
| C Playwright-route mocking only | H | M: UI only; fixtures can drift from DTOs | L | M | none | none | browser only | H | H | L |
| C-seam Env-switched fakes in composition roots | H | M-H (real handlers + fakes) | H: routes build `Postgres*Repository(getPool())` inline across ~26 routes; fakes live under `__tests__` | H | partial | in-memory only | server also fakeable | H | M | H |
| D PGlite-backed browser harness | H | H DB | H: `pg` Pool needs a Postgres wire server; only `@electric-sql/pglite` is installed (no `pglite-socket`), so a new dependency or an adapter replacing `getPool()` everywhere. Auth still fixture | H | L (only a stub `auth.users` in `db-harness.ts`) | H | server egress still open | M | M | H |
| E Q3 technique hardened | H if layers hold | M: real pages and layouts, fixture API | L | L-M | none (scripted) | none | strong: 4 independent layers (section 5) | H | H | L |

D today: `createTestDb()` in `supabase/tests/postgres/db-harness.ts` applies all migrations into PGlite for vitest only; it is not reachable from `next dev`. A and B are the only options with real Supabase Auth behavior; both conflict with the no-hosted/no-new-infra goal.

Hybrid (E plus a seam, later, optional, not recommended now): env `UNLOCK_TEST_FIXTURES=1` honored in one new server module that (a) makes `createSupabaseServerClient` return a stub with a fixed fake user and (b) returns fakes instead of `getPool()`-built repositories via a single `getRuntimeDeps()` indirection per composition root. It must hard-refuse when `NODE_ENV=production` or `VERCEL` is set and be absent from the client bundle. It touches the auth boundary (security review required) and changes many route files; E covers the stated need without it.

## 5. Recommendation and determinism proof

**Option E+**: a local script that:

1. Starts its own Next server on a free loopback port (never reusing an existing server) with a **scrubbed env**: pass only `PATH`, `NODE_ENV`, `NEXT_TELEMETRY_DISABLED=1`, `DATABASE_URL=postgres://u:p@127.0.0.1:1/db` (closed port), `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture`, `NEXT_PUBLIC_APP_URL=<local>`. Process env should win over `.env.local` in Next (VERIFY); no secret is read or printed.
2. Preloads a guard via `NODE_OPTIONS=--require <guard.cjs>` that patches `net.Socket.prototype.connect` (and `dns.lookup`) to throw and log for any non-loopback address; inherited by Next child processes.
3. Context-level `route("**/*")`: abort non-origin, fulfill `/api/**` from a fixture table, record every request URL.
4. Fonts: neutralize the Google fetch via Next's mocked-response env or accept the fallback font (VERIFY; screenshots then use a fallback Hebrew font, a fidelity caveat).
5. End-of-run assertions that fail the run: all recorded browser requests are origin-host; guard log has no non-loopback attempt; fixture-missed `/api/**` requests counted and reported (Q3 returned 404).

Fail-closed: layers are independent. Env scrub removes hosted addresses; the guard blocks connect even if a hosted address leaked in; browser abort blocks client traffic; assertions turn any breach into a failed run. Unprovable items: section 8.

## 6. Future rendered Design Audit plan (Pass 1, once isolation exists)

Matrix: widths 360 / 390 / 430 / 1280; he-IL, `dir=rtl`. Surfaces: Today (pending, single, multiple, feedback, empty, error, skipped), Practice (batch, complete), Courses (0, 1, 7 rows), Progress (all topic states), Login (sign-in, recovery), Join (open, closed, 404/malformed), instructor courses, course page, topic management, question editor (single/multiple), import (textarea, preview, error), publish.

| Step | Input | Output | Must not |
|---|---|---|---|
| 0 Isolation proof | section 5 checks | pass/fail log | continue on any fail |
| 1 Fixtures | JSON per surface (reuse Q3 `courses`, `topics`, long-Hebrew text; add mixed bidi, 0/1/many, 4xx/5xx/slow) | fixture table | use real data or credentials |
| 2 Screenshots | each state x width | PNG set | upload anywhere |
| 3 Focus walk | Tab sequence (Q3 `measure`) | order, ring present, occluded | |
| 4 Target size | bounding rects | list under 44px and under 24px | |
| 5 Overflow | `scrollWidth > innerWidth` | per-width flags | |
| 6 Contrast | computed styles where resolvable | ratios | claim full WCAG |
| 7 A11y tree | `locator.ariaSnapshot()` | names (Topic inputs) | |
| 8 Console/network | recorded logs | clean or not | |
| 9 Audit 001 open items | Courses row `p-4` vs `p-5` after DS-01; Notice on instructor error/success; Topic input names; long Hebrew; bidi mixed; import textarea | checklist verdicts | |

No Apple pass unless screenshots reveal a specific craft gap.

## 7. Prototype decision

A local-only prototype is possible without a new dependency (`playwright-core`, `next`, `node` present), schema, product or auth change: Q3 probe plus steps 1-5 of section 5. Gate: hosted network deterministically blocked = by layered design but **unproven until executed**; no real credentials = yes; no dependency = yes; no schema mutation = yes; fails safe = yes by design; independent reviewer agrees = **not yet**. Decision: DESIGN ONLY now. Minimal spec if approved: `isolated-audit.mjs` + `net-guard.cjs` + `fixtures.mjs` (in `scratch/` or `tooling/`); spawns `next dev -p <free>` with the scrubbed env; first run is a dry run on `/login` expecting zero guard events.

## 8. Unprovable / limits

Physical-device rendering; screen readers; real Supabase Auth behavior (session expiry, cookies, recovery email); real hosted/Production/Vercel behavior; real PostgreSQL behavior beyond PGlite; fixture-vs-handler contract drift (mitigate by validating fixtures against DTO types); real web-font rendering if fonts are neutralized. Source-read claims here, especially VERIFY items and "process env wins over `.env.local`", are unexecuted.

## 9. Routing (proposed FUB text only; parent routes)

- FUB-A: Implement isolated rendered-audit harness (Option E+): scrubbed-env Next server, Node connect guard, request-log assertions, fixtures per surface; reviewer agreement and human OK before first run.
- FUB-B: Make `playwright.config.ts` webServer safe by default: no `reuseExistingServer` against an unknown server, scrubbed env, abort non-origin.
- FUB-C: Decide whether `join-errors.spec.ts` should keep hitting the hosted public course lookup or move to fixtures.

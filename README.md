# UNLOCK

UNLOCK is a Hebrew-first, RTL-first adaptive learning application.

The product builds a learner model over time and uses it to determine the next valuable learning action.

For repository-wide development guidance, start with:

`AGENTS.md`

Claude Code also uses:

`CLAUDE.md`

For current execution and repository state:

* `docs/CHATGPT_PLAN.md` — what is being executed now
* `docs/DEV_STATUS.md` — what is true now
* `docs/CONTEXT_MAP.md` — where to find decisions, code, and tests

---

## Core V1

Current important product concepts include:

* User
* Course
* CourseMembership
* Material
* Topic
* Question
* QuestionVersion
* Attempt
* UserQuestionProgress
* Learner State
* Next Best Action
* DailyPlan
* DailyPlanItem
* Today
* Manual Practice
* Basic Progress

The exact V1 boundary lives in:

`docs/UNLOCK_V1_SCOPE.md`

---

## Architecture

UNLOCK currently uses a layered modular-monolith structure:

```text
src/app/
    ↓
src/application/
    ↓
src/domain/

src/infrastructure/
    implements persistence/provider boundaries
```

Architecture details live in:

`docs/ARCHITECTURE.md`

---

## Tech Stack

* Next.js App Router
* TypeScript
* Tailwind CSS
* PostgreSQL
* Supabase Auth / hosted PostgreSQL
* Vitest
* PGlite
* Playwright
* Vercel
* GitHub
* Cursor / Claude Code

---

## Local Development

```bash
npm install
npm run dev
```

Common verification commands include:

```bash
npm run lint
npm run typecheck
npm test
npm run test:schema
npm run test:e2e
npm run build
```

Which checks are appropriate depends on the changed risk.

Testing philosophy lives in:

`docs/TESTING.md`

---

## Development Boundaries

Do not automatically:

* push;
* deploy;
* apply hosted Supabase migrations;
* use `supabase link`;
* use `supabase db push`;
* introduce new product behavior outside current scope.

Current remote/local migration state lives in:

`docs/DEV_STATUS.md`

---

## Documentation Navigation

Use:

* `docs/MASTER_SPEC.md` — product constitution
* `docs/PRODUCT.md` — practical product model
* `docs/UNLOCK_V1_SCOPE.md` — V1 boundary
* `docs/UNLOCK_ROADMAP.md` — product sequencing
* `docs/DECISIONS/**` — accepted durable decisions
* `docs/OPEN_QUESTIONS.md` — unresolved decisions
* `docs/FOLLOW_UP_BACKLOG.md` — deliberately deferred technical work
* `docs/RUNS/**` — historical execution records

For unfamiliar work, use `docs/CONTEXT_MAP.md` as a navigation aid rather than loading the entire documentation set.

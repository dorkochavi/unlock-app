# UNLOCK — Agent Baseline

`AGENTS.md` is the small tool-agnostic contract for coding agents.
Tool-specific files may add workflow behavior but must not redefine shared product/architecture/safety truth.

## Start

Before substantial work:
- inspect relevant repository state;
- identify the current task/Run;
- load only the minimum authoritative context required;
- use `docs/CONTEXT_MAP.md` only when navigation is needed.

## Source Categories

- **Repository reality:** committed code, tests, migrations, config.
- **Accepted intent:** ADRs + canonical product/architecture docs.
- **Unresolved decisions:** `docs/OPEN_QUESTIONS.md`.
- **Current execution:** `docs/CHATGPT_PLAN.md`.
- **Current snapshot:** `docs/DEV_STATUS.md`.
- **Historical context:** Git + `docs/RUNS/**`.
- **Deferred work:** `docs/FOLLOW_UP_BACKLOG.md`.
- **Temporary context:** `scratch/**` (non-canonical).

Accepted decisions may intentionally lead current implementation; do not assume existing code overrides a newer accepted decision.
Do not invent unresolved product/data/auth/learning behavior.

## Scope

Work in focused bounded changes.
Do not silently mix unrelated subsystems or implement deferred features opportunistically.
When repository reality materially conflicts with current accepted intent/Plan, surface the conflict instead of guessing.

## Safety

Agents do not autonomously:
- push/deploy/publish;
- mutate/link hosted Supabase or apply hosted migrations;
- perform destructive Git/filesystem operations;
- delete unknown files;
- expose/request/commit secrets.

Prefer the smallest safe reversible change.

## Tool Entry Points

- Claude Code → `CLAUDE.md` + `.claude/**`
- Cursor → `.cursor/rules/**`

Canonical repository truth remains in the shared sources above.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

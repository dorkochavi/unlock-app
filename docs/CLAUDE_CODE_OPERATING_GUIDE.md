# UNLOCK — Claude Code Operating Guide

Status: ACTIVE — human-facing field guide
Load level: not preloaded by default; consult BEFORE searching for any DevOS tool, command, verifier,
telemetry utility, checkpoint mechanism or workflow path (`CLAUDE.md` §1).

This is the canonical **Operational Discovery Index** — an index, not a policy owner. It points at
canonical files instead of restating them.
The single authoritative kernel is repo-root `CLAUDE.md`. When this guide and a canonical file
disagree, the canonical file wins.

## 0. Operational Discovery Index

Look here first; do not search `package.json`, scripts, or the repository for these.

| Need | Where |
|---|---|
| Current execution / Slice order | `docs/CHATGPT_PLAN.md` |
| Current durable snapshot | `docs/DEV_STATUS.md` |
| Context navigation | `docs/CONTEXT_MAP.md` |
| Run / Slice workflow owner | `CLAUDE.md` §7, §12 |
| Implement one Slice | `.claude/skills/implement-slice/SKILL.md` |
| Long Autonomous Run | `.claude/skills/autonomous-run/SKILL.md` |
| Verification selection / freshness | `.claude/rules/testing.md` |
| Reviewer selection | `.claude/skills/review-commit/SKILL.md` |
| Evidence / readiness gate | `.claude/skills/checkpoint/SKILL.md` |
| Development checkpoint / `CURRENT_SLICE` | `scratch/development_checkpoint.md` (untracked; must carry this Run's `RUN_ID:` line or `CURRENT_SLICE` is ignored — see §6) |
| Run-close verifier, before the close commit | `node .claude/telemetry/verify-run-close.mjs --pre-close` |
| Run-close verifier, final (clean tree) | `node .claude/telemetry/verify-run-close.mjs` |
| Telemetry summarizer | `node .claude/telemetry/summarize.mjs` |
| Telemetry output | `scratch/telemetry/<RUN_ID>/summary.md`, `summary.json` (raw events under `raw/`) |
| Context usage | `/context` (built-in command) |
| Historical Runs | Git + `docs/RUNS/**` (RESTRICTED; not normal working context) |
| Deferred work / open decisions | `docs/FOLLOW_UP_BACKLOG.md` / `docs/OPEN_QUESTIONS.md` |
| Human-only boundaries | No push (`CLAUDE.md` §6); hosted Supabase/migration actions (`.claude/rules/postgres.md`); secrets (`.claude/rules/auth.md`) |

## 1. Where DevOS knowledge lives

The repository is persistent technical truth (`CLAUDE.md` §1). One home per fact (`CLAUDE.md` §2):

- **Repository reality** — committed code, migrations, tests.
- **Accepted intent** — ADRs and canonical product/architecture docs.
- **Unresolved decisions** — `docs/OPEN_QUESTIONS.md`.
- **Current execution** — `docs/CHATGPT_PLAN.md`.
- **Current snapshot** — `docs/DEV_STATUS.md`.
- **Navigation** — `docs/CONTEXT_MAP.md`.
- **Historical execution** — Git + `docs/RUNS/**`.
- **Deferred work** — `docs/FOLLOW_UP_BACKLOG.md`.
- **Temporary continuity** — `scratch/development_checkpoint.md`.

See `CLAUDE.md` §2 for the authoritative list.

## 2. HOT / WARM / COLD / RESTRICTED

Context is tiered so you load only what a Slice actually needs: `CLAUDE.md`/current Plan/current
`DEV_STATUS` are HOT; `CONTEXT_MAP`/`OPEN_QUESTIONS` are WARM; `MASTER_SPEC`, ADRs, `.claude/rules/*`,
technical docs, and telemetry docs are COLD; historical Run Reports and superseded plans are
RESTRICTED. Don't preload WARM/COLD/RESTRICTED material merely because it exists. See `CLAUDE.md`
§3 for the authoritative tiers.

## 3. Slice lifecycle at a glance

`INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT → COMMIT`

Orchestrated by `.claude/skills/implement-slice/SKILL.md`. Verification selection/freshness is
owned by `.claude/rules/testing.md`; reviewer selection by `.claude/skills/review-commit/SKILL.md`;
the evidence/readiness gate by `.claude/skills/checkpoint/SKILL.md`. See `CLAUDE.md` §7.

## 4. `/checkpoint` and `/review-commit`

- `/checkpoint` — evidence and repository-state validator, not a second test runner. Reuses fresh
  evidence, runs only what's missing/stale, and returns a verdict. See
  `.claude/skills/checkpoint/SKILL.md`.
- `/review-commit` — sole owner of risk-based reviewer selection (none / general / DB / security /
  a justified combination) and reviewer orchestration. See `.claude/skills/review-commit/SKILL.md`.

## 5. Run-close identity model

Runs are identified by three explicit fields instead of a self-citing "Final HEAD":

- `START_HEAD` — the commit the Run began from.
- `LAST_VERIFIED_HEAD` — the most recent commit actually verified at Run close.
- `RUN_STATUS` — the Run's current disposition (e.g. `COMPLETE`).

This replaced an older "Final HEAD" pattern that could never correctly cite the hash of the very
commit introducing it. A deterministic, zero-AI verifier checks these fields plus the matching
`docs/RUNS/<RUN_ID>.md` report:

```
node .claude/telemetry/verify-run-close.mjs [--pre-close]
```

Use `--pre-close` when checking Run-close doc edits before the closing commit exists. See the
script's own header comment for exact scope/behavior, and `docs/DEV_STATUS.md` /
`docs/CHATGPT_PLAN.md` for a live example of the fields in use.

## 6. Telemetry and KEEP / WATCH / CHANGE

Local execution metadata is collected under `.claude/telemetry/` (`collect.mjs`, `summarize.mjs`,
`statusline.mjs`, plus the Run-close verifier above). Telemetry is an observability layer, not
working context — don't load it or narrate it during normal implementation (`CLAUDE.md` §15).

Slice attribution: `scratch/development_checkpoint.md` (untracked) needs this Run's `RUN_ID:` line and one `CURRENT_SLICE:` line; a checkpoint left over from another Run is ignored, not inherited. Native reads/searches, shell navigation and response-size hotspots are separate summary sections (`docs/DEVOS_OBSERVABILITY.md` §11).

When you do interpret telemetry, every efficiency signal is read beside its paired quality signal,
and an observation moves through `MEASURE → INTERPRET → COMPARE → ACT`, landing on `KEEP` (no
change), `WATCH` (noted, not yet acted on), or `CHANGE` (promoted to an actual policy/process
change) — never `measure → immediately optimize`. Full model and event/metric semantics: `docs/DEVOS_OBSERVABILITY.md`.

## 7. `/clear` vs `/compact` vs `/rename` + `/clear` + `/resume`

Practical, not prescriptive:

- **`/clear`** — start a new session with empty context. Use at a clean Slice/Run boundary once
  durable state (`DEV_STATUS.md`, the Plan, a Run report, or a scratch checkpoint) already captures
  what the next session needs to resume from. Cheapest option when you don't need this session's
  transcript again.
- **`/compact`** — shrink the current session's context in place while staying in the same session.
  Use mid-Slice when context has grown large but you still want this session's live state (partial
  edits, open questions) rather than a resume packet.
- **`/rename` + `/clear` + `/resume`** — give the current session a durable name before clearing it,
  so you (or another agent) can find and resume it later instead of losing it to the session list.
  Use this instead of a bare `/clear` when the session itself (not just its written artifacts) is
  worth being able to come back to.

`/clear` protects context health but does not itself reduce total Run cost; prefer fewer, cheaper
resumptions and good handoffs (interruption recovery: `.claude/skills/autonomous-run/SKILL.md`).

When in doubt, prefer writing durable state to the repository (Git, `DEV_STATUS`, scratch checkpoint)
over relying on session memory at all — see `CLAUDE.md` §16, Handoff Model.

## 8. Long Autonomous Runs (current shape, not a formal policy)

Some Runs are driven by a thin parent orchestrator that never does the implementation work itself:
it dispatches each Slice to a fresh, sequential, scoped worker (no inherited context except a
compact handoff), consumes that worker's short structured report, updates a Run-local
`scratch/development_checkpoint.md` (Run goal, Slice queue, completed Slices, blockers, current
Slice, uncommitted work, last verification), and dispatches the next Slice. Reviewers are likewise
fresh agents invoked per `.claude/skills/review-commit/SKILL.md` only when a Slice's risk warrants
one. Workers run one at a time (single writer), not in parallel. Before the first worker, Phase 0 sets
the Plan's `RUN_ID` / `START_HEAD` / `RUN_STATUS` so telemetry attributes to the new Run; gate meanings
(AUTO / REVIEW_GATE / HUMAN_DECISION_GATE / FINAL_GATE) and interruption recovery live in the skill, not here.

The reusable procedure for this pattern is packaged as `.claude/skills/autonomous-run/SKILL.md`. It
is deliberately not referenced from `CLAUDE.md` — Long Autonomous Runs are an infrequent, explicitly
invoked mode, not part of ordinary per-Slice lifecycle — so use it by path (or by its slash-name if
wired up) when a Run's initiating prompt calls for this pattern, rather than reconstructing the
protocol from scratch.

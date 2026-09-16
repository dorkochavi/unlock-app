# UNLOCK project instructions

Before doing any work in this repository:

1. Read `docs/CONTEXT_MAP.md` first — it routes you to the documents relevant to your task.
2. `docs/MASTER_SPEC.md` is the product constitution; treat it as the high-level source of truth.
3. Do not invent unresolved product, learning, or data behavior — check `docs/OPEN_QUESTIONS.md` and surface gaps instead of guessing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

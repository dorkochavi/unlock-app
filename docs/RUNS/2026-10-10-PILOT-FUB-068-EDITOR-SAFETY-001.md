# Run 2026-10-10-PILOT-FUB-068-EDITOR-SAFETY-001 — Question Editor unsaved-edit safety

Status: COMPLETE
RUN_ID: 2026-10-10-PILOT-FUB-068-EDITOR-SAFETY-001
START_HEAD: `588ec1e`; product commit `c2fcb72`. NO PUSH.

## Behavior (FUB-068 Option B)
- `beforeunload` listener exists only while the editor is dirty; removed on clean/unmount (browser controls the dialog text).
- Back link: plain click while dirty asks a Hebrew `window.confirm`; cancel keeps the draft; modified clicks (new tab) are not guarded. Clean: no prompt.
- Create Another: confirm runs before the empty Question is created (button is already hidden while dirty; this is defensive).
- Publish while dirty: returns before any fetch, clears success state, shows Hebrew "unsaved changes — save first — publish was not performed". Notice is hidden once the form is clean (save or manual revert). Clean Publish unchanged.
- No localStorage/sessionStorage/autosave; no schema/API/dependency change.

## Files
`page.tsx`, `editor-logic.ts` (guard helpers), `src/messages/he.ts` (2 strings), new `__tests__/unsaved-guard.test.ts`.

## Evidence (class: unit + source-wiring; NOT browser)
Questions tests 45/45, typecheck, eslint clean. Cases 1-12 covered at helper level plus source-order checks of page wiring (no DOM test library in repo). Independent general review: no material findings; its optional stale-notice item was fixed (lint-compliant derived render, not an effect).

## Remaining boundaries
Browser back/forward, other on-page links/nav, and mobile `beforeunload` are not guarded or proven. Real dialogs/clicks unverified in a browser: do in the P4 instructor walkthrough.

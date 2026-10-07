# Run Report — 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001

Status: `COMPLETE` (local only; no push, deploy, tag, hosted/Supabase mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `3cee94b`; last verified content commit `04ec501`; origin/main at Run start `0ac70d1` (local main ahead, unpushed). Scratch (git-ignored): `scratch/ae-night-001/`.

## Outcome
A canonical Assessment Engine direction document and a pure, unwired deterministic question-linter prototype. Two Pilot-facing review tracks (UX, Q3 a11y/RTL) closed **PARTIAL**. Design detail is owned by `docs/ASSESSMENT_ENGINE.md` (Sections 1-30, Capability Ledger Section 28) and is not restated here.

## Commits
| Commit | Content |
|---|---|
| `882dc5b` | Plan identity |
| `1536181` | `ASSESSMENT_ENGINE.md` Sections 1-19 |
| `e2d55eb` | linter prototype (`src/domain/assessment/question-lint.ts`, `text-normalize.ts`), not wired |
| `022bfed` | linter hardening after review (ReDoS, totality, caps); 8 failing-first regression tests; 52 tests total |
| `04ec501` | `ASSESSMENT_ENGINE.md` Sections 20-30 + Capability Ledger |

## Slices
- A discovery: done. B research: done (WebFetch partial; nothing verified against full text; limits recorded in the doc).
- C-G, I-O, P-V: designed in the doc.
- H linter: PROTOTYPED, not wired into any import/publish/API/UI flow (implemented code lists: doc Sections 10-11, 29).
- Q DOCX: **not implemented — human decision.** A bounded hand-rolled reader was judged feasible with no new dependency, but an unattended hostile-input parser was deliberately not written; hand-roll vs vetted library and security budget are a human decision (group B).
- R PDF: **HUMAN_GATE** (needs a vetted library, i.e. a dependency).
- S Google: design only.
- W Pilot UX gate: PARTIAL. X Q3 a11y/RTL gate: PARTIAL (below).
- Z governance/close: this commit.

## Verification
| Evidence | Result | Provenance / freshness |
|---|---|---|
| Full Vitest | 184 files passed / 1 skipped; 2243 tests passed / 4 skipped | fresh at `04ec501`; no `src` change after `022bfed` |
| Typecheck | clean | fresh at `04ec501` |
| `npm run build` | succeeded | fresh at `04ec501` |
| ESLint | 3 problems: 2 `react-hooks/purity` errors in `src/app/instructor/courses/[courseId]/questions/[questionId]/page.tsx` (lines 416, 474) + 1 warning in `.claude/telemetry/statusline.mjs` | pre-existing: neither file appears in `git diff --name-only 3cee94b..HEAD` (changed: ASSESSMENT_ENGINE.md, CHATGPT_PLAN.md, `question-lint.ts`, `text-normalize.ts`, its test); not fixed (out of scope) |
| Schema/PGlite | not run | no DB/migration/repository change |
| Browser E2E | none for the product | no UI change; slices W/X below |
| Dependencies | none | `git diff 3cee94b..HEAD -- package.json package-lock.json` empty |

## Review
- General reviewer on `e2d55eb`: CORRECTIONS REQUIRED (8 findings: ReDoS, totality, caps), all fixed in `022bfed` with failing-first tests.
- Final range reviewer `3cee94b..04ec501`: NO BLOCKING FINDINGS. Non-blocking: uncapped O(n^2) set lint (AE-032), Hebrew prefix false positive (`מלא` matched as `מ`+`לא`), all/none-of-above substring match without word boundary, incomplete seed term lists. Tracked as FUB-054.
- Security reviewer: not dispatched — no document-parsing code was introduced (DOCX/PDF not implemented). DB reviewer: not applicable (no schema).

## Gates W / X
- **W Pilot UX: PARTIAL.** No known UX defect justifies blocking a controlled Pilot; no P0/P1 UX defect recorded; open items P3/WATCH only (Q3-A fix undeployed, Q3-W1, Q3-F3..F6, Q3-W2, Practice same-question restore). Evidence-review only (docs).
- **X Q3 a11y/RTL: PARTIAL.** Local dev server, `/api` mocked, non-localhost aborted. Sticky focus clearance, tab order, focus ring, reflow (320..1280) and instructor option names pass; no new P0-P2; Q3-F3 headings and Q3-F4 small instructor targets reconfirmed WATCH. Not verified: screen readers, physical devices/safe-area, production, Safari/Firefox, zoom/text-resize, contrast, bidi order of mixed-script text, instructor surfaces beyond the question editor.
- **Remaining human checks (FUB-058):** deploy the Q3 commits, then real iOS/Android sticky-bar focus and screen-reader option names; re-run the `PILOT_READINESS` student script on 2+ physical devices on Production; induce a real 401 (learner and instructor); instructor laptop walk on Production.

## Human decision log (detail: `docs/ASSESSMENT_ENGINE.md` Section 27.1)
- A (before merging/using the prototype): accept the unwired linter; advisory-only; named default thresholds.
- B (before PDF/DOCX): DOCX hand-roll vs library and security budget; PDF dependency; upload persistence (OQ-023/OQ-024); upload cap/transport; OCR in/out.
- C (before AI): whether to use AI; provider/terms; stakes; budget; human approval policy (OQ-038); critic calibration.
- D (before a Google connector): whether; OAuth ownership/scopes; token storage; security review.
- E (before Pilot): content sign-off with real material; whether/where lint output is shown; Golden Dataset annotators; which unimplemented lint codes matter.
- F (post-Pilot): response-data scope/privacy; psychometric thresholds; feedback into generation; misconception-to-mastery link.

## Residuals
Backlog: FUB-054 (linter hardening), FUB-055 (wire into import validator; code reconciliation; relates FUB-035), FUB-056 (DOCX), FUB-057 (PDF dependency gate), FUB-058 (human device checks). No new OQ entry: every open decision maps to OQ-023/024/038 or the Section 27.1 log. No ADR. Q3-A11Y commits and this Run remain undeployed and unpushed.

## Rollback
Revert the Run's commits (`git revert` of the five commits above plus the close commit). No schema, data or dependency to unwind; the linter is unreferenced, so removal has no runtime effect.

## Mechanism (autonomous-run)
1 parent + 9 fresh sequential or read-only-parallel workers (A+B parallel read-only; W+X parallel with X writing only git-ignored scratch); isolation held; 0 STOP/ESCALATE events; 1 FIX round; 0 compactions known. Telemetry summary (1 session observed, 187 events): ~37m session duration, ~$7.07 estimated cost, highest ending context 17%, 0 compactions, cache hit ~97%, 14 substantive reads (all subagent), 0 historical Run files read. Figures cover the observed session only. Provisional call: KEEP/WATCH.

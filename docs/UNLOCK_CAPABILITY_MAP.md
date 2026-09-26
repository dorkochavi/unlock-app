# UNLOCK — Macro Capability Map

Status: CANONICAL strategic capability index (created 2026-09-26, at `5bdfb70`, during Run UX-02 between P1 and P2)
Load level: COLD — load for strategy, prioritization or "what can UNLOCK do" questions; not normal Slice context.

## 0. What This Document Is (and Is Not)

It answers one question per capability: **how mature is it, how much does it matter, and where does its truth live?**

It is an index, not an authority for behavior. Detailed semantics stay with their owners and win on any conflict:
ADRs (`docs/DECISIONS/**`), `docs/LEARNING_ENGINE.md`, `docs/UX_SPEC.md`, `docs/MASTER_SPEC.md`,
`docs/UNLOCK_ROADMAP.md` (sequencing), `docs/UNLOCK_V1_SCOPE.md` (V1 boundary), `docs/DEV_STATUS.md` (current state),
`docs/PILOT_READINESS.md` (pilot gate), `docs/OPEN_QUESTIONS.md` (decisions), `docs/FOLLOW_UP_BACKLOG.md` (deferred work).
It does not create Runs, reorder the Roadmap or change the current Plan.

**Update rule:** revise a row only when repository evidence changes its maturity or a decision changes its priority. Cite
the evidence (commit/test/doc) in the row, not a narrative.

**Status of the ratings:** maturity is an evidence reading. **Priorities are this map's strategic assessment (2026-09-26),
not decisions.** Where a priority differs from an owner (e.g. a FUB item's own priority, or `PILOT_READINESS.md` §3 not
listing an item), the owner stays binding until a human decision updates it; the row says so. The binding pre-pilot
checklist remains `PILOT_READINESS.md` §3; the V1 boundary remains `UNLOCK_V1_SCOPE.md`.

### Maturity scale
- **M0 — Idea**: named direction only; no accepted design.
- **M1 — Designed**: accepted design/decision or schema placeholder; no working product behavior.
- **M2 — Functional**: works in the product, with thin or local-only evidence.
- **M3 — Evidence-backed**: works, with strong automated evidence and/or manual Production verification.
- **M4 — Calibrated**: tuned against real usage/pilot evidence. **Nothing in UNLOCK is M4 yet** — the real pilot has not
  happened (`PILOT_READINESS.md` §1).

### Priority scale
- **A — Pilot-critical**: needed before or at the Ruppin pilot.
- **B — Strategic next**.
- **C — Evidence-driven later**: build only once pilot/usage data exists.
- **D — Optional / later**.

## 1. Strategic Principles

Preserved from owners:
- UNLOCK is not primarily a quiz app, LMS, PDF-chat tool or AI question generator. The core promise is a longitudinal
  learner model that decides what the learner should do next (`UNLOCK_ROADMAP.md` §2, `MASTER_SPEC.md` §1–§3).
- Learner State and Next Best Action are already real, deterministic intelligence (§2 rows 1–2 below).
- AI is not the Learning Engine (ADR-004; `LEARNING_ENGINE.md` §46).
- AI-generated questions are proposals; instructor approval is required before publication (Roadmap Run 011). Note:
  `MASTER_SPEC.md` §47 still says "optional human approval … policy-dependent" and OQ-038 is DEFERRED — reconcile when
  Run 011 is designed.
- No fake precision and no vanity analytics (`MASTER_SPEC.md` §7.11; `LEARNING_ENGINE.md` §44).
- Do not overbuild knowledge graphs, microservices, generic LMS abstractions or generic AI platforms (ADR-001;
  Roadmap §9; `MASTER_SPEC.md` §56).

Product-owner direction recorded by this map (2026-09-26; not yet in an owning doc — reconcile with Roadmap Run 011's own
upload → review-queue flow and `MASTER_SPEC.md` §46 when Run 011 is designed):
- Structured Import remains the stable contract that future AI/PDF ingestion should feed; AI-generated content reuses the
  normal draft → review → publish path rather than a parallel one.
- Human review is required for AI-generated **or AI-resolved** assessment content (extends Run 011 to answer resolution;
  consistent with `PILOT_READINESS.md` §3 item 2).

## 2. Capability Matrix

| # | Capability | Maturity | Priority | One-line state |
|---|---|---|---|---|
| 1 | Learner Intelligence | M3 (misconception: M1 in production) | A | Deterministic evidence/FSRS/mastery/lapse pipeline in production; misconception detection is implemented but **inert in production** (no confidence capture) |
| 2 | Learning Decision / Next Best Action | M3 | A | Deterministic ranked NBA feeds one persisted cross-Course DailyPlan; exam urgency (V1-required) and learner-facing explanations not built |
| 3 | Course / Topic Practice | M1 | B | Run UX-02 active: design accepted; P1 scheduling rule committed on the feature branch (tested, not reachable in product); selector/API/UI not built |
| 4 | Content Intelligence | M1 | C | Flat Topics real; Material/source model is an unused schema placeholder; no concept relations |
| 5 | Question Intelligence / Pedagogy | M2 (structural) / M0 (pedagogical) | B | Structural validity enforced; pedagogical quality is a human checklist only |
| 6 | Lecturer Style Intelligence | M0 | D | Named here only; no repository design |
| 7 | Instructor Intelligence | M3 | A | Privacy-gated Item Analysis + Topic Insights Production-verified; value hypothesis unvalidated |
| 8 | Structured Import | M3 | A | JSON/CSV → preview → all-or-nothing DRAFT_ONLY confirm; offline validator |
| 9 | AI / PDF Ingestion & Question Generation | M1 | C | Direction + threat model only; no code |
| 10 | Legacy MCQ Extraction / Answer Resolution | M0 | C | Named here only; no repository design |
| 11 | Assessment / Item Intelligence | M1 | C | Only coarse first-answer bands; difficulty/discrimination/distractor health need pilot data |
| 12 | Product Analytics & Experimentation | M1 | A (baseline) / D (experimentation) | Authoritative records exist; no event instrumentation; provider decision open |
| 13 | UX / Accessibility / Performance | M2 | A | UX-01 learner shell (mocked evidence); Today proven on real phones; a11y and latency only partly evidenced |
| 14 | Trust / Security / Privacy | M2 (authz at M3) | A | Strong server-side authz + aggregate privacy; no privacy/legal pages, deletion semantics or rate limiting |
| 15 | Platform / Operations / Observability | M2 | A (minimum) | Release model + CI + manual backup; no runtime monitoring, no restore drill |
| 16 | Growth / SEO / Public Web | M0 | D | Minimal root page + app metadata only |
| 17 | System Auditor / Quality Intelligence | M0 | C | Direction only; dev-time golden scenarios/validator are not a runtime auditor |

## 3. Capabilities

### 1. Learner Intelligence — M3 (misconception sub-capability M1 in production) · A
- **Owns:** per-learner, per-Question derived state from immutable Attempts: evidence quality, FSRS memory, retrieval
  qualification, evidence strength, lapses, misconception state, mastery category; replay/rebuild.
- **Proven:** `src/domain/learning/**` (progress-update, rebuild, mastery, lapse, misconception, retrieval-qualification,
  evidence-strength) with golden scenarios and replay parity tests; ts-fsrs adapter behind the scheduler boundary (ADR-008);
  immutable Attempts/QuestionVersions (ADR-005/009); atomic answer transaction (ADR-010). Branch-only, not in production:
  `learning-engine-v2` Practice early-correct rule (Run UX-02 P1, `5bdfb70` on `feature/run-ux-02-practice`).
- **Partial:** misconception detection needs a high-confidence wrong answer, but the Today client sends only
  `submissionId` + `selectedAnswer` (`src/app/(learner)/today/page.tsx`), so no production Attempt carries confidence and
  misconception state cannot leave `none` (also noted in `docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md`). Response time
  is likewise never sent. All thresholds are uncalibrated engineering defaults (OQ-011/012/013).
- **Missing:** confidence evidence — a V1-required capability (`UNLOCK_V1_SCOPE.md` §6 "Confidence Gap"; Roadmap
  Run 010; interaction model OQ-014 OPEN); cold-start/diagnostic intelligence beyond New Material (`LEARNING_ENGINE.md`
  §31); OQ-044 (FSRS "due within minutes").
- **Pilot needs:** current pipeline as is; a conscious decision on whether misconception detection must be live at pilot
  (i.e. whether OQ-014 is pilot-scope).
- **Mature-only:** calibrated thresholds/retention (M4), response-time interpretation (OQ-015), intervention effectiveness
  (`MASTER_SPEC.md` §59).
- **Depends on:** 12 (to calibrate), 5 (content quality limits evidence quality).
- **Sources:** `LEARNING_ENGINE.md` §5–§26, §47–§49; ADR-005/008/010/012; `.claude/rules/learning-engine.md`.
- **Trigger:** OQ-014 decision (confidence), or pilot data available for calibration.

### 2. Learning Decision / Next Best Action — M3 · A
- **Owns:** choosing what each learner does next: NBA candidates and ranking, the one persisted DailyPlan per learner-day
  (Global/Course Today views), Skip, New Material fallback.
- **Proven:** `src/domain/learning/next-best-action.ts` / `next-best-action-ranking.ts` (tiered candidates with internal
  reason codes); DailyPlan generation/persistence (ADR-016); New Material V1 (ADR-017);
  hosted 30-learner burst and real-device Production checks (`PILOT_READINESS.md` §4).
- **Partial:** REPAIR_MISCONCEPTION never fires in production (see row 1); the cross-Course learner picture exists only
  as the planning scope of Global Today, with no cross-Course learner view; plan size is a single 15-item ceiling, not the
  accepted dynamic-size direction (OQ-016).
- **Missing:** exam urgency — a V1-required capability (`UNLOCK_V1_SCOPE.md` §6; Roadmap Run 010). Course `examDate` is
  authored, but the NBA EXAM_PRIORITY tier is explicitly deferred in code; OQ-002 OPEN; ADR-016 §11 "amplifier, not a
  gate". Learner-facing explainability of recommendations (OQ-018 DEFERRED;
  internal reasons exist, nothing is shown); F-01 empty frozen plan (mitigated, not resolved).
- **Pilot needs:** current behavior; learners join before first opening Today (F-01).
- **V1 but post-pilot (Run 010):** exam-urgency tier, confidence-gap signal (`UNLOCK_V1_SCOPE.md` §6).
- **Mature-only:** richer composition (OQ-017), fatigue/duration (`LEARNING_ENGINE.md` §37–§38).
- **Depends on:** 1; 4 (Topic/coverage); course exam dates.
- **Sources:** `LEARNING_ENGINE.md` §27–§31, §35–§36; ADR-016/017; Roadmap Run 010.
- **Trigger:** Roadmap Run 010 start, or pilot evidence that exam timing or unexplained selection hurts engagement.

### 3. Course / Topic Practice — M1 · B
- **Owns:** learner-initiated, bounded study inside a Course/Topic through the same pipeline, isolated from Today.
- **Proven:** ADR-020, `LEARNING_ENGINE.md` §39A and `UX_SPEC.md` §10 ACCEPTED; selector simulated with the real engine
  (`docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md`); P1 early-correct scheduling rule with real-FSRS tests (feature
  branch; no production path creates Practice Attempts yet).
- **Partial / Missing:** P2 selector + persistence, P3 API, P4 UI (`docs/CHATGPT_PLAN.md`).
- **Pilot needs:** not a pilot gate (`PILOT_READINESS.md` does not list it); it is the answer to "what do I do after Today".
- **Mature-only:** server-held Practice runs, Practice analytics.
- **Depends on:** 1, 2 (NBA ranking reused), 14 (eligibility/authz).
- **Sources:** ADR-020; `LEARNING_ENGINE.md` §39A; `UX_SPEC.md` §10; `docs/CHATGPT_PLAN.md`.
- **Trigger:** already active (Run UX-02).

### 4. Content Intelligence — M1 · C
- **Owns:** the structure and meaning of course content: Topics, source Material, coverage, concept relationships.
- **Proven:** flat Course-scoped Topics (ADR-018), Topic Progress/Insights over them.
- **Partial:** `materials` table and `questions.material_id` / `verification_state` exist in the initial schema but no
  code reads or writes them (placeholder).
- **Missing:** content provenance/source traceability in practice (`MASTER_SPEC.md` §48; imported rows carry no source
  reference); Material model decision (OQ-023 OPEN); Course structure depth (OQ-031); concept/prerequisite relations
  (`MASTER_SPEC.md` §56, deliberately not required).
- **Pilot needs:** Topics mapped to the instruction (`PILOT_READINESS.md` §3 item 5), done by humans.
- **Mature-only:** provenance-linked Questions, relationship intelligence (only with reliable evidence/review).
- **Depends on:** 9 (source ingestion is the natural provenance entry point).
- **Sources:** ADR-018; `MASTER_SPEC.md` §12, §48, §56–§57; OQ-023/031.
- **Trigger:** Run 011 design (PDF/AI) or a concrete provenance need (dispute/verification).

### 5. Question Intelligence / Pedagogy — M2 (structural) / M0 (pedagogical) · B
- **Owns:** whether a Question is valid and pedagogically good: answer-definition validity, wording, distractors,
  alignment, and a critic/verifier separate from any generator.
- **Proven:** publish-ready validation and answer-definition invariants (Run 006, `answer.ts`); import row validation;
  offline validator `scripts/validate-import.mjs` (structure, duplicate prompts, Topic coverage; parity-tested with Preview).
- **Partial:** pedagogical quality exists only as the human Content checklist (`PILOT_READINESS.md` §3 items 2–5).
- **Missing:** automated pedagogical quality checks; a question critic/verifier independent of the generator
  (`MASTER_SPEC.md` §47 verification states are an unimplemented direction).
- **Pilot needs:** human content review and sign-off only (Content Go/No-Go).
- **Mature-only:** deterministic lint-style pedagogy checks first, then AI critique that produces findings, never silent edits.
- **Depends on:** 9 (critic must precede trusting generated content), 11 (data-driven quality signals).
- **Sources:** ADR-009/014; `PILOT_CONTENT_VALIDATOR.md`; `MASTER_SPEC.md` §47, §57.
- **Trigger:** Run 011 scoping (a verifier is a precondition for AI generation) or recurring human-review defects in pilot content.

### 6. Lecturer Style Intelligence — M0 · D
- **Owns (proposed):** adapting question phrasing/format to a lecturer's assessment style.
- **State:** no ADR, spec, OQ or code references it; recorded here as an idea only.
- **Principle:** a layer **below** pedagogical quality (row 5). Style never overrides correctness or pedagogy.
- **Pilot needs:** none. **Mature-only:** all of it.
- **Depends on:** 5, 9, 10.
- **Sources:** none yet (this row).
- **Trigger:** a lecturer explicitly asks for style matching after pilot content work, with row 5 at M2+ pedagogically.

### 7. Instructor Intelligence — M3 · A
- **Owns:** aggregate, privacy-safe class understanding signals for OWNER/INSTRUCTOR.
- **Proven:** Item Analysis + Topic Insights with coarse first-answer bands behind the aggregate disclosure gate
  (`src/domain/insights/aggregate-disclosure.ts`), F-02 contract, Production-verified at `v0.1.0` (`DEV_STATUS.md`).
- **Partial:** hypothesis ("does this help the instructor?") untested (Roadmap Milestone D); manual refresh only.
- **Missing:** active/inactive learners, recurring misconceptions (blocked by row 1), Course-level readiness aggregation
  (OQ-030 DEFERRED; `LEARNING_ENGINE.md` §44), trends, Class Pulse / Teach Next (FUB-020), cohorts (FUB-021), learner
  drill-down (FUB-022).
- **Pilot needs:** current surface + the instructor script in `PILOT_READINESS.md` §5.
- **Mature-only:** the FUB-020..022 directions.
- **Depends on:** 1, 11, 12, 14 (privacy).
- **Sources:** `src/domain/insights/aggregate-disclosure.ts`; Roadmap Run 009; FUB-020..024.
- **Trigger:** pilot instructor-value signal (`PILOT_READINESS.md` §5 "Pilot signals").

### 8. Structured Import — M3 · A
- **Owns:** the canonical, format-independent content entry contract (adapter → canonical rows → validate → preview →
  confirm), producing DRAFT_ONLY Questions.
- **Proven:** Run 007/008 (JSON/CSV, size + row limits, all-or-nothing confirm); manual browser proof on the LOCAL app
  against HOSTED Supabase (not a Production-app verification); offline validator.
- **Partial:** confirm race vs concurrent archive accepted for a single-editor pilot (FUB-014); no XLSX.
- **Missing:** update/merge of existing Questions; bulk publish (deliberately excluded); a source/provenance field.
- **Pilot needs:** as is. It is the path for real Ruppin material (OQ-024 still OPEN on the exact entry route).
- **Mature-only:** XLSX, bulk persistence (FUB-014).
- **Depends on:** 5.
- **Sources:** Roadmap Run 007; `DEV_STATUS.md` "Structured Import V1"; `PILOT_CONTENT_VALIDATOR.md`.
- **Trigger:** real pilot material arrives (run the validator first), or row 9 design needs a provenance field.

### 9. AI / PDF Ingestion & Question Generation — M1 · C
- **Owns:** turning source material into **proposed** questions that enter the normal draft → review → publish path.
- **Proven:** design direction only (Roadmap Run 011; `MASTER_SPEC.md` §44–§51); IP/leakage risks analysed
  (`CONTENT_IP_THREAT_MODEL.md`).
- **Missing:** everything executable; OQ-038 (human approval) DEFERRED; OQ-023 Material model OPEN.
- **Pilot needs:** none (Roadmap: not required for the Ruppin pilot). External AI output may enter via Structured Import.
- **Mature-only:** in-product upload, extraction, generation, review queue.
- **Guardrails:** generation never creates learner evidence; instructor approval before publish (Roadmap Run 011);
  per product-owner direction (§1), output should feed the Structured Import contract rather than a parallel path.
- **Depends on:** 8, 5 (critic), 4 (provenance), 14 (content IP).
- **Sources:** Roadmap Run 011; ADR-004; `MASTER_SPEC.md` §44–§51; `CONTENT_IP_THREAT_MODEL.md`; OQ-038.
- **Trigger:** Roadmap Run 011 start after core loops are pilot-validated.

### 10. Legacy MCQ Extraction / Answer Resolution — M0 · C
- **Owns (proposed):** extracting existing multiple-choice items (e.g. old exams) and resolving missing/uncertain answer keys.
- **State:** no ADR, spec, OQ or code references it; recorded here as an idea only.
- **Principle:** AI-resolved answer keys are assessment content and require human verification (`PILOT_READINESS.md` §3
  item 2 already requires every key verified by a human).
- **Pilot needs:** none as a capability; if the lecturer supplies legacy items, they enter via Structured Import with human-verified keys.
- **Depends on:** 8, 9, 5.
- **Sources:** none yet (this row).
- **Trigger:** real pilot material turns out to be legacy MCQs without reliable keys.

### 11. Assessment / Item Intelligence — M1 · C
- **Owns:** item-level psychometrics: difficulty, discrimination, distractor health, answer-key suspicion.
- **Proven:** coarse first-answer bands per Question/Topic (row 7); `LEARNING_ENGINE.md` §14 separates memory difficulty
  from item difficulty; §32 QuestionStats boundary.
- **Missing:** all statistics beyond bands; per-option data is intentionally not exposed (F-02).
- **Pilot needs:** none. **These metrics are meaningful only once pilot data exists.**
- **Mature-only:** difficulty/discrimination/distractor health with small-n honesty; cross-version analysis (FUB-024).
- **Depends on:** 12, real cohort volume.
- **Sources:** `LEARNING_ENGINE.md` §14, §32–§33; `MASTER_SPEC.md` §57; FUB-024.
- **Trigger:** a pilot cohort produces enough first answers per item to exceed the disclosure gate across many items.

### 12. Product Analytics & Experimentation — M1 · A (baseline) / D (experimentation)
- **Owns:** measuring whether the product works: funnel, engagement, retention, experiment evaluation.
- **Proven:** answers, joins and plan-item completion are derivable from authoritative records (`attempts`,
  `course_memberships.joined_at`, `daily_plan_items`) — FUB-023.
- **Partial:** `daily_plans.started_at/completed_at/status` are never updated after insert (not authoritative).
- **Missing:** product event instrumentation (no `today_opened` etc.; `PRODUCT.md` §15), analytics provider decision
  (OQ-026 OPEN), KPI definitions (OQ-019..022), experimentation of any kind.
- **Pilot needs (map assessment):** the minimum in §5, preferring derivation from authoritative records. Owner status:
  FUB-023 is DEFERRED ("no event log … during the pilot without evidence"); `PILOT_READINESS.md` §3 does not list it.
- **Mature-only:** event store, dashboards, A/B testing.
- **Depends on:** 15.
- **Sources:** FUB-023; OQ-019..022, OQ-026; `MASTER_SPEC.md` §41–§42; `LEARNING_ENGINE.md` §43.
- **Trigger:** before a real cohort (Pilot Evidence Gate).

### 13. UX / Accessibility / Performance — M2 · A
- **Owns:** learner/instructor experience quality: Hebrew/RTL/mobile, Learn Mode, a11y, latency.
- **Proven:** UX-01 learner shell and Learn Mode (mocked browser evidence; `UX_SPEC.md` §8); Today flow on real phones
  (S4); Today a11y spot-checked at 375/320 px.
- **Partial:** a11y walkthroughs of login/join/Progress/instructor flows not done; Today p95 4.85 s at 30 learners
  (FUB-026 round-trip reduction deferred); no Hebrew `not-found`/`error` boundaries.
- **Missing:** measured authenticated single-user timings; instructor UX pass.
- **Pilot needs:** mobile/RTL usable, no blocking latency (`PILOT_READINESS.md` §5 GO criteria).
- **Mature-only:** systematic a11y audit, performance budget.
- **Sources:** `UX_SPEC.md`; `PILOT_READINESS.md`; FUB-026; `CHATGPT_PLAN.md` carried-over Slice B table.
- **Trigger:** Preview walkthrough with a QA learner; pilot friction reports.

### 14. Trust / Security / Privacy — M2 (authz at M3) · A
- **Owns:** identity, authorization, data minimisation, learner privacy, content IP, abuse resistance.
- **Proven:** auth before DB/body on protected routes; explicit CourseMembership authorization (ADR-015); aggregate
  disclosure gate; learner-safe content reads (no correct answer); `npm audit` clean (Run 008); security reviews per Run.
- **Partial:** login page is frameable (framing decision open, Slice B Q6a); session-expiry recovery UX gaps.
- **Missing:** privacy/legal pages (Roadmap Run 012), data deletion semantics (OQ-027 OPEN), pilot data ownership
  (OQ-039 OPEN), rate limiting/abuse hardening (FUB-011), F-04b archived-Course decision.
- **Pilot needs (map assessment):** a basic privacy notice and a data-ownership answer for a real student cohort (OQ-039);
  framing decision. Owner status: privacy pages sit in Roadmap Run 012; OQ-027 targets destructive deletion flows;
  `PILOT_READINESS.md` §3 lists none of these — a human decision is needed to add them to the pilot checklist.
- **Mature-only:** rate limiting, CSP, RLS if ever adopted (OQ-025).
- **Sources:** `.claude/rules/auth.md`, `api.md`; ADR-015; `CONTENT_IP_THREAT_MODEL.md`; OQ-025/027/039; FUB-011.
- **Trigger:** before a real cohort (privacy/ownership); any new data surface.

### 15. Platform / Operations / Observability — M2 · A (minimum)
- **Owns:** deploy/release, CI, database operations, backup/recovery, runtime visibility.
- **Proven:** ADR-019 release model (`main` = Production, `v0.1.0`); CI typecheck/lint/unit; hosted migrations aligned;
  pooler + TLS config; manual logical backup; route handlers log unexpected errors (Vercel function logs).
- **Partial:** CI excludes schema suite, build and E2E by design; no required status checks on `main`.
- **Missing:** runtime error monitoring/alerting (FUB-008), restore drill/RPO/RTO (FUB-009), Vercel failed-build behavior
  unverified, SMTP/Auth email capacity decision (`PILOT_READINESS.md` §3 item 11).
- **Pilot needs:** SMTP decision (`PILOT_READINESS.md` §3 item 11). Map assessment, not in §3: someone watching errors
  during class windows and a known recovery path. Owner status: FUB-008/009 are DEFERRED post-pilot (FUB-008: no
  provider now); Roadmap Run 012's exit condition ("usable by a real pilot cohort") points the other way — unresolved.
- **Mature-only:** staging, automated alerting, scale hardening (Roadmap Run 012).
- **Sources:** ADR-019; `DEV_STATUS.md`; FUB-007/008/009; `PILOT_READINESS.md` §2.
- **Trigger:** before a real cohort (minimum); more developers/cohorts (Run 012).

### 16. Growth / SEO / Public Web — M0 · D
- **Owns:** public/marketing surfaces and discoverability.
- **State:** root page is a heading + "go to Today" link; app-level `metadata` only; no robots/sitemap/landing content.
- **Principle:** SEO applies to public/marketing surfaces, never to authenticated learner screens.
- **Pilot needs:** none (learners arrive via join link/QR).
- **Sources:** `src/app/page.tsx`, `src/app/layout.tsx`.
- **Trigger:** a decision to acquire users beyond invited cohorts.

### 17. System Auditor / Quality Intelligence — M0 · C
- **Owns (direction):** evaluating whether UNLOCK itself behaves as intended (e.g. strong Questions resurfacing too
  often, learners trapped in loops, completion drop after an engine change).
- **State:** `MASTER_SPEC.md` §58 direction only. Dev-time proxies exist (golden scenarios, invariant matrix, content
  validator, engine versioning) but are not runtime product auditing.
- **Pilot needs:** none beyond row 12's baseline.
- **Mature-only:** findings-first auditing over analytics; never autonomous engine modification.
- **Depends on:** 12, 1, 2 (engine version on every write enables before/after comparison).
- **Sources:** `MASTER_SPEC.md` §58; `LEARNING_ENGINE.md` §47–§49; `docs/INVARIANT_MATRIX.md`.
- **Trigger:** first engine change shipped after real usage exists (compare cohorts across engine versions).

## 4. Strategic Gaps (repository-evidenced)

| Gap | Row | Evidence | Priority |
|---|---|---|---|
| Confidence evidence not captured → misconception detection inert in production (V1-required, `UNLOCK_V1_SCOPE.md` §6) | 1, 2, 7 | Today client body; OQ-014 OPEN | A decision / B build (Run 010) |
| Product event instrumentation before a real cohort | 12 | FUB-023 (DEFERRED), OQ-026 | A minimum (map assessment; needs decision) |
| Pilot-minimum operations, monitoring and recovery | 15 | FUB-008/009 (DEFERRED post-pilot) | A (map assessment; needs decision) |
| Pilot-minimum privacy (notice, data ownership) | 14 | OQ-039; Roadmap Run 012 | A (map assessment; needs decision) |
| Exam urgency (V1-required, `UNLOCK_V1_SCOPE.md` §6) | 2 | deferred tier in NBA code; OQ-002 | B (Run 010) |
| Explainability of recommendations (learner-facing) | 2 | OQ-018 DEFERRED | B |
| Cold-start / diagnostic intelligence beyond New Material | 1, 2 | ADR-017; `LEARNING_ENGINE.md` §31 | C |
| Course-level readiness aggregation | 7 | OQ-030 DEFERRED; `LEARNING_ENGINE.md` §44 | C |
| Cross-Course learner picture (beyond Global Today planning) | 1, 2 | Progress is per-Course | C |
| Content provenance / source traceability | 4, 9 | unused `materials` placeholder | C (with Run 011) |
| Pedagogical question-quality checks; critic/verifier separate from generator | 5, 9 | `MASTER_SPEC.md` §47 | B before any AI generation |
| Lecturer-style personalization (below pedagogy) | 6 | none | D |
| Item difficulty / discrimination / distractor health | 11 | needs pilot data | C |
| Performance: Today p95 under class load | 13 | FUB-026 (owner priority LOW) | B (map assessment) |
| SEO for public/marketing surfaces only | 16 | none | D |

## 5. Pilot Evidence Gate

**Question:** before a real cohort enters UNLOCK, can we measure whether the product is working educationally,
product-wise and technically?

**Current answer: partly.** Educational and completion signals are derivable from authoritative records. "Opened but did
not start" behavior, runtime errors and latency are not observable without manual effort. This gate adds no Run and does
not change the UX-02 sequence, and it is **not a release gate**: the binding pre-pilot checklist is `PILOT_READINESS.md`
§3. It is this map's assessment of the minimum measurement baseline, to be confirmed (or consciously accepted as manual)
by a human decision, which would then be recorded in `PILOT_READINESS.md`.

| Signal | Source today | Status |
|---|---|---|
| Invite → signup → join | `users`, `course_memberships.joined_at` | derivable |
| First Today (plan generated) | `daily_plans.generated_at` | derivable (first request per day only) |
| Today opened / started | none | **missing** (FUB-023 `today_opened`) |
| Today completion | `daily_plan_items.status/completed_at` (not `daily_plans.status`) | derivable |
| Return usage (e.g. 3 distinct days/week) | `daily_plan_items`, `attempts` | derivable |
| Practice usage (once UX-02 ships) | Attempts with no DailyPlanItem, `learning_session_id` | derivable after P2 |
| Instructor create / import / publish | `courses`, `questions`, `question_versions` | derivable |
| Basic latency / error evidence | Vercel Runtime Logs (manual) | manual only |
| Monitoring / recovery readiness | manual log watching; manual backup, no restore drill | manual only |

Proposed decisions for the owner (`PILOT_READINESS.md`) before the cohort: (1) whether derivation + manual log watching is acceptable for the pilot, or a
minimal `today_opened` observation is needed (FUB-023 / OQ-026); (2) who watches Runtime Logs during class windows;
(3) the recovery path if data is damaged (FUB-009). Pilot signals and GO/NO-GO criteria remain owned by
`PILOT_READINESS.md` §5.

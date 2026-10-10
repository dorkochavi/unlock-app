# UNLOCK — Ruppin Pilot Content Intake Protocol

Status: ACTIVE (Pilot V1). Decision: OQ-024 resolved 2026-10-10 (human-approved). Gates: `docs/PILOT_READINESS.md` §3, §5. Countdown: `docs/MASTER_PILOT_COUNTDOWN.md` P2.

## Flow
SOURCE RECEIVED → source inventory → Course/Topic mapping → preparation outside UNLOCK if needed → canonical Structured Import / Authoring input → Preview → DRAFT_ONLY → answer-key verification against source → Hebrew review → distractor review → alignment review → Publish → content-owner sign-off → Pilot content freeze.

## Formats
- **Operationally accepted sources:** PDF, DOCX, slides, Google Docs, legacy questions, any human-readable source.
- **UNLOCK itself accepts:** Instructor Authoring (draft save, explicit publish) and Structured Import V1 (JSON/CSV, preview/confirm, enters DRAFT_ONLY). No XLSX/PDF/OCR/AI ingestion in the product.
- **Outside the product (allowed):** reading, extraction, restructuring, drafting question text — manual or AI-assisted — producing JSON/CSV or authoring input. Output of such tooling is unverified until the human steps below.
- Validate the import file with `docs/PILOT_CONTENT_VALIDATOR.md` before import.

## MUST be human-approved
- every answer key, checked against the source (not against the prep tool);
- Hebrew wording; distractors; Topic + instruction alignment;
- every Publish (nothing auto-publishes; Structured Import never publishes);
- final sign-off by the instructor/content owner (name + date).

The human Content QA gate is authoritative; Assessment Engine lint output is advisory only (FUB-076 frozen for Pilot).

## Evidence to record (Run report or PILOT_READINESS evidence note)
Source inventory (files, versions); Course/Topic mapping; import file name + Preview result; per-question key-verification status; reviewer names/dates for Hebrew, distractor and alignment review; published count vs. needed pool + margin; learner-account check (no draft/test/internal content visible); sign-off (name/date); freeze point (commit/date).

## Verdict
- **Content GO:** all `PILOT_READINESS.md` §3 items 1–9 satisfied, evidence recorded, sign-off present.
- **Content FAIL:** any wrong key, unclear Hebrew, misaligned Question, or visible test/draft/internal content.
- **Content BLOCKED:** material or reviewer unavailable (current state: BLOCKED — WAITING_FOR_RUPPIN). Never infer GO from a Course merely having Questions.

## Freeze
After sign-off: no re-publish of Questions and no Topic reassignment once classroom answering starts (§3 items 9–10). Any later content change reopens Content GO.

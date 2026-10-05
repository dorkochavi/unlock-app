# ADR-021: Pilot Learner Data Notice (OQ-039, Option C)

Status: ACCEPTED (2026-10-05) — [HUMAN_DECISION 2026-10-05]. A Pilot operating decision, NOT a Privacy Policy and NOT legal advice.

## Context

OQ-039 asked who owns or controls Materials, Questions, edits, learner Attempts, aggregate insights, exports and deletion requests in
instructor/class pilots, and what learners are told (`docs/PILOT_READINESS.md` §3 item 13(d)). Options A/B/C are in
`docs/PILOT_EVIDENCE_OPERATIONS.md` §6. The product has no learner export or deletion path, and backups (`docs/BACKUP_DR_POLICY.md`) contain learner data.

## Decision

**Option C for the Pilot: notice now; final ownership/export/deletion model deferred.**

1. UNLOCK may retain learner data needed to operate the product, support adaptive learning, troubleshoot the Pilot and evaluate Pilot usage.
2. Learners must receive the notice below before or during onboarding.
3. No claim of final legal ownership of learner data, by UNLOCK or the institution.
4. No promise of a self-service export flow, and no promise of immediate or full deletion.
5. Backups contain learner data; any future deletion policy must define backup treatment explicitly.
6. Sharing small-cohort or learner-identifiable data beyond authorized Pilot operation stays constrained by this notice and future policy (operator-only aggregates remain the Pilot assumption).
7. Final ownership, export, deletion, retention and broader data-governance policy require later product/legal review (`FUB-050`).

### Pilot notice text (Hebrew, canonical wording)

> במהלך הפיילוט UNLOCK שומרת נתוני שימוש ולמידה הנדרשים להפעלת המערכת, להתאמת חוויית הלמידה, לתמיכה טכנית ולהערכת הפיילוט. הנתונים ישמשו רק לצורכי הפעלת הפיילוט ויהיו נגישים רק לגורמים מורשים לכך. בשלב הפיילוט אין עדיין אפשרות עצמאית לייצוא או למחיקה מלאה של הנתונים. מדיניות מלאה בנושא בעלות על הנתונים, ייצוא ומחיקה תיקבע לפני שימוש רחב יותר במערכת. עותקי גיבוי עשויים לכלול גם נתוני למידה.

Not a final Privacy Policy. Display in the product UI is NOT implemented (see Consequences).

## Consequences

- Pilot item 13(d) is satisfied for the Pilot baseline once the notice is actually shown to learners (human-owned delivery or UI follow-up). Long-term legal/data-governance is NOT resolved; export/delete are NOT implemented.
- UI placement (e.g. sign-up/join surface) is an implementation follow-up under `FUB-050`; until then the Pilot operator must present the text before onboarding.
- OQ-039 is removed from `docs/OPEN_QUESTIONS.md` (resolved questions live in decisions).

## Related Documents

- `docs/PILOT_READINESS.md` §3 item 13(d); `docs/PILOT_EVIDENCE_OPERATIONS.md` §6 (option analysis, historical); `docs/BACKUP_DR_POLICY.md`; `FUB-050`.

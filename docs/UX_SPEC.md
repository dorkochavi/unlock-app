# UNLOCK — Learner UX Specification

Status: ACTIVE — canonical UX authority for the learner experience
Owner: learner UX direction (navigation model, Learn Mode, visual system principles)
Introduced: Run UX-01 — Learner UX Foundation (2026-09-26)

This document records UX decisions that were already made. Implementation follows it; it is not redesigned during implementation. Product/learning semantics remain owned by the ADRs and canonical product docs; this spec only governs how they are presented. Where this spec and a Plan disagree, resolve it explicitly (`PLAN_CONFLICT` only for a real contradiction with approved scope/spec or repository constraints).

Deferred or temporary items are collected in [§9](#9-temporary-bridges-and-deferred-items).

---

## 1. Product Model

1. Main learner navigation has exactly three primary areas: **Today**, **My Courses**, **Progress**.
2. There is no top-level Practice tab.
3. **Today** is the system-selected learning path:
   - UNLOCK decides what is most useful to study now;
   - Today is finite;
   - finishing Today is a real success state, not an empty state;
   - Today must not become an infinite feed.
4. **My Courses** is the learner-selected learning context: the learner chooses the Course; in future Course Practice, UNLOCK will choose the questions inside that scope.
5. **Progress** is not only reporting. It follows *diagnosis → action*: where a valid existing action exists, the learner can act from the progress state.
6. **Browse Mode and Learn Mode are distinct.**
   - Browse Mode: Today (landing/complete), Courses, Course, Progress.
   - Learn Mode: the Today question flow; future Course Practice; future Topic Practice.
7. **Learn Mode removes normal navigation chrome:** no bottom/main navigation while answering; minimal header/context; focus on the question, feedback and next action.
8. **One visually dominant primary CTA per screen/state.**
9. All learning modes eventually use one learning pipeline: *Question → Answer → Feedback → Attempt → Progress → FSRS.* Course/Topic Practice must not become a second Learning Engine.
10. Course/Topic Practice was not part of Run UX-01. It is planned for Run UX-02 under ADR-020 (session/Today invariants) and `LEARNING_ENGINE.md` §39A (scheduling/selection policy); see §10.
11. Practice sessions are bounded, not endless: 10 questions, then an explicit option to continue with another 10 (§10).
12. There is no separate Topic page in V1 (accepted for Run UX-02). Topic information stays on the Course and Progress surfaces; Topic Practice starts from a Topic row there (§10).

## 2. Today

13. Today landing answers immediately: "What should I do now?"
14. Today uses one clear primary CTA: "התחל ללמוד" or "המשך ללמוד".
15. **Today Complete** communicates success; uses only real data already available in the current DTO/state; does not invent metrics; does not require API/schema changes for richer summary data.
16. Today Complete primary CTA: "המשך ללמוד" → `/courses` (temporary bridge until Course Practice exists; see §9).
17. Optional secondary/tertiary action: "לצפייה בהתקדמות" → `/progress`.
18. No meaningless "סיימתי להיום" navigation action; the completion state itself already means the learner is done.

## 3. Courses / Course

19. Course cards help the learner understand what the Course is, the current learning state, and what is worth doing next (using existing data only).
20. The Course page should eventually have one primary "continue learning" action, but Run UX-01 must not expose fake Course Practice. Use only valid existing behavior/destinations, or omit the future action.
21. Topic rows stay lightweight and are actionable only where a real existing action exists. No "תרגל" buttons that do nothing.

## 4. Progress Language

22. Learner-facing progress is primarily qualitative, not fake-precision numerical mastery: `NOT_STARTED`, `IN_PROGRESS`, `NEEDS_REINFORCEMENT`, `SOLID`.
23. Numeric analytics may exist later; percentages are not the primary learner language.

## 5. Learn Mode

24. Learn Mode uses: constrained content width; minimal chrome; clear context; a subtle progress indicator; large readable question text; large touch-friendly answer options; stable primary-CTA placement where practical.
25. Question state model: `default → selected → submitted → feedback`.
26. Feedback is inline, not modal.
27. Wrong answers are learning feedback, not punitive system errors. No aggressive error styling for ordinary incorrect answers.
28. Real errors and destructive actions are visually distinct from ordinary wrong answers.
29. After answering: preserve question context; show explanation/feedback (only what the current response provides); present one clear "המשך" CTA.
30. Accessibility: keyboard operability; visible focus; feedback announced with appropriate status semantics; sensible focus management after answer/continue; mobile-suitable touch targets; no horizontal overflow.

## 6. Visual System

31. Personality: calm, intelligent, mature, modern, human. Not a traditional LMS, not childish, no heavy gamification.
32. Hebrew/RTL-first.
33. Mobile-first: mobile is a first-class design, not a shrunk desktop.
34. One primary brand color; otherwise mostly neutral UI.
35. Semantic status color roles:

    | Role | Meaning |
    | --- | --- |
    | green | `SOLID` / positive success |
    | amber / orange | `NEEDS_REINFORCEMENT` |
    | primary / indigo family | `IN_PROGRESS` |
    | gray | `NOT_STARTED` |
    | red | actual error / destructive state only |

36. Do not freeze arbitrary hex values in this spec; prefer semantic design tokens.
37. Generous whitespace and clear hierarchy.
38. Cards represent real content units only; avoid card-inside-card proliferation.
39. Button hierarchy: primary, secondary, tertiary/text. Do not make every action visually equal.
40. Question typography is visually stronger than surrounding UI metadata.
41. Icons are functional, not decorative; avoid icon clutter.
42. Progress indicators are subtle; avoid large gamified meters unless later evidence justifies them.
43. Foundation tokens (owner: `src/app/globals.css`; additive; color tokens have light + dark values; muted/subtle text >= 4.5:1 on background/surface/surface-muted):
    - Radius: `rounded-control` (inputs/buttons), `rounded-card` (cards/rows), `rounded-surface` (large panels); chips stay `rounded-full`.
    - Elevation: one subtle `shadow-raised`; separation is otherwise by border.
    - Controls: `min-h-control` (44px tap target), `min-h-control-compact`, `h-control`.
    - Type roles: `text-page`, `text-title`, `text-section`, `text-body` (16px), `text-secondary` (15px), `text-meta` (13px), each with Hebrew-friendly line height; body default line-height 1.6.
    - Focus: one global `:focus-visible` ring (`--ring` = primary) in `@layer base`.
    - Disabled: `state-disabled` utility (muted surface + `subtle` text, not bare opacity).
    - Layout: `page-container` (max width + logical gutter; `--container-max`, `--gutter`).

## 7. Component / Implementation Principles

43. Reuse first, but do not abstract for abstraction's sake.
44. Extract only patterns proven shared by UX-1/UX-2.
45. Candidate primitives: `Button`, `StatusPill`, `Card`/`Row`, `StateBlock`, `PageHeader`. Learn-specific primitives may include `QuestionOption`, `QuestionProgress`, `FeedbackBlock` — only if genuinely reused/needed. No fixed component count.
46. No new UI framework, Tailwind plugin or component library for Run UX-01.
47. No wholesale page rewrites unless required by a real constraint.
48. No Learning Engine, API or schema changes in UX-1 or UX-2.
49. No fake functionality.
50. Temporary bridges are documented explicitly (§9) so UX-3 can replace them.

## 8. Verification Boundary (Run UX-01)

51. Mocked Playwright + screenshots validate UX states and interaction behavior only.
52. They do **not** prove real authenticated Supabase integration.
53. Verify at minimum: 375px mobile; desktop; RTL; keyboard; loading; error; signed-out; empty; Today complete; long Hebrew text; long Course/Topic names where applicable; selected/correct/incorrect; focus after feedback; no horizontal overflow; one dominant primary CTA; predictable exit/back behavior.
54. Missing optional presentation metrics are not automatically `PLAN_CONFLICT`. Use the smallest honest implementation supported by current capabilities and document the deferred intended behavior.
55. `PLAN_CONFLICT` is reserved for a real contradiction with approved scope/spec or repository constraints.

## 9. Temporary Bridges and Deferred Items

Each entry names its intended replacement so UX-3 can remove it deliberately. Run UX-02 decisions (accepted) are
in the third column; §10 describes the Practice surface.

| Item | Run UX-01 behavior | Intended later behavior |
| --- | --- | --- |
| Today Complete primary CTA "המשך ללמוד" | Routes to `/courses` (existing surface) | DECIDED (not a bridge any more): stays → `/courses`. Today does not auto-start a recommended Practice session; Practice begins only after the learner chooses a Course/Topic scope |
| Course page primary "continue learning" action | LEARNER: no primary learning action. A SECONDARY navigation link "לעבור להיום שלי" → `/today` (honest navigation, not a promise of available learning — Today may already be complete). No replacement primary action is invented. OWNER/INSTRUCTOR: primary "לניהול הקורס" → instructor Course page. No fake Practice | DONE (Run UX-02 P4): LEARNER primary "תרגול בקורס" (only when the server says `practiceAvailable`) starts Course Practice; "לעבור להיום שלי" stays secondary |
| Course card learning state (item 19) | Not shown: needs a Course-level rollup of Topic states that no accepted policy defines; cards show title and role only | Course-level state summary once a rollup rule is decided |
| Progress "diagnosis → action" (item 5) | No primary learning action. A SECONDARY navigation link "לעבור להיום שלי" → `/today` (honest navigation, not a promise of available learning — Today may already be complete); Course headings link to the Course page; Topic rows informational. No replacement primary action is invented | DONE (Run UX-02 P4): each Topic row with published Questions is one Topic Practice link; the Today link stays secondary; no page-level primary learning CTA is invented |
| Topic "practice topic" CTA / Topic page | Not shipped; Topic info stays on Course/Progress | DONE (Run UX-02 P4): no Topic page; Topic Practice starts from Topic rows on Course/Progress |
| Bounded practice sessions (10 + "another 10") | Not implemented | DONE (Run UX-02 P4): batches of up to 10, explicit "עוד 10", honest "nothing more for now" (§10) |
| Richer answer feedback / Today Complete summary | Only data already in the current DTO/response | Richer explanation and summary if data becomes available |

The Early Practice + FSRS semantics decision is recorded in ADR-020 (session identity, Today isolation) and `LEARNING_ENGINE.md` §39A (scheduling, selection), both ACCEPTED for Run UX-02.

## 10. Course / Topic Practice (Run UX-02 — ACCEPTED 2026-09-26)

Learning semantics are not defined here: session identity and Today isolation → ADR-020; scheduling, selection and
Skip semantics → `LEARNING_ENGINE.md` §39A. This section governs presentation only. The full affordance matrix and
the evidence behind it: `docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md` §1.

### Entry points (learner-chosen scope only)

- **Course page:** primary "תרגול בקורס", directly under the header and above the existing secondary
  "לעבור להיום שלי". Rendered only when the server says the Course is practiceable for this learner
  (`practiceAvailable`: LEARNER, active non-archived membership, PUBLISHED Course); otherwise absent — never
  disabled.
- **Topic rows (Course page and Progress, shared component):** each practiceable Topic row becomes ONE link — name,
  coverage, state pill and a trailing "תרגול ›" in the primary color; accessible name "תרגול בנושא {name}, {state}";
  row height ≥ 56 px. Only Topics with published Questions; archived Topics are not listed (ADR-018).
- **Intentionally absent:** Today landing, Today Learn Mode, Today Complete (keeps "המשך ללמוד" → `/courses`, never
  auto-starts Practice), My Courses cards, bottom navigation, a page-level primary on Progress, any non-LEARNER or
  non-practiceable context.

### Practice screen (`/courses/:courseId/practice`, optional Topic; Learn Mode throughout)

- **Learn Mode** exactly as Today (§5): nav hidden, context bar, `QuestionCard`, inline feedback, focus rules. The
  context bar title is the scope (Course title or Topic name); progress reads "שאלה N מתוך M" for the current batch.
- **Actions per question:** primary "שליחה" → "המשך"; tertiary "דלג" (no evidence: no Attempt, never counted as
  wrong; the Question is not offered again in this Practice run); tertiary "יציאה".
- **Practice run vs learning session:** a *Practice run* is the current continuous visit on the Practice screen (one
  or more batches). It is a presentation concept only, not the canonical learning-day session (ADR-020). A refresh or
  leaving and re-entering Practice starts a new Practice run and may clear skipped-Question exclusions in V1
  (accepted). Answered Questions stay excluded for the whole learning day regardless.
- **Exit and back:** "יציאה" and the browser back button return to the surface Practice was started from (Course
  page or Progress, carried as an explicit whitelisted origin, not browser history). Answers already submitted are
  saved; an unsent selection is simply dropped.
- **Batch end:** a calm card "סיימת סבב תרגול" with "ענית על X · דילגת על Y" (counts only — no correct count,
  score or percentage); primary "עוד 10" only when more Questions remain; tertiary "חזרה לקורס" / "חזרה להתקדמות".
  Focus moves to the card title.
- **No more questions** (at start or after a batch): neutral state "אין כרגע עוד שאלות לתרגול כאן" with
  "חזרות נוספות יופיעו בתוכניות הלמידה הבאות."; secondary way back; no primary; not styled as an error.
- **Errors and session expiry:** batch load error → error state with "ניסיון נוסף"; answer failure → inline red
  error, selection kept; expired session while loading → sign-in with `next=` back to this Practice screen; expired
  session while answering → "התשובה האחרונה שלך לא נשמרה" (as on Today); a Question that became unavailable
  (e.g. new version) → short neutral notice and move on, no evidence recorded.
- **Honesty:** copy never says Practice changes today's plan; feedback for a wrong answer refers to future learning
  plans (as on Today).

## 11. UNLOCK Experience Principles & Non-Goals (Run UX-03, product-owner APPROVED — durable)

Canonical across learner AND instructor/auth/authoring/import surfaces (§1-§10 above remain the learner-specific
authority; this section is the whole-product experience contract). Recorded at the UX3-1 human checkpoint after
reviewing the visual-system direction; governs UX3-2 onward and any future UX work.

**Principles:**
1. Calm, mature, professional — clear, focused, not childish, not noisy.
2. Simple outside, intelligent inside — complexity belongs in the Learning Engine; the UI reduces decisions, it does
   not expose internal complexity.
3. One dominant page-level primary action per screen/state — applies to instructor surfaces too, not only Learn
   Mode. Secondary/tertiary actions stay visibly subordinate. A local form action may matter, but must not compete
   visually with the page-level primary unless the current state genuinely requires it.
4. Mobile-first does not mean mobile-stretched-to-desktop — mobile stays compact and obvious; desktop uses width,
   grouping and density intentionally. Do not leave a narrow phone-like column centered in a wide viewport without a
   product reason. Instructor/authoring surfaces may appropriately be denser and wider than learner learning
   surfaces.
5. Cards are for meaningful grouping — avoid card soup; do not wrap every section in the same bordered container
   merely by habit; use hierarchy, whitespace, layout and grouping deliberately.
6. Motion explains state — no decorative motion for its own sake; no animation may delay a user action; honor
   `prefers-reduced-motion`.
7. Perceived performance matters — immediate acknowledgement, layout-preserving loading, skeletons where they
   reduce visual jump, avoid blank-screen transitions.
8. Familiar interaction patterns, innovation at the product-decision layer — do not reinvent buttons, forms or
   navigation to look unique; UNLOCK's differentiation is what it learns over time and what it recommends next, not
   novel UI mechanics.
9. Do not expose implementation intelligence — FSRS, scheduler internals, ranking internals, evidence mechanics stay
   invisible to learners/instructors unless a future product decision explicitly requires otherwise.
10. Avoid fake precision — do not surface exact-looking mastery/learning precision unless the evidence/model truly
    supports it (see §4 item 22-23, already binding for learner Progress).

**Explicit non-goals / anti-patterns** (product-experience boundaries, not references to specific competing
products): heavy gamification (Duolingo-style streak pressure, hearts, XP everywhere); childish/overly playful
visual language; traditional heavy-LMS complexity; dense dashboard-metric overload; a generic-chat-box product
experience; card soup; mobile layout merely stretched onto desktop; multiple equal-weight primary CTAs; decorative
animation; guilt/dark-pattern engagement pressure; fake precision; exposing FSRS/scheduler/engine internals as
normal UX; adding complexity merely to appear innovative.

**Reference-product principle:** respected existing products may be used as *interaction* references (calm density
and action placement, predictable navigation, clear CTA hierarchy, strong desktop use of space, professional
semantic color use, immediate feedback, guided next-action clarity) — never as visual templates. Never copy
branding, layouts or visual identity from an external product. Do not introduce playful/gamified styling unless
already justified by UNLOCK's own product language.

**Destructive-action hierarchy:** a Course-level (or otherwise higher-stakes) destructive/lifecycle action uses a
restrained *danger-secondary* treatment (outlined, danger-toned); a lower-stakes/local destructive action (e.g. a
Topic row) uses a *danger-tertiary* text-level treatment. Both read as the same semantic danger family without
receiving identical visual weight (`Button` variants `dangerSecondary`/`dangerTertiary`, §7).

## 12. Component / Implementation Principles (instructor + shared surfaces)

Extends §7 (learner-scoped) to the whole product:
56. `Button` variants: `primary`, `secondary`, `tertiary`, `dangerSecondary`, `dangerTertiary` — the two danger
    variants exist so a component never needs a `className` override that fights the shared component's own base
    sizing/color classes (no `tailwind-merge`/`cn` helper exists in this repo; conflicting Tailwind utility classes
    passed via `className` do not reliably override a component's own classes — cascade order follows Tailwind's
    internal stylesheet order, not JSX class-string order). A genuinely different size/shape than any existing
    variant provides is a plain element with explicit token classes, not a `Button`/`Input`/`Select` with a
    conflicting override.
57. Desktop composition on Browse-mode/authoring pages is a deliberate layout decision per page (wider container,
    grouping, optional multi-column), not a fixed `max-w-2xl` applied everywhere out of habit — but Learn Mode's own
    constrained-width rule (§5 item 24) is unchanged.
58. Sign-out (Run UX-03-QA1 Finding 12): ONE shared top-left affordance per authenticated shell — the learner shell's
    `LearnerUtilityBar` (`src/app/(learner)/learner-utility-bar.tsx`, rendered once by `layout.tsx` above every
    Browse-mode page) and the instructor shell's own header (`src/app/instructor/layout.tsx`). Never a per-page local
    sign-out button. "Top-left" is achieved via a `justify-between`/`justify-end` row's trailing child, which already
    renders on the visual left in this RTL-first app (no manual left/right logic). Hidden during Learn Mode — it must
    never render simultaneously with Learn Mode's own `יציאה`; the two are structurally mutually exclusive, not
    visually de-emphasized against each other.

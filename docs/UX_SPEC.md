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
10. Course/Topic Practice is deferred and is **not** part of Run UX-01. Its implementation is blocked by an explicit Early Practice + FSRS semantics decision.
11. Future Practice sessions are bounded, not endless. Current product assumption: 10 questions, then an explicit option to continue with another 10. Deferred behavior; not implemented in Run UX-01.
12. A Topic page is **not** part of Run UX-01. Topic information stays on existing Course/Progress surfaces. A future Topic page belongs with deferred Topic Practice work.

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

Each entry names its intended replacement so UX-3 can remove it deliberately.

| Item | Run UX-01 behavior | Intended later behavior |
| --- | --- | --- |
| Today Complete primary CTA "המשך ללמוד" | Routes to `/courses` (existing surface) | Enters Course Practice for the most appropriate Course (UX-3) |
| Course page primary "continue learning" action | LEARNER: "המשך ללמוד ב'היום שלי'" → `/today` (Today already pools this Course's items); OWNER/INSTRUCTOR: "לניהול הקורס" → instructor Course page. No fake Practice | Starts Course Practice (UX-3) |
| Course card learning state (item 19) | Not shown: needs a Course-level rollup of Topic states that no accepted policy defines; cards show title and role only | Course-level state summary once a rollup rule is decided |
| Progress "diagnosis → action" (item 5) | Single primary "המשך ללמוד" → `/today`; Course headings link to the Course page; Topic rows informational | Per-Topic action (Topic Practice, UX-3) |
| Topic "practice topic" CTA / Topic page | Not shipped; Topic info stays on Course/Progress | Topic page with one primary practice CTA (UX-3) |
| Bounded practice sessions (10 + "another 10") | Not implemented | Session model with explicit continue (UX-3) |
| Richer answer feedback / Today Complete summary | Only data already in the current DTO/response | Richer explanation and summary if data becomes available |

Course/Topic Practice remains blocked by the Early Practice + FSRS semantics decision; whether that decision needs an ADR or belongs in an existing canonical learning document is determined after UX-1/UX-2.

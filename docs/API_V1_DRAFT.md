# UNLOCK API Boundary — V1 Draft

Status: DRAFT — preparation for the next checkpoint, not an ADR and not
implemented. No route files exist yet under `src/app/` (verified — it is
still the default Next.js scaffold). This document exists so that
checkpoint can start from a considered shape instead of an improvised one,
per this session's own instruction not to build insecure routes ahead of
Auth.

This is deliberately NOT canonical the way an ADR is: it records a shape to
build FROM, not a decision already made. Promote the settled parts into an
ADR once Auth exists and the shape has actually been implemented against it.

## Why this stays undecided/unimplemented for now

`submitAnswer`/`getOrCreateTodaySession` both require a real, trusted
`userId` — currently, nothing in this repository authenticates anyone.
`docs/ARCHITECTURE.md` §31: "the UI is not a security boundary... never
assume that hiding a button prevents unauthorized actions." A route that
accepted `userId` from request JSON today would be trivially spoofable —
worse than not having the route at all, because it would look secure. So:
no route is added in this session. This document exists so the eventual
route is designed correctly on day one, not retrofitted.

## 1. `submitAnswer` route shape

```
POST /api/learning/submit-answer
```

Request DTO (`SubmitAnswerRequestDto`) — deliberately NOT the same type as
`SubmitAnswerCommand` (`src/application/learning/submit-answer.ts`):

```ts
interface SubmitAnswerRequestDto {
  submissionId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  answeredAt: string; // ISO 8601 — parsed to Date at the boundary
  selectedAnswer: string | string[] | null; // ADR-014
  confidenceLevel: "low" | "medium" | "high" | null;
  responseTimeSeconds: number | null;
  todaySessionId: string | null;
  todaySessionItemId: string | null;
  /**
   * Present ONLY for manual practice (todaySessionItemId === null) — the
   * client's own stable token (ADR-012 §5). For a Today-attached
   * submission this field, if present, is IGNORED by the server exactly
   * as `submit-answer.ts` already ignores it internally — the DTO layer
   * does not need to duplicate that rule, only preserve it (do not "help"
   * by stripping it before it reaches submitAnswer; that would just move
   * the ownership logic to a second place).
   */
  learningSessionId: string | null;
  assistanceUsed: "NONE" | "FIFTY_FIFTY" | "HINT" | "SECOND_ATTEMPT" | "ANSWER_REVEALED" | "OTHER";
  attemptNumberForPresentedItem: number;
  answerWasRevealedBeforeResponse: boolean;
}
```

Why a separate DTO rather than reusing `SubmitAnswerCommand` directly at the
boundary: the DTO is what crosses an untrusted wire (JSON, string
`answeredAt`) and must be parsed/validated before it can become a
`SubmitAnswerCommand` (`Date` object, etc.) — collapsing the two would mean
either the domain command type grows wire-format concerns (JSON-string
dates) or the route trusts unparsed/unvalidated input directly into
application code. `docs/ARCHITECTURE.md` §22: "validation should happen at
boundaries rather than relying on TypeScript types alone."

**Fields the DTO does NOT accept — server-derived, never trusted from the
client, at the ROUTE layer, before `submitAnswer` even runs:**

- **`userId`** — comes from the authenticated principal (session/JWT),
  never from request JSON. `submitAnswer` itself has no way to enforce
  this — it is a route-layer responsibility to construct the actual
  `SubmitAnswerCommand.userId` from the authenticated session, never from
  `req.body.userId`.
- **`engineVersion`** — comes from `SubmitAnswerContext.engineVersion`,
  which the route's composition root supplies as server/environment
  configuration (a deployed build's own version), never from the client.
  This is already enforced inside `submitAnswer` (`SubmitAnswerCommand`
  omits `engineVersion` entirely via its `Omit<Attempt, ...>` type) — the
  route layer must not accidentally reintroduce it by spreading raw
  request JSON into the command.
- **`id`** (Attempt's own id), **`isCorrect`**, **`suspiciousTiming`** —
  already omitted from `SubmitAnswerCommand`'s type; nothing new needed at
  the route layer beyond not fighting that type.

Response mapping (`SubmitAnswerResult` → HTTP), sketched, not decided (HTTP
status codes are explicitly out of scope for this session — this is the
CATEGORY each result kind falls into, not a number):

| `SubmitAnswerResult.kind` | Category |
|---|---|
| `ACCEPTED` | Success |
| `IDEMPOTENCY_KEY_CONFLICT` | Client request-identity conflict |
| `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED` | Client request error (not found / not authorized for this principal) |
| `QUESTION_VERSION_CONSISTENCY_VIOLATION` | Client request error (bad reference) |
| `INVALID_SELECTED_ANSWER` (ADR-014) | Client request error (malformed payload) |
| *(unhandled thrown error, e.g. `InvalidQuestionAnswerDefinitionError`)* | Server error — NEVER exposed as "incorrect answer" or a generic 200; a real infrastructure fault |

## 2. "Get Today" route shape

```
GET /api/learning/today?courseId=...&plannedForDate=...
POST /api/learning/today  (create-if-not-exists — see below)
```

Two application functions already exist with different semantics
(`src/application/learning/today-session.ts`):

- `getTodaySession(key, uow)` — pure read, no side effects. Maps to `GET`.
- `getOrCreateTodaySession(key, context, uow)` — may create. Maps to
  `POST` (an HTTP `GET` should not have a side effect, per ordinary REST
  convention — this project has no committed convention of its own yet,
  but nothing contradicts the ordinary one either).

`TodaySessionKey` (`userId`, `courseId`, `plannedForDate`) — `userId` is,
again, server-derived from the authenticated principal, never a query
param; `courseId`/`plannedForDate` come from the request. `plannedForDate`
remains an opaque caller-supplied `YYYY-MM-DD` string end to end
(`docs/OPEN_QUESTIONS.md` #3 is still open — no day-boundary/timezone logic
exists anywhere in this stack, and this boundary must not quietly invent
any).

## 3. Server-derived userId boundary

This is the single most important boundary property, restated because it's
easy to get backwards: **`userId` never travels from client to server as
data.** It is derived once, at the route layer, from whatever Auth
mechanism is eventually wired up (session cookie → server-side lookup, or a
verified JWT claim) — never read from `req.body.userId`,
`req.query.userId`, or any client-supplied header. Every application
function below the route layer (`submitAnswer`, `getOrCreateTodaySession`)
already takes `userId` as a plain parameter with no opinion on where it
came from; the route is the ONLY place responsible for making sure that
value is trustworthy before it's used as one.

## 4. Today `learningSessionId` derivation (restated, not re-decided)

Unchanged from ADR-012 §5 / `submit-answer.ts`'s existing
`resolveLearningSessionId`: for a Today-attached Attempt, `learningSessionId`
is derived from the persisted `TodaySessionItem.todaySessionId` —
INTERNALLY, inside `submitAnswer`, regardless of what (if anything) the
client sent for it. The route/DTO layer does not need its own copy of this
rule; it only needs to not defeat it (e.g. never let a client-supplied
`learningSessionId` field silently overwrite what `submitAnswer` derives —
it already can't, since `submitAnswer` ignores it for this case, but a
route MUST NOT "helpfully" pre-populate/override it either).

## 5. `submissionId`

Client-generated and reused verbatim across retries (ADR-010's own "Client
retry contract" section) — the route passes it through unchanged, never
generates or replaces it. This is the ONE identity field in the whole
request that is trusted as client-supplied even at the route boundary,
by design (it is what makes retries idempotent).

## Deferred / explicitly not decided by this document

- HTTP status codes for each result category above.
- The actual Auth mechanism (session cookie vs JWT vs something else) —
  this document only says "wherever it comes from, resolve `userId` before
  the application layer, never after."
- Rate limiting, request size limits, CORS — none of this repo's current
  code has an opinion on them yet.
- Any UI that would call these routes.

## Related Documents

- `src/application/learning/submit-answer.ts`
- `src/application/learning/today-session.ts`
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
- `docs/DECISIONS/014-question-answer-model-v1.md`
- `docs/ARCHITECTURE.md` §20 (Database Access), §22 (Validation), §31 (Security Architecture)

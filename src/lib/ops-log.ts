/**
 * Pilot-minimum runtime visibility (PILOT_READINESS §3 item 13b).
 *
 * First-party, dependency-free helpers for server-side operational logs that
 * land in Vercel Runtime Logs. They exist so that logging an unexpected
 * failure can never write request-derived or row-derived content:
 *
 * - PostgreSQL errors carry `detail` / `where` / `hint` which can echo whole
 *   rows (learner ids, selected answers) or user-supplied literals; the
 *   `message` of data-exception errors can echo the offending value.
 * - `SyntaxError` messages from body parsing can echo a body fragment.
 * - Arbitrary error text can contain newlines (log injection) or be huge.
 *
 * Only a bounded, allow-listed summary is logged. Expected client outcomes
 * (4xx) must NOT use `logUnexpectedError`; use `logClientRejection`, which
 * emits a fixed-vocabulary `warn` line so they stay distinguishable from
 * server faults in the Runtime Logs level filter.
 *
 * This is not an observability platform: no transport, no sampling, no
 * identifiers, no persistence. Request correlation is Vercel's own
 * `x-vercel-id` (present in Runtime Logs and on every response).
 */

const MAX_MESSAGE_CHARS = 300;
const MAX_STACK_FRAMES = 8;
const MAX_STACK_FRAME_CHARS = 200;
const MAX_FIELD_CHARS = 100;

// PostgreSQL SQLSTATE: 5 chars. Restricted to real class prefixes so Node
// system codes such as "EPIPE" are not misclassified.
const SQLSTATE_PATTERN = /^(?:[0-9]{2}|P0|XX|HV|F0)[0-9A-Z]{3}$/;

export interface UnexpectedErrorSummary {
  errorName: string;
  errorCode?: string;
  constraint?: string;
  table?: string;
  column?: string;
  message?: string;
  stackFrames?: string[];
}

// C0 controls, DEL, and the Unicode line/paragraph separators (written as escapes on purpose).
const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f\u2028\u2029]+", "g");

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  // Collapse all control characters / line breaks: one log entry stays one line.
  const collapsed = value.replace(CONTROL_CHARS, " ").trim();
  if (collapsed.length === 0) return undefined;
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

function readStringProp(source: object, key: string): unknown {
  return (source as Record<string, unknown>)[key];
}

function frames(stack: unknown): string[] | undefined {
  if (typeof stack !== "string") return undefined;
  const lines = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, MAX_STACK_FRAMES)
    .map((line) => clean(line, MAX_STACK_FRAME_CHARS))
    .filter((line): line is string => line !== undefined);
  return lines.length > 0 ? lines : undefined;
}

/** Builds the allow-listed summary. Never reads `detail`, `where`, `hint`, `cause`, `query` or `parameters`. */
export function summarizeUnexpectedError(error: unknown): UnexpectedErrorSummary {
  if (error === null || typeof error !== "object") {
    // Thrown primitives (string/number/undefined) may be arbitrary text: type only.
    return { errorName: `non-object:${error === null ? "null" : typeof error}` };
  }

  const name = clean(readStringProp(error, "name"), MAX_FIELD_CHARS) ?? "UnknownError";
  const code = clean(readStringProp(error, "code"), MAX_FIELD_CHARS);
  const isSqlState = code !== undefined && SQLSTATE_PATTERN.test(code);
  // Node system errors (ECONNREFUSED, ENOTFOUND, ...) embed host:port / project hostnames in the message.
  const isSystemCode = code !== undefined && /^E[A-Z0-9_]{2,}$/.test(code);
  const messageEchoesValues = isSqlState || isSystemCode || name === "SyntaxError";

  const summary: UnexpectedErrorSummary = { errorName: name };
  if (code !== undefined) summary.errorCode = code;

  if (isSqlState) {
    const constraint = clean(readStringProp(error, "constraint"), MAX_FIELD_CHARS);
    const table = clean(readStringProp(error, "table"), MAX_FIELD_CHARS);
    const column = clean(readStringProp(error, "column"), MAX_FIELD_CHARS);
    if (constraint !== undefined) summary.constraint = constraint;
    if (table !== undefined) summary.table = table;
    if (column !== undefined) summary.column = column;
  }

  if (!messageEchoesValues) {
    const message = clean(readStringProp(error, "message"), MAX_MESSAGE_CHARS);
    if (message !== undefined) summary.message = message;
  }

  const stackFrames = frames(readStringProp(error, "stack"));
  if (stackFrames !== undefined) summary.stackFrames = stackFrames;

  return summary;
}

/**
 * Logs an UNEXPECTED server fault (the ones that return 5xx) at error level
 * with a constant `label` (always a source-code literal, never request data).
 */
export function logUnexpectedError(label: string, error?: unknown): void {
  // Logging must never throw: callers invoke this inside catch blocks (including ROLLBACK
  // handling, where the original error must not be masked), and the thrown value may be hostile.
  try {
    if (error === undefined) {
      console.error(label);
      return;
    }
    console.error(label, summarizeUnexpectedError(error));
  } catch {
    try {
      console.error(label);
    } catch {
      // nothing left to do
    }
  }
}

/**
 * Logs an EXPECTED client rejection that is nonetheless worth noticing (e.g.
 * a request the UI should never produce). `warn` level, constant label only:
 * no request-derived text of any kind.
 */
export function logClientRejection(label: string): void {
  console.warn(label);
}

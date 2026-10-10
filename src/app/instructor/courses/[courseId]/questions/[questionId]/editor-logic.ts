/**
 * Pure helpers for the Question editor page (PREVIEW-QA-FIX-001): dirty
 * detection, create-another visibility, publish-readiness message mapping, and
 * the empty-Question create call. Kept free of React so they are unit-testable
 * in this repo's node Vitest environment.
 */

export interface EditorFormValues {
  topicId: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  prompt: string;
  options: { id: string; content: string }[];
  correctOptionIds: string[];
  explanation: string;
}

/** True when `current` differs from the last loaded/saved `baseline`. Option order matters; correct-id order does not. */
export function isEditorDirty(baseline: EditorFormValues, current: EditorFormValues): boolean {
  if (
    baseline.topicId !== current.topicId ||
    baseline.questionType !== current.questionType ||
    baseline.prompt !== current.prompt ||
    baseline.explanation !== current.explanation
  ) {
    return true;
  }
  if (baseline.options.length !== current.options.length) return true;
  for (let i = 0; i < baseline.options.length; i++) {
    if (baseline.options[i].id !== current.options[i].id || baseline.options[i].content !== current.options[i].content) {
      return true;
    }
  }
  const a = [...baseline.correctOptionIds].sort();
  const b = [...current.correctOptionIds].sort();
  return a.length !== b.length || a.some((id, i) => id !== b[i]);
}

/**
 * Accessible name for an answer-option control. `index` is the 0-based position in the CURRENT
 * rendered option list (so numbering follows add/remove); the name uses 1-based `{n}`.
 */
export function optionControlLabel(template: string, index: number): string {
  return template.replace("{n}", String(index + 1));
}

export function shouldShowCreateAnother(input: {
  courseArchived: boolean;
  dirty: boolean;
  savedOk: boolean;
  publishedOk: boolean;
  saveError: boolean;
  publishError: boolean;
}): boolean {
  if (input.courseArchived || input.dirty || input.saveError || input.publishError) return false;
  return input.savedOk || input.publishedOk;
}

/**
 * FUB-068 Option B. `baseline === null` (still loading / not ready) is NOT dirty here, so the
 * guard never fires before the form exists. (Create-another keeps its own stricter null => dirty.)
 */
export function isGuardDirty(baseline: EditorFormValues | null, current: EditorFormValues): boolean {
  return baseline !== null && isEditorDirty(baseline, current);
}

interface UnloadTarget {
  addEventListener(type: "beforeunload", listener: (event: BeforeUnloadEvent) => void): void;
  removeEventListener(type: "beforeunload", listener: (event: BeforeUnloadEvent) => void): void;
}

/** Browser-native prompt text is controlled by the browser; we only request the prompt. */
export function beforeUnloadHandler(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // Legacy browsers require a truthy returnValue to show the prompt.
  event.returnValue = "";
}

/**
 * Installs the beforeunload listener only while `dirty`; returns the cleanup (a no-op when clean).
 * Use from an effect keyed on `dirty` so the listener never outlives a dirty state or the component.
 */
export function syncBeforeUnloadGuard(target: UnloadTarget | null, dirty: boolean): () => void {
  if (!dirty || target === null) return () => {};
  target.addEventListener("beforeunload", beforeUnloadHandler);
  return () => target.removeEventListener("beforeunload", beforeUnloadHandler);
}

/** True when leaving may proceed: clean, or the instructor explicitly confirmed discarding edits. */
export function confirmLeave(dirty: boolean, confirmFn: () => boolean): boolean {
  return !dirty || confirmFn();
}

/** Plain primary click only: modified clicks open a new tab/window and do not discard this editor's state. */
export function isPlainNavigationClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The one known server reason that gets a dedicated Hebrew message. */
export const TOPIC_REQUIRED_REASON = "a Topic must be selected before publishing";

/**
 * The publish API's `reason` is the domain error's own `message`, which
 * `QuestionNotPublishReadyError` prefixes with this text — so the wire value is
 * "Question is not publish-ready: <reason>", not the bare reason.
 */
const NOT_PUBLISH_READY_PREFIX = "Question is not publish-ready: ";

export function publishNotReadyMessage(
  reason: string,
  strings: { publishNotReadyError: string; publishTopicRequiredError: string },
): string {
  const bareReason = reason.startsWith(NOT_PUBLISH_READY_PREFIX)
    ? reason.slice(NOT_PUBLISH_READY_PREFIX.length)
    : reason;
  if (bareReason === TOPIC_REQUIRED_REASON) return strings.publishTopicRequiredError;
  return strings.publishNotReadyError.replace("{reason}", reason);
}

/** Creates a new EMPTY Question in the Course (same call as the Course page; nothing is carried forward). */
export async function createEmptyQuestion(
  courseId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ outcome: "CREATED"; questionId: string } | { outcome: "UNAUTHENTICATED" } | { outcome: "ERROR" }> {
  try {
    const response = await fetchFn(`/api/courses/${courseId}/questions`, { method: "POST" });
    if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
    if (!response.ok) return { outcome: "ERROR" };
    const body = (await response.json()) as { question?: { id?: string } };
    if (!body.question?.id) return { outcome: "ERROR" };
    return { outcome: "CREATED", questionId: body.question.id };
  } catch {
    return { outcome: "ERROR" };
  }
}

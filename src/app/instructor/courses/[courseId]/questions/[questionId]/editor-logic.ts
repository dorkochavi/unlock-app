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

/** The one known server reason that gets a dedicated Hebrew message. */
export const TOPIC_REQUIRED_REASON = "a Topic must be selected before publishing";

export function publishNotReadyMessage(
  reason: string,
  strings: { publishNotReadyError: string; publishTopicRequiredError: string },
): string {
  if (reason === TOPIC_REQUIRED_REASON) return strings.publishTopicRequiredError;
  return strings.publishNotReadyError.replace("{reason}", reason);
}

/** Creates a new EMPTY Question in the Course (same call as the Course page; nothing is carried forward). */
export async function createEmptyQuestion(
  courseId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ outcome: "CREATED"; questionId: string } | { outcome: "ERROR" }> {
  try {
    const response = await fetchFn(`/api/courses/${courseId}/questions`, { method: "POST" });
    if (!response.ok) return { outcome: "ERROR" };
    const body = (await response.json()) as { question?: { id?: string } };
    if (!body.question?.id) return { outcome: "ERROR" };
    return { outcome: "CREATED", questionId: body.question.id };
  } catch {
    return { outcome: "ERROR" };
  }
}

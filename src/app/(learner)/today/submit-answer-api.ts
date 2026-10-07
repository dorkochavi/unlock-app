import type { ConfidenceLevel } from "@/domain/learning/types";

export type SubmitAnswerOutcome =
  | {
      outcome: "ACCEPTED";
      isCorrect: boolean;
      correctOptionIds: string[];
      explanation: string | null;
    }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "ALREADY_RESOLVED" }
  | { outcome: "ERROR" };

export async function submitDailyPlanItemAnswer(
  itemId: string,
  body: {
    submissionId: string;
    selectedAnswer: string | string[] | null;
    confidenceLevel: ConfidenceLevel | null;
  },
): Promise<SubmitAnswerOutcome> {
  let response: Response;
  try {
    response = await fetch(`/api/daily-plan/items/${itemId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 409) {
    return { outcome: "ALREADY_RESOLVED" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const json = (await response.json()) as {
      isCorrect: boolean;
      correctOptionIds?: unknown;
      explanation?: unknown;
    };
    const correctOptionIds =
      Array.isArray(json.correctOptionIds) &&
      json.correctOptionIds.every((id) => typeof id === "string")
        ? json.correctOptionIds
        : [];
    const explanation = typeof json.explanation === "string" ? json.explanation : null;
    return { outcome: "ACCEPTED", isCorrect: json.isCorrect, correctOptionIds, explanation };
  } catch {
    return { outcome: "ERROR" };
  }
}

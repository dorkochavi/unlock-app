import type { DailyPlanDto } from "@/app/api/daily-plan/today/daily-plan-dto";

export type FetchTodayPlanOutcome =
  | { outcome: "READY"; plan: DailyPlanDto }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "TIMEZONE_NOT_SET" }
  | { outcome: "ERROR" };

/**
 * Never rejects: a network failure or unreadable body maps to `ERROR` so the
 * Today page reaches its retryable error state instead of staying on the
 * loading state forever (F-14).
 */
export async function fetchTodayPlan(): Promise<FetchTodayPlanOutcome> {
  try {
    const response = await fetch("/api/daily-plan/today", { method: "GET" });
    if (response.status === 401) {
      return { outcome: "UNAUTHENTICATED" };
    }
    if (response.status === 422) {
      return { outcome: "TIMEZONE_NOT_SET" };
    }
    if (!response.ok) {
      return { outcome: "ERROR" };
    }
    const body = (await response.json()) as { plan: DailyPlanDto };
    return { outcome: "READY", plan: body.plan };
  } catch {
    return { outcome: "ERROR" };
  }
}

/** Never rejects; `false` on any failure (including network errors). */
export async function persistDetectedTimezone(): Promise<boolean> {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch("/api/user/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: detected }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

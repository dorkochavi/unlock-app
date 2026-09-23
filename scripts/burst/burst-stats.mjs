/**
 * Pre-Pilot S3 — pure helpers shared by the classroom-burst sanity harnesses
 * (`supabase/tests/burst/classroom-burst.local.test.ts` and
 * `scripts/burst/burst-hosted.mjs`). No I/O, no clock: unit-tested in
 * `src/tooling/__tests__/burst-stats.test.ts`.
 *
 * Deliberately tiny — this is a sanity harness, not load-test infrastructure.
 */

/** Nearest-rank percentile of a numeric array (p in 0..100). Empty -> null. */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

/** min/p50/p95/max/count of durations in ms, rounded to 1 decimal. Empty -> null fields. */
export function summarizeLatencies(values) {
  const round = (n) => (n === null ? null : Math.round(n * 10) / 10);
  return {
    count: values.length,
    min: round(values.length ? Math.min(...values) : null),
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
    max: round(values.length ? Math.max(...values) : null),
  };
}

/**
 * Buckets a failure so the report separates application errors from auth
 * provider friction, timeouts, transport problems and DB/pool failures.
 *
 * `failure` shape: `{ step, status?, timedOut?, message?, code? }`.
 */
export function classifyFailure(failure) {
  if (failure.timedOut) return "TIMEOUT";
  if (failure.step === "auth") return "AUTH_PROVIDER";
  const text = `${failure.message ?? ""} ${failure.code ?? ""}`.toLowerCase();
  if (
    /too many connections|remaining connection slots|pool|timeout exceeded when trying to connect|econnreset|terminating connection|connection terminated|53300|57p01|08006|08003/.test(
      text,
    )
  ) {
    return "DB_OR_POOLER";
  }
  if (typeof failure.status === "number") {
    if (failure.status >= 500) return "APPLICATION_5XX";
    if (failure.status >= 400) return "UNEXPECTED_4XX";
  }
  if (/fetch failed|econnrefused|enotfound|network/.test(text)) return "TRANSPORT";
  return "OTHER";
}

/**
 * Builds the run report from per-learner results.
 * @returns {Record<string, any>}
 * `results`: `[{ ok: boolean, steps: { [step]: ms }, failure?: {...} }]`.
 */
export function buildReport({ scenario, learners, results, extra = {} }) {
  const stepNames = new Set();
  for (const r of results) for (const s of Object.keys(r.steps ?? {})) stepNames.add(s);

  const stepLatencyMs = {};
  for (const step of stepNames) {
    stepLatencyMs[step] = summarizeLatencies(
      results.map((r) => r.steps?.[step]).filter((v) => typeof v === "number"),
    );
  }

  const failuresByClass = {};
  const failureSamples = [];
  for (const r of results) {
    if (r.ok || !r.failure) continue;
    const cls = classifyFailure(r.failure);
    failuresByClass[cls] = (failuresByClass[cls] ?? 0) + 1;
    if (failureSamples.length < 5) {
      failureSamples.push({ class: cls, step: r.failure.step, status: r.failure.status ?? null });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    scenario,
    learners,
    succeeded,
    failed: results.length - succeeded,
    failuresByClass,
    failureSamples,
    stepLatencyMs,
    ...extra,
  };
}

/** `pattern` contains `{n}`; replaced by the 1-based index zero-padded to 2 digits (e.g. burst{n}@example.test -> burst07@example.test). */
export function expandEmailPattern(pattern, n) {
  if (!pattern.includes("{n}")) {
    throw new Error("email pattern must contain {n}");
  }
  return pattern.replace("{n}", String(n).padStart(2, "0"));
}

/** Cookie header value from `[{name, value}]` (as produced by a Supabase SSR cookie jar). */
export function buildCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

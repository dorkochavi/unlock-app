#!/usr/bin/env node
/**
 * Pre-Pilot S3 — HTTP classroom-burst sanity harness for a RUNNING UNLOCK app
 * (local `next start` or a deployed URL) backed by real Supabase Auth.
 *
 * NOT run by Claude: it needs pre-provisioned test learner accounts and a
 * Dor-owned decision about which project to point at (hosted mutation).
 * See `scripts/burst/README.md` for the exact commands and safety notes.
 * Not verified against hosted from this repository — start with
 * BURST_LEARNERS=2 as a smoke test.
 *
 * Flow per learner (each step timed separately):
 *   auth (Supabase password sign-in, paced — reported SEPARATELY as provider
 *   friction) -> [barrier] -> timezone -> join -> first Today (x2 concurrent,
 *   double tab) -> first answer (x2 concurrent, same submissionId).
 *
 * Reads config ONLY from environment variables; prints no secrets, no
 * cookies, no tokens, no emails. Output: JSON report on stdout.
 *
 * Env:
 *   BURST_BASE_URL              required, e.g. http://localhost:3000
 *   BURST_COURSE_ID             required, an OPEN + PUBLISHED Course with published Questions
 *   BURST_EMAIL_PATTERN         required, contains {n}, e.g. burst{n}@example.test
 *   BURST_PASSWORD              required (shared by all test accounts)
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY   required
 *   BURST_LEARNERS              default 30 (use 2 for a smoke test)
 *   BURST_SIGNIN_CONCURRENCY    default 5 (Supabase rate-limits sign-ins per IP)
 *   BURST_TIMEOUT_MS            default 30000 per request
 */
import { createServerClient } from "@supabase/ssr";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";

import {
  buildCookieHeader,
  buildReport,
  evaluateDuplicateAnswerOutcome,
  expandEmailPattern,
} from "./burst-stats.mjs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    process.exit(2);
  }
  return value;
}

const BASE_URL = requireEnv("BURST_BASE_URL").replace(/\/$/, "");
const COURSE_ID = requireEnv("BURST_COURSE_ID");
const EMAIL_PATTERN = requireEnv("BURST_EMAIL_PATTERN");
const PASSWORD = requireEnv("BURST_PASSWORD");
const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const LEARNERS = Number(process.env.BURST_LEARNERS ?? "30");
const SIGNIN_CONCURRENCY = Number(process.env.BURST_SIGNIN_CONCURRENCY ?? "5");
const TIMEOUT_MS = Number(process.env.BURST_TIMEOUT_MS ?? "30000");

async function signIn(n) {
  const jar = new Map();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) jar.set(name, value);
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: expandEmailPattern(EMAIL_PATTERN, n),
    password: PASSWORD,
  });
  if (error) {
    const e = new Error(error.message);
    e.status = error.status;
    throw e;
  }
  return buildCookieHeader([...jar].map(([name, value]) => ({ name, value })));
}

async function http(method, path, cookie, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      // non-JSON body — leave null
    }
    return { status: response.status, json };
  } catch (error) {
    if (error?.name === "AbortError") {
      const e = new Error("request timed out");
      e.timedOut = true;
      throw e;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

class StepError extends Error {
  constructor(step, message, extra = {}) {
    super(message);
    this.step = step;
    Object.assign(this, extra);
  }
}

async function timed(steps, name, fn) {
  const t = performance.now();
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StepError) throw error;
    throw new StepError(name, error.message, { status: error.status, timedOut: error.timedOut });
  } finally {
    steps[name] = performance.now() - t;
  }
}

/** Application error code of a non-2xx response ({error:{code}}), if well-formed. Never the body. */
function appCode(res) {
  const code = res.json?.error?.code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : undefined;
}

function expectStatus(step, res, allowed) {
  if (!allowed.includes(res.status)) {
    throw new StepError(step, `unexpected HTTP ${res.status}`, { status: res.status, code: appCode(res) });
  }
}

async function burstFlow(cookie, start) {
  const steps = {};
  let answerOutcome;
  await start;
  try {
    await timed(steps, "timezone", async () => {
      expectStatus("timezone", await http("POST", "/api/user/timezone", cookie, { timezone: "Asia/Jerusalem" }), [200]);
    });
    await timed(steps, "join", async () => {
      expectStatus("join", await http("POST", `/api/courses/${COURSE_ID}/join`, cookie), [200]);
    });
    const plan = await timed(steps, "today", async () => {
      const [a, b] = await Promise.all([
        http("GET", "/api/daily-plan/today", cookie),
        http("GET", "/api/daily-plan/today", cookie),
      ]);
      expectStatus("today", a, [200]);
      expectStatus("today", b, [200]);
      if (a.json?.plan?.id !== b.json?.plan?.id) {
        throw new StepError("today", "two concurrent Today opens returned different plans");
      }
      return a.json.plan;
    });
    const item = plan.items?.find((i) => i.status === "pending") ?? plan.items?.[0];
    if (!item || !item.answerOptions?.length) {
      throw new StepError("today", "plan has no answerable item");
    }
    await timed(steps, "answer", async () => {
      const body = { submissionId: `burst-${randomUUID()}`, selectedAnswer: item.answerOptions[0].id };
      // ONE logical submission (same submissionId) sent twice concurrently.
      // Either the duplicate reached the existing-Attempt idempotent path
      // (200 + 200) or it lost the race / saw the resolved item (200 + 409
      // ITEM_ALREADY_RESOLVED | SUBMISSION_ID_REUSED). Anything else fails.
      const [a, b] = await Promise.all([
        http("POST", `/api/daily-plan/items/${item.id}/answer`, cookie, body),
        http("POST", `/api/daily-plan/items/${item.id}/answer`, cookie, body),
      ]);
      const observe = (res) => ({
        status: res.status,
        code: appCode(res) ?? null,
        shapeOk: res.status !== 200 || (res.json?.status === "COMPLETED" && typeof res.json?.isCorrect === "boolean"),
      });
      const verdict = evaluateDuplicateAnswerOutcome([observe(a), observe(b)]);
      if (!verdict.ok) {
        throw new StepError("answer", verdict.reason, { status: verdict.status, code: verdict.code });
      }
      answerOutcome = verdict.outcome;
    });
    return { ok: true, steps, answerOutcome };
  } catch (error) {
    return {
      ok: false,
      steps,
      failure: {
        step: error.step ?? "unknown",
        status: error.status,
        timedOut: error.timedOut,
        code: error.code,
        message: error.message,
      },
    };
  }
}

async function main() {
  // Phase 1: paced sign-in (auth provider friction is reported separately).
  const cookies = new Array(LEARNERS).fill(null);
  const authResults = [];
  let next = 0;
  const worker = async () => {
    while (next < LEARNERS) {
      const index = next;
      next += 1;
      const steps = {};
      try {
        cookies[index] = await timed(steps, "auth", () => signIn(index + 1));
        authResults.push({ ok: true, steps });
      } catch (error) {
        authResults.push({
          ok: false,
          steps,
          failure: { step: "auth", status: error.status, timedOut: error.timedOut, message: error.message },
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, SIGNIN_CONCURRENCY) }, worker));

  const authReport = buildReport({ scenario: "AUTH_SIGNIN_PHASE", learners: LEARNERS, results: authResults });

  // Phase 2: the burst — every signed-in learner released at the same instant.
  let release;
  const start = new Promise((resolve) => {
    release = resolve;
  });
  const flows = cookies.filter(Boolean).map((cookie) => burstFlow(cookie, start));
  const wallStart = performance.now();
  release();
  const results = await Promise.all(flows);
  const wallMs = performance.now() - wallStart;

  const burstReport = buildReport({
    scenario: "HTTP_BURST",
    learners: flows.length,
    results,
    extra: {
      baseUrlHost: new URL(BASE_URL).host,
      wallClockMs: Math.round(wallMs),
      duplicateAnswerOutcomes: results.reduce((tally, r) => {
        if (r.answerOutcome) tally[r.answerOutcome] = (tally[r.answerOutcome] ?? 0) + 1;
        return tally;
      }, {}),
      note: "Success = all steps returned the expected HTTP status; Today x2 returned the same plan; the duplicate answer pair was 200+200 or 200+409 (ITEM_ALREADY_RESOLVED|SUBMISSION_ID_REUSED).",
    },
  });

  console.log(JSON.stringify({ auth: authReport, burst: burstReport }, null, 2));
  process.exit(burstReport.failed > 0 || authReport.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("burst-hosted: fatal", error?.message ?? error);
  process.exit(3);
});

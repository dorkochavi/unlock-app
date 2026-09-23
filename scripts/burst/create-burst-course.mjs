#!/usr/bin/env node
/**
 * Pre-Pilot S3 — creates ONE dedicated throwaway Course ("Pre-Pilot Burst
 * Test") through the REAL UNLOCK instructor API, as the instructor account
 * whose credentials YOU supply via environment variables. Hosted mutation:
 * a Dor-owned action; Claude does not hold instructor credentials.
 *
 * Path used (same as the product UI):
 *   POST /api/courses -> POST .../topics -> PATCH .../join-policy (OPEN)
 *   -> for each of 6 Questions: POST .../questions (draft) ->
 *      PATCH .../questions/:id (content) -> POST .../questions/:id/publish
 *   -> POST .../publish (Course) -> read-only verification GETs.
 *
 * Safety:
 *  - creates only NEW rows; never modifies an existing Course/Question;
 *  - refuses to run if this instructor already has a Course with the same
 *    title (prints its id instead), so a re-run cannot create a duplicate;
 *  - reads secrets only from env; prints no emails/passwords/cookies/tokens.
 *
 * Env: BURST_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *      BURST_INSTRUCTOR_EMAIL, BURST_INSTRUCTOR_PASSWORD,
 *      optional VERCEL_PROTECTION_BYPASS (Vercel "Protection Bypass for
 *      Automation" secret, only if the Preview is behind Deployment Protection).
 */
import { createServerClient } from "@supabase/ssr";

import { buildCookieHeader } from "./burst-stats.mjs";

const COURSE_TITLE = "Pre-Pilot Burst Test";
const TOPIC_NAME = "Burst Test Topic";
const QUESTIONS = [
  { prompt: "1 + 1 = ?", options: ["1", "2", "3", "4"], correct: 1 },
  { prompt: "2 + 2 = ?", options: ["3", "4", "5", "6"], correct: 1 },
  { prompt: "3 + 3 = ?", options: ["5", "6", "7", "8"], correct: 1 },
  { prompt: "4 + 4 = ?", options: ["6", "7", "8", "9"], correct: 2 },
  { prompt: "5 + 5 = ?", options: ["9", "10", "11", "12"], correct: 1 },
  { prompt: "6 + 6 = ?", options: ["10", "11", "12", "13"], correct: 2 },
];
const OPTION_IDS = ["A", "B", "C", "D"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    process.exit(2);
  }
  return value;
}

const BASE_URL = requireEnv("BURST_BASE_URL").replace(/\/$/, "");
const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const EMAIL = requireEnv("BURST_INSTRUCTOR_EMAIL");
const PASSWORD = requireEnv("BURST_INSTRUCTOR_PASSWORD");
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS;

function fail(step, detail) {
  console.error(`FAILED at step "${step}": ${detail}`);
  process.exit(1);
}

async function signIn() {
  const jar = new Map();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) jar.set(name, value);
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) fail("sign-in", `${error.status ?? ""} ${error.message}`);
  return buildCookieHeader([...jar].map(([name, value]) => ({ name, value })));
}

const cookie = await signIn();

async function api(step, method, path, body, expected) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      cookie,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(BYPASS ? { "x-vercel-protection-bypass": BYPASS } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON (e.g. a Vercel protection page)
  }
  if (!expected.includes(response.status)) {
    const code = json?.error?.code ? ` (${json.error.code})` : "";
    fail(step, `HTTP ${response.status}${code}`);
  }
  return json;
}

// 0. Duplicate guard (read-only).
const mine = await api("list my courses", "GET", "/api/courses/mine", undefined, [200]);
const existing = (mine.courses ?? []).find((c) => c.title === COURSE_TITLE);
if (existing) {
  console.error(`A Course titled "${COURSE_TITLE}" already exists for this instructor (id ${existing.id}). Not creating another.`);
  process.exit(3);
}

// 1. Course.
const courseId = (await api("create course", "POST", "/api/courses", { title: COURSE_TITLE, examDate: null }, [201])).course.id;
console.log(`created Course ${courseId}`);

// 2. Topic.
const topicId = (await api("create topic", "POST", `/api/courses/${courseId}/topics`, { name: TOPIC_NAME }, [201])).topic.id;
console.log(`created Topic ${topicId}`);

// 3. Join policy OPEN.
await api("set join policy", "PATCH", `/api/courses/${courseId}/join-policy`, { joinPolicy: "OPEN" }, [200]);

// 4. Six Questions: draft -> content -> publish.
for (const [index, q] of QUESTIONS.entries()) {
  const label = `question ${index + 1}`;
  const questionId = (await api(`${label}: create draft`, "POST", `/api/courses/${courseId}/questions`, undefined, [201])).question.id;
  await api(`${label}: save content`, "PATCH", `/api/courses/${courseId}/questions/${questionId}`, {
    topicId,
    questionType: "SINGLE_CHOICE",
    prompt: q.prompt,
    answerOptions: q.options.map((content, i) => ({ id: OPTION_IDS[i], content })),
    correctOptionIds: [OPTION_IDS[q.correct]],
    explanation: null,
  }, [200]);
  await api(`${label}: publish`, "POST", `/api/courses/${courseId}/questions/${questionId}/publish`, undefined, [200]);
  console.log(`published ${label}`);
}

// 5. Publish the Course.
await api("publish course", "POST", `/api/courses/${courseId}/publish`, undefined, [200]);

// 6. Read-only verification.
const manage = await api("verify course", "GET", `/api/courses/${courseId}/manage`, undefined, [200]);
const topics = await api("verify topics", "GET", `/api/courses/${courseId}/topics`, undefined, [200]);
const questions = await api("verify questions", "GET", `/api/courses/${courseId}/questions`, undefined, [200]);

const checks = {
  courseTitle: manage.course.title === COURSE_TITLE,
  coursePublished: manage.course.status === "PUBLISHED",
  joinPolicyOpen: manage.course.joinPolicy === "OPEN",
  topicExists: (topics.topics ?? []).some((t) => t.id === topicId && t.name === TOPIC_NAME),
  sixQuestions: (questions.questions ?? []).length === 6,
  allSixPublishedNoDraft: (questions.questions ?? []).every((x) => x.state === "PUBLISHED" && x.topicId === topicId),
};

console.log(
  JSON.stringify(
    {
      host: new URL(BASE_URL).host,
      courseId,
      courseTitle: manage.course.title,
      courseStatus: manage.course.status,
      joinPolicy: manage.course.joinPolicy,
      topicId,
      questionCount: (questions.questions ?? []).length,
      questionStates: (questions.questions ?? []).map((x) => x.state),
      checks,
    },
    null,
    2,
  ),
);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);

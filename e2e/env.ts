/**
 * Shared env-gating helper for the golden-path E2E suite (Run 004 Slice 7).
 *
 * This harness never creates hosted Supabase users, courses, or
 * memberships itself — see `e2e/README.md` for why. A spec that needs a
 * pre-existing authenticated learner and/or a pre-existing OPEN course
 * reads that fixture identity from environment variables the developer
 * supplies, and skips itself with a clear reason when they are absent,
 * rather than failing or silently doing nothing.
 */

export interface LearnerFixtureEnv {
  email: string;
  password: string;
  openCourseId: string;
}

/**
 * Returns the fixture env if fully configured, or `null` plus the exact
 * missing variable names — callers use the latter to build a `test.skip`
 * reason, never to throw (a missing optional fixture is not a test
 * failure).
 */
export function readLearnerFixtureEnv():
  | { ok: true; env: LearnerFixtureEnv }
  | { ok: false; missing: string[] } {
  const required = {
    E2E_LEARNER_EMAIL: process.env.E2E_LEARNER_EMAIL,
    E2E_LEARNER_PASSWORD: process.env.E2E_LEARNER_PASSWORD,
    E2E_OPEN_COURSE_ID: process.env.E2E_OPEN_COURSE_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    env: {
      email: required.E2E_LEARNER_EMAIL as string,
      password: required.E2E_LEARNER_PASSWORD as string,
      openCourseId: required.E2E_OPEN_COURSE_ID as string,
    },
  };
}

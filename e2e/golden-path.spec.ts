/**
 * Golden-path E2E V1 (Run 004 Slice 7): login -> join -> Today -> answer ->
 * feedback -> continue -> reload-safe state -> completion (where the
 * fixture course actually has enough items).
 *
 * ## Why this suite is fully skipped by default
 *
 * This harness never creates a hosted Supabase user, Course, or
 * CourseMembership on its own (`e2e/README.md`). It requires a real,
 * pre-existing learner account and a real, pre-existing OPEN Course —
 * supplied by whoever runs this suite via `E2E_LEARNER_EMAIL` /
 * `E2E_LEARNER_PASSWORD` / `E2E_OPEN_COURSE_ID` — against whichever
 * Supabase/Postgres environment `.env.local` (or the runner's own env)
 * currently points at. Without those three variables, every test below
 * skips itself with an explicit reason instead of failing or silently
 * passing on nothing.
 */
import { test, expect } from "@playwright/test";
import { readLearnerFixtureEnv } from "./env";

const fixture = readLearnerFixtureEnv();

test.describe("learner golden path", () => {
  test.skip(
    !fixture.ok,
    !fixture.ok
      ? `Skipped: missing required env var(s) for a real fixture learner/course: ${fixture.missing.join(", ")}. See e2e/README.md.`
      : "",
  );

  test("login, join an OPEN course, answer Today, and survive a reload", async ({ page }) => {
    if (!fixture.ok) return; // unreachable once test.skip fires; narrows the type below.
    const { email, password, openCourseId } = fixture.env;

    // 1. Unauthenticated learner opens a valid join link -> redirected to
    // login with `next` preserving the join destination.
    await page.goto(`/join/${openCourseId}`);
    await page.getByRole("button", { name: "הצטרפות" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=`));

    // 2. Login restores the intended join flow.
    await page.getByLabel("אימייל").fill(email);
    await page.getByLabel("סיסמה").fill(password);
    await page.getByRole("button", { name: "התחברות", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/join/${openCourseId}`));

    // 3. Valid OPEN join -> redirected to Today.
    await page.getByRole("button", { name: "הצטרפות" }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByRole("heading", { name: "היום שלי" })).toBeVisible();

    // 4/5/6/7. Today loads; if a pending item exists, answer it and expect
    // feedback, then continue. If Today is already empty/completed for
    // this fixture account/day, that is itself a valid, already-covered
    // product state (Slice 5) — this test does not force an answer to
    // exist.
    // Run UX-01: Today opens on a landing with one start/continue CTA
    // before the question flow (or directly on completion/empty).
    const startButton = page.getByRole("button", { name: /^(התחל ללמוד|המשך ללמוד)$/ });
    const settledToday = startButton
      .or(page.getByText("סיימת את התוכנית של היום"))
      .or(page.getByText("אין פריטים בתוכנית של היום"));
    await expect(settledToday).toBeVisible();
    const answeredOne = await startButton.isVisible();
    if (answeredOne) {
      await startButton.click();
      const submitButton = page.getByRole("button", { name: "שליחה", exact: true });
      const firstOption = page.getByRole("button", { pressed: false }).first();
      await firstOption.click();
      await submitButton.click();

      await expect(
        page.getByText("נכון!").or(page.getByText("לא נכון")),
      ).toBeVisible();

      await page.getByRole("button", { name: "המשך", exact: true }).click();
    }

    // 9. Reload must not corrupt same-day state: the server-reconstructed
    // Today (landing with remaining count, or completion, or empty) must be
    // identical across reloads, never reset to a fresh/duplicate plan.
    await page.reload();
    await expect(settledToday).toBeVisible();
    if (answeredOne) {
      // The answer was persisted: the server-rebuilt Today is never the
      // fresh "start" landing again — it is either "continue" or complete.
      await expect(page.getByRole("button", { name: "התחל ללמוד", exact: true })).toHaveCount(0);
    }
    const bodyBeforeReload = await page.locator("main").innerText();
    await page.reload();
    await expect(settledToday).toBeVisible();
    const bodyAfterReload = await page.locator("main").innerText();
    expect(bodyAfterReload).toBe(bodyBeforeReload);
  });
});

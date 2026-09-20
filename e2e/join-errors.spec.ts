/**
 * Cheap, fixture-free browser error-path coverage (Run 004 Slice 7): a
 * malformed/nonexistent join link must show a controlled "not found"
 * product state, never a raw error page or a generic crash.
 *
 * Unlike `golden-path.spec.ts`, this suite needs no pre-existing learner
 * account or Course — a malformed id and a syntactically valid but
 * nonexistent UUID never correspond to a real row, so there is nothing to
 * seed and nothing to mutate. It only needs the app itself reachable at
 * `baseURL` (see `e2e/README.md` for what that means in practice — by
 * default this is the developer's own `.env.local`, which normally points
 * at the real hosted Supabase project; this test only ever issues
 * read-only, unauthenticated lookups against it, matching the public,
 * unauthenticated `GET /api/courses/:courseId` route this page already
 * calls).
 */
import { test, expect } from "@playwright/test";

test.describe("join link error paths", () => {
  test("malformed/non-UUID course id shows a controlled not-found state, not a crash", async ({
    page,
  }) => {
    // The page shell itself (`/join/[courseId]`) is a client component that
    // always renders 200 — the actual `GET /api/courses/:courseId` call
    // this exercises happens client-side, after navigation. So the real
    // assertion is the rendered not-found state below, not the navigation
    // response status.
    await page.goto("/join/not-a-real-course-id");

    await expect(page.getByRole("heading", { name: "הצטרפות לקורס" })).toBeVisible();
    await expect(page.getByText("הקורס לא נמצא")).toBeVisible();
  });

  test("well-formed but nonexistent course id shows the same controlled not-found state", async ({
    page,
  }) => {
    await page.goto("/join/00000000-0000-4000-8000-000000000000");

    await expect(page.getByText("הקורס לא נמצא")).toBeVisible();
  });
});

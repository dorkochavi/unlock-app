import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveNextPathFromSearch } from "./safe-redirect";

const COURSE_ID = "29f60b2e-5aa4-45ae-a473-cc583bee52c8";

describe("resolveNextPathFromSearch", () => {
  it("preserves an internal join destination through login (the encoded form /join/:id produces)", () => {
    const search = `?next=${encodeURIComponent(`/join/${COURSE_ID}`)}`;
    expect(resolveNextPathFromSearch(search)).toBe(`/join/${COURSE_ID}`);
  });

  it("also accepts the unencoded slash form", () => {
    expect(resolveNextPathFromSearch(`?next=/join/${COURSE_ID}`)).toBe(`/join/${COURSE_ID}`);
  });

  it("normal login (no next) keeps the existing default destination, /today", () => {
    expect(resolveNextPathFromSearch("")).toBe("/today");
    expect(resolveNextPathFromSearch("?other=1")).toBe("/today");
    expect(resolveNextPathFromSearch("?next=")).toBe("/today");
  });

  it("an explicit /today is preserved", () => {
    expect(resolveNextPathFromSearch("?next=%2Ftoday")).toBe("/today");
  });

  it.each([
    "https://evil.example.com/today",
    "//evil.example.com",
    `//evil.example.com/join/${COURSE_ID}`,
    "javascript:alert(1)",
    "/\\evil.example.com",
    "/admin",
    "/instructor/courses/new",
    `/join/${COURSE_ID}/../../admin`,
    `/join/${COURSE_ID}?x=https://evil.example.com`,
    `/join/${COURSE_ID}#frag`,
    `/join/${COURSE_ID}/extra`,
    "/join/",
    `/join/${"a".repeat(65)}`,
  ])("rejects/normalizes an unsafe target to /today: %s", (candidate) => {
    expect(resolveNextPathFromSearch(`?next=${encodeURIComponent(candidate)}`)).toBe("/today");
  });

  it("uses the first next value and ignores unrelated params", () => {
    expect(resolveNextPathFromSearch(`?a=1&next=%2Fjoin%2F${COURSE_ID}&next=%2Ftoday`)).toBe(
      `/join/${COURSE_ID}`,
    );
  });
});

/**
 * Regression guard for the join-through-auth bug: in the Next.js App Router a
 * client-side navigation renders the destination page BEFORE the browser URL
 * is updated, so `next` must be read from `window.location` only when USED
 * (inside the submit handler), never in a render-time initializer. There is no
 * component-test infrastructure, so this asserts the source structure.
 */
describe("login page reads `next` only at submit time", () => {
  const source = readFileSync(join(__dirname, "..", "app", "login", "page.tsx"), "utf8");

  it("touches window.location only inside handleSubmit", () => {
    const submitStart = source.indexOf("async function handleSubmit");
    expect(submitStart).toBeGreaterThan(-1);
    const before = source.slice(0, submitStart);
    expect(before).not.toMatch(/window\.location/);
    expect(source.slice(submitStart)).toMatch(/resolveNextPathFromSearch\(window\.location\.search\)/);
  });
});

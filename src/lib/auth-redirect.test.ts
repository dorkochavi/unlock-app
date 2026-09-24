import { describe, expect, it } from "vitest";

import { buildSignUpEmailRedirectTo } from "./auth-redirect";

const COURSE = "3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f";
const ORIGIN = "https://app.example.org";

describe("buildSignUpEmailRedirectTo", () => {
  it("carries a valid /join/:courseId through the confirmation redirect", () => {
    expect(buildSignUpEmailRedirectTo(ORIGIN, `/join/${COURSE}`)).toBe(
      `${ORIGIN}/login?next=%2Fjoin%2F${COURSE}`,
    );
  });

  it("round-trips: the produced next resolves back to the same safe path", () => {
    const url = new URL(buildSignUpEmailRedirectTo(ORIGIN, `/join/${COURSE}`)!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe(`/join/${COURSE}`);
  });

  it("uses a plain /login for the default and null next", () => {
    expect(buildSignUpEmailRedirectTo(ORIGIN, null)).toBe(`${ORIGIN}/login`);
    expect(buildSignUpEmailRedirectTo(ORIGIN, "/today")).toBe(`${ORIGIN}/login`);
  });

  it.each([
    "https://evil.example.com",
    "//evil.example.com",
    "/\tjavascript:alert(1)",
    "/%2F%2Fevil.example.com",
    "/today?x=1",
    "/\\evil.example.com",
    "/join/../x",
    "/join/%0a",
    "/join/x",
    `/join/${COURSE}\n`,
    "/today\n",
    "/instructor/courses/new",
    `/join/${COURSE}?next=//evil.example.com`,
    "javascript:alert(1)",
  ])("never emits an unvalidated next (%j)", (raw) => {
    expect(buildSignUpEmailRedirectTo(ORIGIN, raw)).toBe(`${ORIGIN}/login`);
  });

  it("normalizes the origin, dropping userinfo/path/query", () => {
    expect(
      buildSignUpEmailRedirectTo("https://user:pw@app.example.org:8443/x?y=1", null),
    ).toBe("https://app.example.org:8443/login");
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "null", "", null])(
    "returns null for an unusable origin (%j)",
    (origin) => {
      expect(buildSignUpEmailRedirectTo(origin, `/join/${COURSE}`)).toBeNull();
    },
  );
});

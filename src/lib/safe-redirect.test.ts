import { describe, expect, it } from "vitest";

import { buildSignInHref, resolveSafeNextPath } from "./safe-redirect";

describe("resolveSafeNextPath", () => {
  it("allows the exact internal /today destination", () => {
    expect(resolveSafeNextPath("/today")).toBe("/today");
  });

  it("allows an internal /join/:courseId destination", () => {
    expect(resolveSafeNextPath("/join/3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f")).toBe(
      "/join/3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f",
    );
  });

  it("falls back to /today for null (no next param supplied)", () => {
    expect(resolveSafeNextPath(null)).toBe("/today");
  });

  it("falls back to /today for an external absolute URL", () => {
    expect(resolveSafeNextPath("https://evil.example.com/today")).toBe("/today");
    expect(resolveSafeNextPath("http://evil.example.com")).toBe("/today");
  });

  it("falls back to /today for a protocol-relative URL", () => {
    expect(resolveSafeNextPath("//evil.example.com")).toBe("/today");
    expect(resolveSafeNextPath("//evil.example.com/today")).toBe("/today");
  });

  it("falls back to /today for an embedded scheme", () => {
    expect(resolveSafeNextPath("javascript:alert(1)")).toBe("/today");
    expect(resolveSafeNextPath("/\tjavascript:alert(1)")).toBe("/today");
  });

  it("falls back to /today for a backslash trick", () => {
    expect(resolveSafeNextPath("/\\evil.example.com")).toBe("/today");
  });

  it("falls back to /today for an unlisted internal path", () => {
    expect(resolveSafeNextPath("/admin")).toBe("/today");
    expect(resolveSafeNextPath("/join")).toBe("/today");
    expect(resolveSafeNextPath("/join/")).toBe("/today");
  });

  it("falls back to /today for a malformed/empty value", () => {
    expect(resolveSafeNextPath("")).toBe("/today");
    expect(resolveSafeNextPath("today")).toBe("/today");
  });

  it("falls back to /today when trailing content follows an otherwise-safe path", () => {
    expect(resolveSafeNextPath("/today/../../evil")).toBe("/today");
    expect(resolveSafeNextPath("/today?next=//evil.example.com")).toBe("/today");
  });
});

describe("resolveSafeNextPath — learner Browse destinations (Run UX-01)", () => {
  it("allows exactly /courses, /progress and /courses/:courseId", () => {
    expect(resolveSafeNextPath("/courses")).toBe("/courses");
    expect(resolveSafeNextPath("/progress")).toBe("/progress");
    expect(resolveSafeNextPath("/courses/3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f")).toBe(
      "/courses/3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f",
    );
  });

  it("rejects variants and lookalikes of the new destinations", () => {
    expect(resolveSafeNextPath("/courses/")).toBe("/today");
    expect(resolveSafeNextPath("/courses/abc/edit")).toBe("/today");
    expect(resolveSafeNextPath("/courses/..%2F..%2Fevil")).toBe("/today");
    expect(resolveSafeNextPath("/courses//evil.example.com")).toBe("/today");
    expect(resolveSafeNextPath("/progress?x=1")).toBe("/today");
    expect(resolveSafeNextPath("/progressx")).toBe("/today");
    expect(resolveSafeNextPath("//courses")).toBe("/today");
    expect(resolveSafeNextPath("/courses\\evil.example.com")).toBe("/today");
    expect(resolveSafeNextPath("/progress\n")).toBe("/today");
    expect(resolveSafeNextPath("/COURSES")).toBe("/today");
  });
});

describe("buildSignInHref", () => {
  it("carries next for an allowlisted non-default learner destination", () => {
    expect(buildSignInHref("/courses")).toBe("/login?next=%2Fcourses");
    expect(buildSignInHref("/progress")).toBe("/login?next=%2Fprogress");
    expect(buildSignInHref("/courses/3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f")).toBe(
      "/login?next=%2Fcourses%2F3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f",
    );
  });

  it("uses plain /login for Today (the default) and for anything not allowlisted", () => {
    expect(buildSignInHref("/today")).toBe("/login");
    expect(buildSignInHref("/courses/not-a-uuid!")).toBe("/login");
    expect(buildSignInHref("https://evil.example.com")).toBe("/login");
  });
});

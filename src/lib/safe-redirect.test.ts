import { describe, expect, it } from "vitest";

import { buildSignInHref, resolveNextPathFromSearch, resolveSafeNextPath } from "./safe-redirect";

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

describe("resolveSafeNextPath / resolveNextPathFromSearch — additional open-redirect negatives (PILOT-HARDENING-EVIDENCE-001 D)", () => {
  const ID = "3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f";

  it.each([
    "%2F%2Fevil.example.com",
    "/%2Fevil.example.com",
    "/%5Cevil.example.com",
    "/\\/evil.example.com",
    "/\\evil.example.com",
    "\\evil.example.com",
    "/today\r\nLocation: https://evil.example.com",
    "/today\r",
    "\t/today",
    " /today",
    "/today ",
    "/\u0000/evil.example.com",
    "／／evil.example.com",
    "/∕evil.example.com",
    "/login?next=/join/" + ID,
    `/join/${ID}#//evil.example.com`,
    `/join/${ID}/../../x`,
    "data:text/html,<script>alert(1)</script>",
    "JaVaScRiPt:alert(1)",
  ])("falls back to /today for %j", (raw) => {
    expect(resolveSafeNextPath(raw)).toBe("/today");
  });

  it("treats a percent-encoded or nested next in the query string as opaque and falls back", () => {
    for (const search of [
      "?next=%252F%252Fevil.example.com",
      "?next=%2F%2Fevil.example.com",
      "?next=%2Flogin%3Fnext%3Dhttps%3A%2F%2Fevil.example.com",
      "?next=https%3A%2F%2Fevil.example.com",
      "?next=%2Ftoday%0d%0aSet-Cookie%3Ax",
      "?next=%2Ftoday&next=https%3A%2F%2Fevil.example.com%2F",
    ]) {
      const got = new URLSearchParams(search).get("next");
      expect(got).not.toBeNull();
      // URLSearchParams.get returns the FIRST value; it must resolve to /today.
      expect(resolveSafeNextPath(got)).toBe("/today");
      for (const v of new URLSearchParams(search).getAll("next")) {
        expect(resolveSafeNextPath(v)).not.toMatch(/evil/);
      }
    }
    // Duplicate next: URLSearchParams.get returns the first (safe) value; the malicious second is never read.
    expect(new URLSearchParams("?next=%2Ftoday&next=https%3A%2F%2Fevil.example.com%2F").get("next")).toBe("/today");
  });
});

describe("Instructor next allowlist (FUB-044 Instructor 401 recovery)", () => {
  const ID = "3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f";
  const Q = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
  const ALLOWED = [
    "/instructor/courses",
    "/instructor/courses/new",
    `/instructor/courses/${ID}`,
    `/instructor/courses/${ID}/import`,
    `/instructor/courses/${ID}/item-analysis`,
    `/instructor/courses/${ID}/questions/${Q}`,
  ];

  it.each(ALLOWED)("accepts the exact page %s", (path) => {
    expect(resolveSafeNextPath(path)).toBe(path);
  });

  it.each(ALLOWED)("%s round-trips through buildSignInHref + resolveNextPathFromSearch", (path) => {
    const href = buildSignInHref(path);
    expect(href).toBe(`/login?next=${encodeURIComponent(path)}`);
    expect(resolveNextPathFromSearch(href.slice(href.indexOf("?")))).toBe(path);
  });

  it.each([
    "/instructor",
    "/instructor/",
    "/instructor/courses/",
    "/instructor/courses/new/",
    `/instructor/courses/${ID}/`,
    `/instructor/courses/${ID}/publish`,
    `/instructor/courses/${ID}/questions`,
    `/instructor/courses/${ID}/questions/`,
    `/instructor/courses/${ID}/questions/${Q}/publish`,
    `/instructor/courses/${ID}/import/preview`,
    "/instructor/courses/not-a-uuid!",
    "/instructor/courses/zzz",
    "/instructor/courses/new/extra",
    `/instructor/courses/${ID}?x=1`,
    `/instructor/courses?x=1`,
    `/instructor/courses/${ID}/import?next=/today`,
    `/instructor/courses/${ID}#frag`,
    `/instructor/courses/${ID}/../../x`,
    "/instructor/courses/%2e%2e/x",
    `/instructor/courses/${ID}%2Fimport`,
    "//instructor/courses",
    "/instructor//courses",
    "/instructor/courses//new",
    "/INSTRUCTOR/courses",
    "https://evil.example.com/instructor/courses",
    "/instructor/courses/\evil",
  ])("rejects %s and falls back to /today", (path) => {
    expect(resolveSafeNextPath(path)).toBe("/today");
    expect(buildSignInHref(path)).toBe("/login");
  });

  it("does not let `new` act as a Course id", () => {
    expect(resolveSafeNextPath("/instructor/courses/new/import")).toBe("/today");
  });
});

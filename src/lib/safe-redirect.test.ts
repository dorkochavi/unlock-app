import { describe, expect, it } from "vitest";

import { resolveSafeNextPath } from "./safe-redirect";

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

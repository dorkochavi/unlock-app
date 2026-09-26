import { describe, expect, it } from "vitest";

import { buildSignInHref, resolveSafeNextPath } from "./safe-redirect";

describe("resolveSafeNextPath — Practice destination (Run UX-02)", () => {
  const ID = "3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f";
  const TOPIC = "9a8b7c6d-1234-4abc-8def-0123456789ab";

  it("allows /courses/:id/practice with only the exact topic/from parameters", () => {
    for (const path of [
      `/courses/${ID}/practice`,
      `/courses/${ID}/practice?from=course`,
      `/courses/${ID}/practice?from=progress`,
      `/courses/${ID}/practice?topic=${TOPIC}`,
      `/courses/${ID}/practice?topic=${TOPIC}&from=progress`,
      `/courses/${ID}/practice?from=course&topic=${TOPIC}`,
    ]) {
      expect(resolveSafeNextPath(path)).toBe(path);
    }
  });

  it("rejects anything broader: other params, duplicates, bad origin, trailing paths, open redirects", () => {
    for (const path of [
      `/courses/${ID}/practice?from=evil`,
      `/courses/${ID}/practice?from=course&from=course`,
      `/courses/${ID}/practice?topic=${TOPIC}&topic=${TOPIC}`,
      `/courses/${ID}/practice?next=//evil.example.com`,
      `/courses/${ID}/practice?topic=${TOPIC}&x=1`,
      `/courses/${ID}/practice/answer`,
      `/courses/${ID}/practice?`,
      `/courses/${ID}/practice#x`,
      `/courses/${ID}/practice?topic=../../x`,
      `//evil.example.com/courses/${ID}/practice`,
    ]) {
      expect(resolveSafeNextPath(path)).toBe("/today");
    }
  });

  it("buildSignInHref carries the Practice path (with scope and origin) through next=", () => {
    const path = `/courses/${ID}/practice?topic=${TOPIC}&from=progress`;
    expect(buildSignInHref(path)).toBe(`/login?next=${encodeURIComponent(path)}`);
  });
});

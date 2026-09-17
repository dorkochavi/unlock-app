import { describe, expect, it } from "vitest";
import { deriveIsSameLearningSession } from "../learning-session";

describe("deriveIsSameLearningSession", () => {
  it("returns true when both learningSessionIds are non-null and equal", () => {
    expect(deriveIsSameLearningSession("session-a", "session-a")).toBe(true);
  });

  it("returns false when both learningSessionIds are non-null and different", () => {
    expect(deriveIsSameLearningSession("session-a", "session-b")).toBe(false);
  });

  it("returns null (unknown) when the current Attempt's learningSessionId is null", () => {
    expect(deriveIsSameLearningSession(null, "session-a")).toBeNull();
  });

  it("returns null (unknown) when the baseline learningSessionId is null", () => {
    expect(deriveIsSameLearningSession("session-a", null)).toBeNull();
  });

  it("returns null (unknown) when both are null — never optimistically true", () => {
    expect(deriveIsSameLearningSession(null, null)).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const a = deriveIsSameLearningSession("session-a", "session-b");
    const b = deriveIsSameLearningSession("session-a", "session-b");
    expect(a).toBe(b);
  });
});

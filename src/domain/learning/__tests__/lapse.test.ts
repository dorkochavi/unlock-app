import { describe, expect, it } from "vitest";
import { deriveHasUnresolvedLapse } from "../lapse";

describe("deriveHasUnresolvedLapse", () => {
  it("1. no lapse -> false", () => {
    expect(
      deriveHasUnresolvedLapse(null, new Date("2026-01-01T00:00:00.000Z")),
    ).toBe(false);
    expect(deriveHasUnresolvedLapse(null, null)).toBe(false);
  });

  it("2. lapse with no retrieval baseline -> true", () => {
    expect(
      deriveHasUnresolvedLapse(new Date("2026-01-01T00:00:00.000Z"), null),
    ).toBe(true);
  });

  it("3. baseline before lapse -> true (unresolved)", () => {
    expect(
      deriveHasUnresolvedLapse(
        new Date("2026-01-05T00:00:00.000Z"),
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("4. baseline after lapse -> false (resolved)", () => {
    expect(
      deriveHasUnresolvedLapse(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-05T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("5. baseline exactly equal to lapse -> false (strict >, not >=)", () => {
    const same = new Date("2026-01-03T00:00:00.000Z");
    expect(
      deriveHasUnresolvedLapse(same, new Date(same.getTime())),
    ).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const lastLapseAt = new Date("2026-01-05T00:00:00.000Z");
    const retrievalBaselineAt = new Date("2026-01-01T00:00:00.000Z");

    const resultA = deriveHasUnresolvedLapse(lastLapseAt, retrievalBaselineAt);
    const resultB = deriveHasUnresolvedLapse(lastLapseAt, retrievalBaselineAt);

    expect(resultA).toBe(resultB);
  });
});

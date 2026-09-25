import { describe, expect, it } from "vitest";

import { canOpenAnswerAnalysis } from "../analysis-entry";
import { toPublicDisclosure } from "../aggregate-disclosure";
import { deriveAnswerBand } from "../answer-band";

describe("deriveAnswerBand", () => {
  it.each([
    // [correct, total, band]
    [3, 3, "MOSTLY_CORRECT"],
    [7, 10, "MOSTLY_CORRECT"], // 21 > 20
    [2, 3, "MIXED"], // exactly 2/3
    [1, 3, "MIXED"], // exactly 1/3
    [4, 6, "MIXED"], // exactly 2/3
    [2, 6, "MIXED"], // exactly 1/3
    [6, 10, "MIXED"], // 18 <= 20
    [4, 10, "MIXED"], // 12 >= 10
    [3, 10, "MOSTLY_INCORRECT"], // 9 < 10
    [0, 5, "MOSTLY_INCORRECT"],
    [1, 5, "MOSTLY_INCORRECT"], // 3 < 5
    [2, 5, "MIXED"], // 6 >= 5
  ] as const)("%i of %i correct -> %s", (correct, total, band) => {
    expect(deriveAnswerBand(correct, total)).toBe(band);
  });

  it("matches the exact integer boundaries for every n in 1..200 and every c", () => {
    for (let n = 1; n <= 200; n++) {
      for (let c = 0; c <= n; c++) {
        const expected =
          3 * c > 2 * n ? "MOSTLY_CORRECT" : 3 * c < n ? "MOSTLY_INCORRECT" : "MIXED";
        expect(deriveAnswerBand(c, n), `c=${c} n=${n}`).toBe(expected);
      }
    }
  });

  it("exactly 1/3 and exactly 2/3 are always MIXED, one either side flips the band", () => {
    for (const k of [1, 2, 5, 10, 33]) {
      const n = 3 * k;
      expect(deriveAnswerBand(k, n)).toBe("MIXED"); // exactly 1/3
      expect(deriveAnswerBand(2 * k, n)).toBe("MIXED"); // exactly 2/3
      expect(deriveAnswerBand(k - 1, n)).toBe("MOSTLY_INCORRECT");
      expect(deriveAnswerBand(2 * k + 1, n)).toBe("MOSTLY_CORRECT");
    }
  });

  it.each([
    [0, 0],
    [1, 0],
    [-1, 5],
    [6, 5],
    [1.5, 5],
    [1, 5.5],
    [Number.NaN, 5],
  ])("rejects invalid counts (c=%s, n=%s) rather than guessing", (c, n) => {
    expect(() => deriveAnswerBand(c, n)).toThrow();
  });
});

describe("toPublicDisclosure", () => {
  it("collapses both suppression reasons into one INSUFFICIENT_DATA", () => {
    expect(toPublicDisclosure("ELIGIBLE")).toBe("ELIGIBLE");
    expect(toPublicDisclosure("INSUFFICIENT_COURSE_SIZE")).toBe("INSUFFICIENT_DATA");
    expect(toPublicDisclosure("INSUFFICIENT_RESPONSES")).toBe("INSUFFICIENT_DATA");
  });
});

describe("canOpenAnswerAnalysis (entry-point visibility)", () => {
  it("is true only for a PUBLISHED Course — never a link to a 409 page", () => {
    expect(canOpenAnswerAnalysis("PUBLISHED")).toBe(true);
    expect(canOpenAnswerAnalysis("DRAFT")).toBe(false);
    expect(canOpenAnswerAnalysis("ARCHIVED")).toBe(false);
  });
});

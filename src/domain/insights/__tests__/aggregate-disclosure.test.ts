import { describe, expect, it } from "vitest";

import {
  decideAggregateDisclosure,
  MIN_ACTIVE_LEARNERS_FOR_DISCLOSURE,
  MIN_DISTINCT_RESPONDERS_FOR_DISCLOSURE,
} from "../aggregate-disclosure";

describe("aggregate-disclosure thresholds", () => {
  it("are the accepted pilot values", () => {
    expect(MIN_ACTIVE_LEARNERS_FOR_DISCLOSURE).toBe(5);
    expect(MIN_DISTINCT_RESPONDERS_FOR_DISCLOSURE).toBe(5);
  });
});

describe("decideAggregateDisclosure", () => {
  it("is ELIGIBLE exactly at both thresholds", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 5, distinctResponderCount: 5 })).toBe("ELIGIBLE");
  });

  it("is ELIGIBLE above both thresholds", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 40, distinctResponderCount: 22 })).toBe("ELIGIBLE");
  });

  it("is INSUFFICIENT_COURSE_SIZE one below the learner threshold", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 4, distinctResponderCount: 4 })).toBe(
      "INSUFFICIENT_COURSE_SIZE",
    );
  });

  it("reports course size first even when responders are also insufficient", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 0, distinctResponderCount: 0 })).toBe(
      "INSUFFICIENT_COURSE_SIZE",
    );
  });

  it("is INSUFFICIENT_RESPONSES when the Course is large enough but responders are one below threshold", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 30, distinctResponderCount: 4 })).toBe(
      "INSUFFICIENT_RESPONSES",
    );
  });

  it("is INSUFFICIENT_RESPONSES for zero responders in a large Course", () => {
    expect(decideAggregateDisclosure({ activeLearnerCount: 30, distinctResponderCount: 0 })).toBe(
      "INSUFFICIENT_RESPONSES",
    );
  });

  it("is deterministic for identical input", () => {
    const input = { activeLearnerCount: 12, distinctResponderCount: 3 };
    expect(decideAggregateDisclosure(input)).toBe(decideAggregateDisclosure({ ...input }));
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws (fails closed) on invalid count %s",
    (bad) => {
      expect(() => decideAggregateDisclosure({ activeLearnerCount: bad, distinctResponderCount: 5 })).toThrow();
      expect(() => decideAggregateDisclosure({ activeLearnerCount: 5, distinctResponderCount: bad })).toThrow();
    },
  );
});

import { describe, expect, it } from "vitest";

import type { MasteryCategory, MisconceptionState } from "../../learning/types";
import {
  deriveLearnerTopicProgress,
  meetsSolidCoverageGate,
  type TopicQuestionLearnerState,
} from "../topic-progress";

const T0 = new Date("2026-09-01T00:00:00Z");
const T1 = new Date("2026-09-02T00:00:00Z");

function attempted(
  overrides: {
    masteryCategory?: MasteryCategory;
    misconceptionState?: MisconceptionState;
    lastLapseAt?: Date | null;
    retrievalBaselineAt?: Date | null;
  } = {},
): TopicQuestionLearnerState {
  return {
    attempted: true,
    progress: {
      masteryCategory: "mastered",
      misconceptionState: "none",
      lastLapseAt: null,
      retrievalBaselineAt: null,
      ...overrides,
    },
  };
}
const unseen: TopicQuestionLearnerState = { attempted: false, progress: null };
const strong = () => attempted({ masteryCategory: "strengthening" });

describe("meetsSolidCoverageGate", () => {
  it.each([
    // [N, A, expected]
    [0, 0, false],
    [1, 0, false],
    [1, 1, true],
    [2, 1, false],
    [2, 2, true],
    [3, 2, false],
    [3, 3, true],
    [4, 2, false], // A < 3
    [4, 3, true],
    [5, 2, false],
    [5, 3, true],
    [6, 3, true], // exactly 50%
    [7, 3, false], // 2A=6 < 7
    [7, 4, true],
    [10, 4, false],
    [10, 5, true],
  ])("N=%i A=%i -> %s", (n, a, expected) => {
    expect(meetsSolidCoverageGate(n, a)).toBe(expected);
  });
});

describe("deriveLearnerTopicProgress", () => {
  it("NOT_STARTED with no attempts (and empty Topic), even with stale progress rows", () => {
    expect(deriveLearnerTopicProgress([unseen, unseen])).toEqual({
      state: "NOT_STARTED",
      attemptedCount: 0,
      totalCount: 2,
    });
    expect(deriveLearnerTopicProgress([]).state).toBe("NOT_STARTED");
    // A progress row without a real Attempt is not evidence.
    const staleRow: TopicQuestionLearnerState = {
      attempted: false,
      progress: attempted().progress,
    };
    expect(deriveLearnerTopicProgress([staleRow]).state).toBe("NOT_STARTED");
  });

  it("SOLID when all attempted are strengthening/mastered and coverage is met", () => {
    expect(deriveLearnerTopicProgress([attempted(), strong(), attempted()])).toEqual({
      state: "SOLID",
      attemptedCount: 3,
      totalCount: 3,
    });
    expect(deriveLearnerTopicProgress([attempted()]).state).toBe("SOLID");
  });

  it("sparse evidence resolves to IN_PROGRESS, never NEEDS_REINFORCEMENT", () => {
    expect(deriveLearnerTopicProgress([attempted({ masteryCategory: "learning" })]).state).toBe(
      "IN_PROGRESS",
    );
    expect(
      deriveLearnerTopicProgress([attempted({ masteryCategory: "not_started" }), unseen]).state,
    ).toBe("IN_PROGRESS");
    // Attempted but no progress row: conservative, not SOLID, not reinforcement.
    expect(deriveLearnerTopicProgress([{ attempted: true, progress: null }]).state).toBe(
      "IN_PROGRESS",
    );
  });

  it("strong evidence but insufficient coverage stays IN_PROGRESS", () => {
    expect(deriveLearnerTopicProgress([attempted(), unseen]).state).toBe("IN_PROGRESS"); // N=2 needs A=2
    expect(deriveLearnerTopicProgress([attempted(), attempted(), unseen, unseen]).state).toBe(
      "IN_PROGRESS",
    ); // N=4 needs A>=3
    expect(
      deriveLearnerTopicProgress([
        attempted(),
        attempted(),
        attempted(),
        unseen,
        unseen,
        unseen,
        unseen,
      ]).state,
    ).toBe("IN_PROGRESS"); // N=7, A=3: 2A<N
    expect(
      deriveLearnerTopicProgress([attempted(), attempted(), attempted(), unseen, unseen, unseen])
        .state,
    ).toBe("SOLID"); // N=6, A=3 exactly at gate
  });

  it("one weaker attempted Question keeps the Topic out of SOLID", () => {
    expect(
      deriveLearnerTopicProgress([
        attempted(),
        attempted(),
        attempted({ masteryCategory: "learning" }),
      ]).state,
    ).toBe("IN_PROGRESS");
  });

  it("active misconception -> NEEDS_REINFORCEMENT, and it outranks SOLID", () => {
    expect(
      deriveLearnerTopicProgress([
        attempted(),
        attempted(),
        attempted({ misconceptionState: "active" }),
      ]),
    ).toMatchObject({ state: "NEEDS_REINFORCEMENT" });
  });

  it("unresolved lapse -> NEEDS_REINFORCEMENT; a resolved lapse is not", () => {
    expect(
      deriveLearnerTopicProgress([attempted({ lastLapseAt: T1, retrievalBaselineAt: T0 })]).state,
    ).toBe("NEEDS_REINFORCEMENT");
    expect(
      deriveLearnerTopicProgress([attempted({ lastLapseAt: T1, retrievalBaselineAt: null })]).state,
    ).toBe("NEEDS_REINFORCEMENT");
    expect(
      deriveLearnerTopicProgress([attempted({ lastLapseAt: T0, retrievalBaselineAt: T1 })]).state,
    ).toBe("SOLID");
  });

  it.each<MisconceptionState>(["suspected", "recovering", "resolved", "none"])(
    "misconception %s alone never triggers NEEDS_REINFORCEMENT",
    (misconceptionState) => {
      expect(
        deriveLearnerTopicProgress([attempted({ misconceptionState, masteryCategory: "learning" })])
          .state,
      ).toBe("IN_PROGRESS");
    },
  );

  it("a single weak signal (learning + suspected) alongside strong Questions stays IN_PROGRESS", () => {
    expect(
      deriveLearnerTopicProgress([
        attempted({ masteryCategory: "learning", misconceptionState: "suspected" }),
        attempted(),
        attempted(),
      ]).state,
    ).toBe("IN_PROGRESS");
  });

  it("reinforcement signals on UNattempted Questions are ignored", () => {
    const stale: TopicQuestionLearnerState = {
      attempted: false,
      progress: attempted({ misconceptionState: "active" }).progress,
    };
    expect(deriveLearnerTopicProgress([attempted(), stale]).state).toBe("IN_PROGRESS");
  });

  it("is deterministic and order-independent", () => {
    const qs = [attempted(), attempted({ masteryCategory: "learning" }), unseen, strong()];
    const a = deriveLearnerTopicProgress(qs);
    expect(deriveLearnerTopicProgress([...qs].reverse())).toEqual(a);
    expect(deriveLearnerTopicProgress(qs)).toEqual(a);
  });
});

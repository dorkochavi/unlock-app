/**
 * Golden Dataset v0.1 types (docs/ASSESSMENT_ENGINE.md section 19; AE-004 / AE-033).
 *
 * The dataset is an EVALUATION FIXTURE for the unwired deterministic linter, NOT training data.
 * Synthetic only. It never contains real course content.
 */
import type { QuestionLintInput } from "../question-lint";

/** Why a ground-truth detection is not produced by the current linter. */
export type KnownMissKind =
  /** The check code exists but its heuristic does not catch this case. */
  | "HEURISTIC_GAP"
  /** No implemented check covers this flaw at all (documented unimplemented code, AE-029). */
  | "NOT_IMPLEMENTED";

export interface GoldenKnownMiss {
  /** Ground-truth codes (all also listed in expectedCodes) the linter currently does not emit. */
  codes: string[];
  kind: KnownMissKind;
  reason: string;
}

export interface GoldenKnownFalsePositive {
  /** Codes the linter currently emits although ground truth says they must not fire (also in forbiddenCodes). */
  codes: string[];
  reason: string;
}

export interface GoldenExpected {
  /** Codes that MUST appear according to ground truth (a missing one is a false negative). */
  expectedCodes: string[];
  /** Codes that MUST NOT appear according to ground truth (an emitted one is a false positive). */
  forbiddenCodes: string[];
  /** CLEAN case: no WARNING or ERROR at all is correct; any other WARNING/ERROR counts as a false positive. */
  clean?: boolean;
  /**
   * SEMANTIC_EXPECTATION: a quality judgment the deterministic linter cannot prove. It is NEVER asserted
   * against the linter; such cases are counted as "intentionally unsupported semantic cases".
   */
  semanticExpectation?: string;
  knownMiss?: GoldenKnownMiss;
  knownFalsePositive?: GoldenKnownFalsePositive;
}

interface GoldenCaseBase {
  id: string;
  tags: string[];
  description: string;
  expected: GoldenExpected;
}

/** Item-scope case: run through lintQuestionItem. `input` is deliberately `unknown` for hostile-input cases. */
export interface GoldenItemCase extends GoldenCaseBase {
  scope: "ITEM";
  input: QuestionLintInput | unknown;
}

/** Set-scope case: run through lintQuestionSet. */
export interface GoldenSetCase extends GoldenCaseBase {
  scope: "SET";
  set: ReadonlyArray<QuestionLintInput | unknown>;
}

export type GoldenCase = GoldenItemCase | GoldenSetCase;

export interface GoldenDataset {
  version: string;
  cases: ReadonlyArray<GoldenCase>;
}

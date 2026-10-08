/**
 * SYNTHETIC golden scenarios for the Assessment Blueprint prototype
 * (Run 2026-10-08-ASSESSMENT-ENGINE-003, Slice C4). Invented data only: no real course,
 * institution, or question content. Each scenario declares its expected outcome explicitly.
 *
 * Fixtures only; no logic. Asserted in __tests__/blueprint-scenarios.test.ts.
 */
import type {
  Blueprint,
  BlueprintSeverity,
  CellStatus,
  CoverageItem,
  DeclaredObjective,
  TotalStatus,
} from "./blueprint";

export interface ExpectedIssue {
  readonly code: string;
  readonly severity: BlueprintSeverity;
  readonly objectiveId?: string;
}

export interface ExpectedTopic {
  readonly topicId: string;
  readonly declaredObjectives: number;
  readonly coveredObjectives: number;
  readonly distinctQuestions: number;
  readonly sumMin: number;
  readonly sumMax: number | null;
}

export interface BlueprintScenario {
  readonly id: string;
  readonly title: string;
  readonly blueprint: Blueprint;
  readonly declared: readonly DeclaredObjective[];
  readonly items: readonly CoverageItem[];
  readonly expected: {
    /** In output order (code, then objectiveId, then message). */
    readonly issues: readonly ExpectedIssue[];
    readonly totalStatus: TotalStatus;
    /** Valid cells only. */
    readonly cellStatuses: Readonly<Record<string, CellStatus>>;
    readonly unallocated: readonly string[];
    readonly covered: number;
    readonly declared: number;
    readonly topics?: readonly ExpectedTopic[];
  };
  readonly notes: string;
  /** DETERMINISTIC COVERAGE vs PEDAGOGICAL QUALITY, in this scenario's terms. */
  readonly boundary: string;
}

const COURSE = "קורס-דמו";

const U3: readonly DeclaredObjective[] = [
  { id: "O1", topicId: "T1" },
  { id: "O2", topicId: "T1" },
  { id: "O3", topicId: "T2" },
];

function bp(name: string, targetTotal: number | null, cells: Blueprint["cells"]): Blueprint {
  return { id: `BP-${name}`, name, courseId: COURSE, targetTotal, cells };
}

const q = (questionId: string, ...objectiveIds: string[]): CoverageItem => ({
  questionId,
  objectiveIds,
});

export const ALLOCATION_WITHIN_BOUNDS: BlueprintScenario = {
  id: "allocation-within-bounds",
  title: "הקצאה בתוך הגבולות",
  blueprint: bp("מבחן-בגבולות", 3, [
    { objectiveId: "O1", min: 1, max: 2 },
    { objectiveId: "O2", min: 1, max: 2 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2"), q("q3", "O3")],
  expected: {
    issues: [],
    totalStatus: "OK",
    cellStatuses: { O1: "OK", O2: "OK", O3: "OK" },
    unallocated: [],
    covered: 3,
    declared: 3,
  },
  notes: "Every cell within bounds, total met, every declared objective has a question.",
  boundary:
    "DETERMINISTIC COVERAGE: 3 of 3 declared objectives received at least one allocated question. " +
    "PEDAGOGICAL QUALITY: not assessed; the code does not say these counts are the right ones.",
};

export const OBJECTIVE_OMITTED: BlueprintScenario = {
  id: "objective-omitted",
  title: "יעד ללא שאלות",
  blueprint: bp("מבחן-חסר", 3, [
    { objectiveId: "O1", min: 1, max: 2 },
    { objectiveId: "O2", min: 1, max: 2 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2"), q("q3", "O2")],
  expected: {
    issues: [],
    totalStatus: "OK",
    cellStatuses: { O1: "OK", O2: "OK", O3: "UNDER" },
    unallocated: [],
    covered: 2,
    declared: 3,
  },
  notes: "The plan is valid; the question set leaves O3 at 0 against a min of 1. Total still matches.",
  boundary:
    "DETERMINISTIC COVERAGE: Objective O3 received zero allocated questions (min 1), coverage 2 of 3. " +
    "PEDAGOGICAL QUALITY: the code never claims what O3 deserves or whether skipping it matters.",
};

export const OBJECTIVE_OVERREPRESENTED: BlueprintScenario = {
  id: "objective-overrepresented",
  title: "יעד עם עודף שאלות",
  blueprint: bp("מבחן-עודף", 4, [
    { objectiveId: "O1", min: 1, max: 1 },
    { objectiveId: "O2", min: 1, max: 2 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O1"), q("q3", "O2"), q("q4", "O3")],
  expected: {
    issues: [],
    totalStatus: "OK",
    cellStatuses: { O1: "OVER", O2: "OK", O3: "OK" },
    unallocated: [],
    covered: 3,
    declared: 3,
  },
  notes: "O1 has 2 allocated questions against a max of 1; other cells and the total are fine.",
  boundary:
    "DETERMINISTIC COVERAGE: Objective O1 has 2 allocated questions, above its declared max of 1. " +
    "PEDAGOGICAL QUALITY: the code does not judge whether heavy weight on O1 is wise.",
};

export const INVALID_ALLOCATION: BlueprintScenario = {
  id: "invalid-allocation",
  title: "הקצאה לא תקינה",
  blueprint: bp("מבחן-שגוי", 2, [
    { objectiveId: "O1", min: -1, max: 2 },
    { objectiveId: "O2", min: 3, max: 1 },
    { objectiveId: "O9", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2")],
  expected: {
    issues: [
      { code: "BLUEPRINT_CELL_COUNT_INVALID", severity: "ERROR", objectiveId: "O1" },
      { code: "BLUEPRINT_CELL_MIN_GT_MAX", severity: "ERROR", objectiveId: "O2" },
      { code: "BLUEPRINT_OBJECTIVE_UNALLOCATED", severity: "WARNING", objectiveId: "O3" },
      { code: "BLUEPRINT_OBJECTIVE_UNKNOWN", severity: "ERROR", objectiveId: "O9" },
    ],
    totalStatus: "OK",
    cellStatuses: {},
    unallocated: ["O1", "O2", "O3"],
    covered: 2,
    declared: 3,
  },
  notes:
    "Negative min, min greater than max, and an undeclared objective. No cell is valid, so coverage " +
    "lists all declared objectives as unallocated, while validation reports UNALLOCATED only for O3 " +
    "(the only objective with no cell of any kind).",
  boundary:
    "DETERMINISTIC COVERAGE: three cells are structurally unusable and O3 has no cell. " +
    "PEDAGOGICAL QUALITY: not assessed; the code only reports that the plan cannot be read as given.",
};

export const DUPLICATE_CELL: BlueprintScenario = {
  id: "duplicate-cell",
  title: "תא כפול",
  blueprint: bp("מבחן-כפול", null, [
    { objectiveId: "O1", min: 1, max: 2 },
    { objectiveId: "O1", min: 0, max: 1 },
    { objectiveId: "O2", min: 1, max: 2 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2"), q("q3", "O3")],
  expected: {
    issues: [{ code: "BLUEPRINT_CELL_DUPLICATE", severity: "ERROR", objectiveId: "O1" }],
    totalStatus: "NOT_EVALUATED",
    cellStatuses: { O2: "OK", O3: "OK" },
    unallocated: ["O1"],
    covered: 3,
    declared: 3,
  },
  notes:
    "O1 appears in two cells; one DUPLICATE issue, and neither O1 cell is evaluated. No target total declared.",
  boundary:
    "DETERMINISTIC COVERAGE: Objective O1 is declared twice, so its allocation is ambiguous. " +
    "PEDAGOGICAL QUALITY: the code does not choose which of the two counts the instructor meant.",
};

const withMeta = (
  questionId: string,
  objectiveId: string,
  cognitive: string,
  difficulty: string,
): CoverageItem & { cognitive: string; difficulty: string } => ({
  questionId,
  objectiveIds: [objectiveId],
  cognitive,
  difficulty,
});

export const COGNITIVE_DIFFICULTY_NOT_EVALUATED: BlueprintScenario = {
  id: "cognitive-difficulty-not-evaluated",
  title: "רמה קוגניטיבית וקושי אינם נבדקים",
  blueprint: bp("מבחן-מטא", 3, [
    { objectiveId: "O1", min: 1, max: 2 },
    { objectiveId: "O2", min: 1, max: 2 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [
    withMeta("q1", "O1", "recall", "hard"),
    withMeta("q2", "O2", "recall", "hard"),
    withMeta("q3", "O3", "recall", "hard"),
  ],
  expected: {
    issues: [],
    totalStatus: "OK",
    cellStatuses: { O1: "OK", O2: "OK", O3: "OK" },
    unallocated: [],
    covered: 3,
    declared: 3,
  },
  notes:
    "Cognitive-level and difficulty mix are OUT of scope for v0.1 (Blueprint doc 2.1). All items carry the same " +
    "cognitive/difficulty metadata; the prototype ignores it and emits no distribution findings. This scenario shows " +
    "the absence of that feature; it is not a claim that the mix is acceptable.",
  boundary:
    "DETERMINISTIC COVERAGE: counts per objective only; cognitive and difficulty are not counted. " +
    "PEDAGOGICAL QUALITY: not assessed; an all-recall, all-hard set produces the same report as any other mix.",
};

export const MULTIPLE_TOPICS: BlueprintScenario = {
  id: "multiple-topics",
  title: "ריבוי נושאים",
  blueprint: bp("מבחן-נושאים", 5, [
    { objectiveId: "O1", min: 1, max: 2 },
    { objectiveId: "O2", min: 1, max: null },
    { objectiveId: "O3", min: 0, max: 1 },
    { objectiveId: "O4", min: 1, max: 1 },
    { objectiveId: "O5", min: 1, max: 3 },
  ]),
  declared: [
    { id: "O1", topicId: "T1" },
    { id: "O2", topicId: "T1" },
    { id: "O3", topicId: "T2" },
    { id: "O4", topicId: "T2" },
    { id: "O5", topicId: "T3" },
  ],
  items: [q("q1", "O1"), q("q2", "O1", "O2"), q("q3", "O3"), q("q4", "O5")],
  expected: {
    issues: [],
    totalStatus: "UNDER",
    cellStatuses: { O1: "OK", O2: "OK", O3: "OK", O4: "UNDER", O5: "OK" },
    unallocated: [],
    covered: 4,
    declared: 5,
    topics: [
      { topicId: "T1", declaredObjectives: 2, coveredObjectives: 2, distinctQuestions: 2, sumMin: 2, sumMax: null },
      { topicId: "T2", declaredObjectives: 2, coveredObjectives: 1, distinctQuestions: 1, sumMin: 1, sumMax: 2 },
      { topicId: "T3", declaredObjectives: 1, coveredObjectives: 1, distinctQuestions: 1, sumMin: 1, sumMax: 3 },
    ],
  },
  notes:
    "Per-Topic roll-up: T1 has an unbounded cell so sumMax is null; T2 covers 1 of 2 objectives; total 4 of target 5.",
  boundary:
    "DETERMINISTIC COVERAGE: Topic T2 covers 1 of its 2 declared objectives. " +
    "PEDAGOGICAL QUALITY: the code never says whether a Topic ought to carry more or fewer questions.",
};

export const TOTAL_BELOW_MINS: BlueprintScenario = {
  id: "total-below-mins",
  title: "סך הכול נמוך מסכום המינימום",
  blueprint: bp("מבחן-סכום-נמוך", 4, [
    { objectiveId: "O1", min: 2, max: 3 },
    { objectiveId: "O2", min: 2, max: 3 },
    { objectiveId: "O3", min: 1, max: 2 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2")],
  expected: {
    issues: [{ code: "BLUEPRINT_TOTAL_BELOW_MINS", severity: "ERROR" }],
    totalStatus: "UNDER",
    cellStatuses: { O1: "UNDER", O2: "UNDER", O3: "UNDER" },
    unallocated: [],
    covered: 2,
    declared: 3,
  },
  notes: "Target total 4 is below the sum of minimums 5: the plan contradicts itself regardless of items.",
  boundary:
    "DETERMINISTIC COVERAGE: target 4 is less than the sum of cell minimums 5. " +
    "PEDAGOGICAL QUALITY: the code does not say which number to change.",
};

export const TOTAL_ABOVE_MAXES: BlueprintScenario = {
  id: "total-above-maxes",
  title: "סך הכול גבוה מסכום המקסימום",
  blueprint: bp("מבחן-סכום-גבוה", 5, [
    { objectiveId: "O1", min: 0, max: 1 },
    { objectiveId: "O2", min: 0, max: 1 },
    { objectiveId: "O3", min: 0, max: 1 },
  ]),
  declared: U3,
  items: [q("q1", "O1"), q("q2", "O2"), q("q3", "O3")],
  expected: {
    issues: [{ code: "BLUEPRINT_TOTAL_ABOVE_MAXES", severity: "ERROR" }],
    totalStatus: "UNDER",
    cellStatuses: { O1: "OK", O2: "OK", O3: "OK" },
    unallocated: [],
    covered: 3,
    declared: 3,
  },
  notes: "Target total 5 exceeds the sum of maximums 3: unreachable within the cells, regardless of items.",
  boundary:
    "DETERMINISTIC COVERAGE: target 5 is greater than the sum of cell maximums 3. " +
    "PEDAGOGICAL QUALITY: the code does not say whether the cells or the total is the intended one.",
};

export const ALL_SCENARIOS: readonly BlueprintScenario[] = [
  ALLOCATION_WITHIN_BOUNDS,
  OBJECTIVE_OMITTED,
  OBJECTIVE_OVERREPRESENTED,
  INVALID_ALLOCATION,
  DUPLICATE_CELL,
  COGNITIVE_DIFFICULTY_NOT_EVALUATED,
  MULTIPLE_TOPICS,
  TOTAL_BELOW_MINS,
  TOTAL_ABOVE_MAXES,
];

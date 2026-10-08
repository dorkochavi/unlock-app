/**
 * Pure deterministic Assessment Blueprint PROTOTYPE
 * (docs/ASSESSMENT_BLUEPRINT_V0_1.md Part 2; Run 2026-10-08-ASSESSMENT-ENGINE-003, Slice C3).
 *
 * Status: NOT wired into question-lint, import, publish, API or UI. No persistence.
 * Pure functions: no IO, no network, no AI, no Date/random. Inputs are never mutated.
 * Never throws on bad plan data: it yields issues. Output is independent of input order
 * (all lists sorted by id in code-unit order).
 *
 * HARD BOUNDARY: this code states counts only. It never says what an objective "deserves",
 * what amount is "right", or whether a linked question actually tests its objective.
 *
 * BOUNDS (c = cells, u = declared objectives, n = items, l = total links): O((c + u + n + l) log)
 * overall (sorting dominates; topic roll-up is a single grouping pass over the universe).
 * No pairwise loops over items or over topics x objectives.
 *
 * Interpretation choices where the doc is not explicit are listed in
 * docs/ASSESSMENT_BLUEPRINT_V0_1.md, section "Resolved in the C3 prototype".
 */

export type BlueprintSeverity = "ERROR" | "WARNING";

export interface BlueprintCell {
  readonly objectiveId: string;
  readonly min: number;
  /** null = unbounded. */
  readonly max: number | null;
}

export interface Blueprint {
  readonly id: string;
  readonly name: string;
  readonly courseId: string;
  /** null = no total declared. */
  readonly targetTotal: number | null;
  readonly cells: readonly BlueprintCell[];
}

export interface DeclaredObjective {
  readonly id: string;
  readonly topicId: string;
}

export interface CoverageItem {
  readonly questionId: string;
  readonly objectiveIds: readonly string[];
}

export interface BlueprintIssue {
  readonly code: string;
  readonly severity: BlueprintSeverity;
  readonly objectiveId?: string;
  readonly message: string;
}

export type CellStatus = "UNDER" | "OVER" | "OK";
export type TotalStatus = "UNDER" | "OVER" | "OK" | "NOT_EVALUATED";

export interface CellCoverage {
  readonly objectiveId: string;
  readonly min: number;
  readonly max: number | null;
  readonly actual: number;
  readonly status: CellStatus;
}

export interface UnallocatedObjective {
  readonly objectiveId: string;
  readonly actual: number;
}

export interface UnknownObjectiveRef {
  readonly questionId: string;
  readonly objectiveId: string;
}

export interface DistributionEntry {
  readonly objectiveId: string;
  readonly actual: number;
  /** Present only when a valid cell exists for the objective. */
  readonly min?: number;
  readonly max?: number | null;
}

export interface TopicRollup {
  readonly topicId: string;
  readonly declaredObjectives: number;
  readonly coveredObjectives: number;
  readonly distinctQuestions: number;
  readonly sumMin: number;
  /** null if any of the topic's valid cells is unbounded, or it has none. */
  readonly sumMax: number | null;
}

export interface CoverageReport {
  readonly totalDistinctQuestions: number;
  readonly totalStatus: TotalStatus;
  readonly cells: readonly CellCoverage[];
  readonly unallocated: readonly UnallocatedObjective[];
  readonly unlinkedQuestionIds: readonly string[];
  readonly unknownObjectiveRefs: readonly UnknownObjectiveRef[];
  readonly duplicateQuestionIds: readonly string[];
  readonly coverage: {
    readonly covered: number;
    readonly declared: number;
    readonly ratio: number | null;
  };
  readonly distribution: readonly DistributionEntry[];
  readonly topics: readonly TopicRollup[];
}

export const BLUEPRINT_CODES = {
  CELL_COUNT_INVALID: "BLUEPRINT_CELL_COUNT_INVALID",
  CELL_MIN_GT_MAX: "BLUEPRINT_CELL_MIN_GT_MAX",
  CELL_DUPLICATE: "BLUEPRINT_CELL_DUPLICATE",
  OBJECTIVE_UNKNOWN: "BLUEPRINT_OBJECTIVE_UNKNOWN",
  TOTAL_INVALID: "BLUEPRINT_TOTAL_INVALID",
  TOTAL_BELOW_MINS: "BLUEPRINT_TOTAL_BELOW_MINS",
  TOTAL_ABOVE_MAXES: "BLUEPRINT_TOTAL_ABOVE_MAXES",
  OBJECTIVE_UNALLOCATED: "BLUEPRINT_OBJECTIVE_UNALLOCATED",
} as const;

// ---------------------------------------------------------------------------
// helpers

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Upper bound for any cell min/max and for targetTotal. Larger values are reported as
 * invalid so that sums over cells (at most MAX * number-of-cells) stay far below
 * Number.MAX_SAFE_INTEGER and never lose precision.
 */
export const MAX_BLUEPRINT_COUNT = 1_000_000;

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MAX_BLUEPRINT_COUNT;
}

function asArray<T>(v: readonly T[] | null | undefined): readonly T[] {
  return Array.isArray(v) ? v : [];
}

function idOf(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Declared universe deduped by id (smallest topicId wins on conflict), sorted by id. */
function normalizeUniverse(declared: readonly DeclaredObjective[]): Map<string, string> {
  const rows: Array<{ id: string; topicId: string }> = [];
  for (const d of asArray(declared)) {
    if (d && typeof d.id === "string" && typeof d.topicId === "string") {
      rows.push({ id: d.id, topicId: d.topicId });
    }
  }
  rows.sort((a, b) => cmp(a.id, b.id) || cmp(a.topicId, b.topicId));
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.id)) out.set(r.id, r.topicId);
  return out;
}

interface CellAnalysis {
  /** Per-cell defects (one entry per defective cell, with objectiveId when a string). */
  readonly countInvalid: Array<string | undefined>;
  readonly minGtMax: Array<string | undefined>;
  readonly duplicateIds: string[];
  readonly unknownIds: Array<string | undefined>;
  /** Valid cells sorted by objectiveId. */
  readonly valid: Array<{ objectiveId: string; min: number; max: number | null }>;
  /** Every objectiveId that appears in any cell (valid or not). */
  readonly anyCellIds: Set<string>;
}

function analyzeCells(
  blueprint: Blueprint,
  universe: ReadonlyMap<string, string>,
): CellAnalysis {
  const cells = asArray(blueprint ? blueprint.cells : undefined);
  const idCounts = new Map<string, number>();
  for (const c of cells) {
    const id = idOf(c?.objectiveId);
    if (id !== undefined) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id)
    .sort(cmp);

  const countInvalid: Array<string | undefined> = [];
  const minGtMax: Array<string | undefined> = [];
  const unknownIds: Array<string | undefined> = [];
  const valid: Array<{ objectiveId: string; min: number; max: number | null }> = [];
  const anyCellIds = new Set<string>();

  for (const c of cells) {
    const id = idOf(c?.objectiveId);
    if (id !== undefined) anyCellIds.add(id);
    const max = c?.max === undefined ? null : c?.max;
    const minOk = isCount(c?.min);
    const maxOk = max === null || isCount(max);
    const countsOk = minOk && maxOk;
    let defective = false;

    if (!countsOk) {
      countInvalid.push(id);
      defective = true;
    } else if (max !== null && (c.min as number) > max) {
      minGtMax.push(id);
      defective = true;
    }
    if (id === undefined || !universe.has(id)) {
      unknownIds.push(id);
      defective = true;
    }
    if (id !== undefined && (idCounts.get(id) ?? 0) > 1) defective = true;

    if (!defective && id !== undefined) {
      valid.push({ objectiveId: id, min: c.min, max });
    }
  }
  valid.sort((a, b) => cmp(a.objectiveId, b.objectiveId));
  return { countInvalid, minGtMax, duplicateIds, unknownIds, valid, anyCellIds };
}

function targetTotalState(
  blueprint: Blueprint,
): { kind: "ABSENT" } | { kind: "INVALID" } | { kind: "OK"; value: number } {
  const t = blueprint ? blueprint.targetTotal : null;
  if (t === null || t === undefined) return { kind: "ABSENT" };
  return isCount(t) ? { kind: "OK", value: t } : { kind: "INVALID" };
}

function sortIssues(issues: BlueprintIssue[]): BlueprintIssue[] {
  return issues.sort(
    (a, b) =>
      cmp(a.code, b.code) ||
      cmp(a.objectiveId ?? "", b.objectiveId ?? "") ||
      cmp(a.message, b.message),
  );
}

// ---------------------------------------------------------------------------
// validateBlueprint

export function validateBlueprint(
  blueprint: Blueprint,
  declaredObjectives: readonly DeclaredObjective[],
): BlueprintIssue[] {
  const universe = normalizeUniverse(declaredObjectives);
  const a = analyzeCells(blueprint, universe);
  const issues: BlueprintIssue[] = [];
  const C = BLUEPRINT_CODES;

  const withId = (id: string | undefined): { objectiveId?: string } =>
    id === undefined ? {} : { objectiveId: id };

  for (const id of a.countInvalid) {
    issues.push({
      code: C.CELL_COUNT_INVALID,
      severity: "ERROR",
      ...withId(id),
      message: `Cell min or max is not an integer from 0 to ${MAX_BLUEPRINT_COUNT}.`,
    });
  }
  for (const id of a.minGtMax) {
    issues.push({
      code: C.CELL_MIN_GT_MAX,
      severity: "ERROR",
      ...withId(id),
      message: "Cell min is greater than its max.",
    });
  }
  for (const id of a.duplicateIds) {
    issues.push({
      code: C.CELL_DUPLICATE,
      severity: "ERROR",
      objectiveId: id,
      message: "Objective appears in more than one cell.",
    });
  }
  for (const id of a.unknownIds) {
    issues.push({
      code: C.OBJECTIVE_UNKNOWN,
      severity: "ERROR",
      ...withId(id),
      message: "Cell objective is not in the declared objective set.",
    });
  }

  const total = targetTotalState(blueprint);
  if (total.kind === "INVALID") {
    issues.push({
      code: C.TOTAL_INVALID,
      severity: "ERROR",
      message: `Target total is not an integer from 0 to ${MAX_BLUEPRINT_COUNT}.`,
    });
  } else if (total.kind === "OK") {
    const sumMin = a.valid.reduce((s, c) => s + c.min, 0);
    if (total.value < sumMin) {
      issues.push({
        code: C.TOTAL_BELOW_MINS,
        severity: "ERROR",
        message: `Target total ${total.value} is below the sum of cell minimums ${sumMin}.`,
      });
    }
    // At least one valid cell is required so an empty plan stays valid (see handoff).
    if (a.valid.length > 0 && a.valid.every((c) => c.max !== null)) {
      const sumMax = a.valid.reduce((s, c) => s + (c.max as number), 0);
      if (total.value > sumMax) {
        issues.push({
          code: C.TOTAL_ABOVE_MAXES,
          severity: "ERROR",
          message: `Target total ${total.value} is above the sum of cell maximums ${sumMax}.`,
        });
      }
    }
  }

  for (const id of universe.keys()) {
    if (!a.anyCellIds.has(id)) {
      issues.push({
        code: C.OBJECTIVE_UNALLOCATED,
        severity: "WARNING",
        objectiveId: id,
        message: "Declared objective has no cell.",
      });
    }
  }

  return sortIssues(issues);
}

// ---------------------------------------------------------------------------
// compareCoverage

export function compareCoverage(
  blueprint: Blueprint,
  declaredObjectives: readonly DeclaredObjective[],
  items: readonly CoverageItem[],
): CoverageReport {
  const universe = normalizeUniverse(declaredObjectives);
  const a = analyzeCells(blueprint, universe);

  // Canonical item order so "first occurrence wins" is input-order independent.
  const prepared: Array<{ questionId: string; objectiveIds: string[] }> = [];
  for (const it of asArray(items)) {
    if (!it || typeof it.questionId !== "string") continue;
    const ids = new Set<string>();
    for (const o of asArray(it.objectiveIds)) if (typeof o === "string") ids.add(o);
    prepared.push({ questionId: it.questionId, objectiveIds: [...ids].sort(cmp) });
  }
  prepared.sort((x, y) => {
    const c = cmp(x.questionId, y.questionId);
    if (c !== 0) return c;
    const n = Math.min(x.objectiveIds.length, y.objectiveIds.length);
    for (let i = 0; i < n; i++) {
      const d = cmp(x.objectiveIds[i], y.objectiveIds[i]);
      if (d !== 0) return d;
    }
    return x.objectiveIds.length - y.objectiveIds.length;
  });

  const seen = new Set<string>();
  const duplicateQuestionIds = new Set<string>();
  const unlinked: string[] = [];
  const unknownRefs: UnknownObjectiveRef[] = [];
  const questionsByObjective = new Map<string, Set<string>>();
  const questionsByTopic = new Map<string, Set<string>>();
  let totalDistinct = 0;

  for (const it of prepared) {
    if (seen.has(it.questionId)) {
      duplicateQuestionIds.add(it.questionId);
      continue;
    }
    seen.add(it.questionId);
    totalDistinct += 1;
    let linked = 0;
    for (const o of it.objectiveIds) {
      const topicId = universe.get(o);
      if (topicId === undefined) {
        unknownRefs.push({ questionId: it.questionId, objectiveId: o });
        continue;
      }
      linked += 1;
      let qs = questionsByObjective.get(o);
      if (!qs) questionsByObjective.set(o, (qs = new Set()));
      qs.add(it.questionId);
      let tq = questionsByTopic.get(topicId);
      if (!tq) questionsByTopic.set(topicId, (tq = new Set()));
      tq.add(it.questionId);
    }
    if (linked === 0) unlinked.push(it.questionId);
  }
  // prepared is sorted by questionId, so unlinked/unknownRefs are already ordered.

  const actualOf = (id: string): number => questionsByObjective.get(id)?.size ?? 0;

  const cells: CellCoverage[] = a.valid.map((c) => {
    const actual = actualOf(c.objectiveId);
    const status: CellStatus =
      actual < c.min ? "UNDER" : c.max !== null && actual > c.max ? "OVER" : "OK";
    return { objectiveId: c.objectiveId, min: c.min, max: c.max, actual, status };
  });

  const validById = new Map(a.valid.map((c) => [c.objectiveId, c] as const));
  const universeIds = [...universe.keys()];

  const unallocated: UnallocatedObjective[] = universeIds
    .filter((id) => !validById.has(id))
    .map((id) => ({ objectiveId: id, actual: actualOf(id) }));

  const distribution: DistributionEntry[] = universeIds.map((id) => {
    const cell = validById.get(id);
    return cell
      ? { objectiveId: id, actual: actualOf(id), min: cell.min, max: cell.max }
      : { objectiveId: id, actual: actualOf(id) };
  });

  const covered = universeIds.filter((id) => actualOf(id) >= 1).length;
  const declared = universeIds.length;

  const total = targetTotalState(blueprint);
  const totalStatus: TotalStatus =
    total.kind !== "OK"
      ? "NOT_EVALUATED"
      : totalDistinct < total.value
        ? "UNDER"
        : totalDistinct > total.value
          ? "OVER"
          : "OK";

  // Single grouping pass; universeIds is already sorted by id.
  const objectivesByTopic = new Map<string, string[]>();
  for (const id of universeIds) {
    const t = universe.get(id) as string;
    const list = objectivesByTopic.get(t);
    if (list) list.push(id);
    else objectivesByTopic.set(t, [id]);
  }
  const topicIds = [...objectivesByTopic.keys()].sort(cmp);
  const topics: TopicRollup[] = topicIds.map((topicId) => {
    const objs = objectivesByTopic.get(topicId) as string[];
    const tCells = objs.map((id) => validById.get(id)).filter((c) => c !== undefined);
    return {
      topicId,
      declaredObjectives: objs.length,
      coveredObjectives: objs.filter((id) => actualOf(id) >= 1).length,
      distinctQuestions: questionsByTopic.get(topicId)?.size ?? 0,
      sumMin: tCells.reduce((s, c) => s + c.min, 0),
      sumMax:
        tCells.length > 0 && tCells.every((c) => c.max !== null)
          ? tCells.reduce((s, c) => s + (c.max as number), 0)
          : null,
    };
  });

  return {
    totalDistinctQuestions: totalDistinct,
    totalStatus,
    cells,
    unallocated,
    unlinkedQuestionIds: unlinked,
    unknownObjectiveRefs: unknownRefs.sort(
      (x, y) => cmp(x.questionId, y.questionId) || cmp(x.objectiveId, y.objectiveId),
    ),
    duplicateQuestionIds: [...duplicateQuestionIds].sort(cmp),
    coverage: { covered, declared, ratio: declared === 0 ? null : covered / declared },
    distribution,
    topics,
  };
}

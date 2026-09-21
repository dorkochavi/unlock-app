/**
 * Shared output shape for every Run 007 Structured Import source adapter
 * (`./adapters/json-adapter.ts`, `./adapters/csv-adapter.ts`) — kept in one
 * place so S2's preview use case can treat both formats identically once a
 * `CanonicalQuestionRow` exists, per the format-independent pipeline
 * `docs/CHATGPT_PLAN.md` §1/§8 requires.
 *
 * Two distinct failure levels, matching §8's "malformed source/shape errors
 * must remain distinct from S2 row-content validation":
 * - `MALFORMED_SOURCE` — the input isn't even parseable/structured input for
 *   this format at all (invalid JSON, not a top-level array, a CSV missing
 *   its required header columns). No rows exist to report on individually.
 * - a per-row `PARSE_ERROR` — the source parsed, but this one row's fields
 *   don't have the right shape/type for `CanonicalQuestionRow` (e.g. `type`
 *   is not a known QuestionType, an option is missing its `key`). Every
 *   other row in the same source is still parsed/reported independently.
 *
 * One deliberate exception both adapters apply at this parse stage rather
 * than deferring to S2: zero options / zero correct-option references is
 * rejected as a `PARSE_ERROR`, not left for S2's content validation. This is
 * a type-independent shape invariant (a row cannot become a real Question at
 * all without at least one option, regardless of SINGLE_CHOICE/
 * MULTIPLE_CHOICE), unlike the actual per-type cardinality rule (exactly one
 * vs. at least one correct option), which genuinely does stay S2's job via
 * `assertValidQuestionAnswerDefinition`.
 */
import type { CanonicalQuestionRow } from "../../domain/import/types";

export type { CanonicalQuestionRow };

export type ImportRowParseResult =
  | { sourceRowNumber: number; outcome: "PARSED"; row: CanonicalQuestionRow }
  | { sourceRowNumber: number; outcome: "PARSE_ERROR"; errors: string[] };

export type ImportSourceParseResult =
  | { outcome: "PARSED"; rows: ImportRowParseResult[] }
  | { outcome: "MALFORMED_SOURCE"; error: string };

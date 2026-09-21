/**
 * Shared HTTP-boundary size limit for the Structured Import routes (Run 007
 * S3 preview, S4 confirm) — resolves FUB-005
 * (`docs/FOLLOW_UP_BACKLOG.md`): the S1/S2 adapters/validators are pure
 * parsing functions with no built-in bound, and FUB-005 explicitly defers
 * choosing a concrete limit to "when S3 is implemented," to be enforced at
 * the HTTP boundary rather than inside the format-independent adapters.
 *
 * 2,000,000 UTF-16 code units (~2 MB of source text) comfortably covers a
 * realistic single-Course question bank in either JSON or CSV form while
 * still bounding the synchronous parse this route performs per request.
 */
export const MAX_IMPORT_SOURCE_LENGTH = 2_000_000;

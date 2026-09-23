# Pilot Content Validator (offline)

Deterministic, DB-free structural gate for a Structured Import file (JSON or CSV) before the pilot Content Go/No-Go.
Reuses the canonical import pipeline (S1 adapters + `validateCanonicalQuestionRowContent` + Topic-name resolution) — the same rules `previewImport` applies. It is a supplement to, not a replacement for, the in-app Preview.

```
node scripts/validate-import.mjs <file.json|file.csv> [--topics "A,B" | --topics-file topics.txt] [--min-questions N]
```

- Exit `0` PASS (warnings allowed), `1` FAIL, `2` usage/IO error.
- Needs no env vars, DB, or network. Keep real instructor files OUTSIDE the repo (or in a gitignored path).
- Output shows codes, row numbers (same numbering as Preview), counts and Topic names — never prompt/option/explanation text. It can echo Topic names and author-chosen option keys (e.g. `A`), so treat output as internal.

| Code | Severity | Meaning |
|---|---|---|
| MALFORMED_SOURCE / NO_ROWS / TOO_MANY_ROWS | ERROR | unparsable / empty / over `MAX_IMPORT_ROWS` |
| ROW_PARSE_ERROR | ERROR | row shape invalid (type, options, unknown correct key…) |
| ROW_CONTENT_INVALID | ERROR | empty prompt/option, <2 options, SINGLE_CHOICE correct-count, etc. |
| TOPIC_BLANK | ERROR | blank topic |
| TOPIC_UNKNOWN / TOPIC_AMBIGUOUS | ERROR | only with `--topics`: not in / ambiguous in the given list |
| BELOW_MIN_QUESTIONS | ERROR | only with `--min-questions` (no canonical threshold exists) |
| DUPLICATE_PROMPT | WARNING | same prompt (whitespace/case-insensitive) in several rows |
| TOPIC_WITHOUT_QUESTIONS | WARNING | only with `--topics`: listed Topic has no valid question |

Not checked (human): language quality, distractors, answer-key truth, Topic alignment. Import files carry no question IDs, so there is no duplicate-ID check; duplicate option keys are caught by the canonical rules. Publish/draft state is not represented in the input.
Runs the TypeScript via `jiti` (transitive dev dependency, not declared).

/**
 * PostgreSQL implementation of `QuestionRepository`
 * (`src/application/question/ports.ts`), backed by `questions`' draft_
 * columns and `topic_id` (Run 006 S2). Deliberately separate from
 * `question-version-repository.ts` (the existing narrow read-only port for
 * `current_version_id`/published-version resolution) — that module is the
 * learner/grading-facing read path and must stay untouched; this module is
 * the authoring-facing read/write path added by this Run.
 */
import type {
  AnswerOption,
  QuestionAuthoringRecord,
  QuestionDraftContent,
} from "../../domain/question/types";
import type {
  CreateQuestionDraftInput,
  QuestionRepository,
  UpdateQuestionDraftInput,
} from "../../application/question/ports";
import { mapQuestionAnswerDefinitionRow, readAnswerOptions } from "./question-answer-definition-mapper";
import {
  MalformedRowError,
  readDate,
  readNullableString,
  readString,
} from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "questions";
const VERSIONS_TABLE = "question_versions";
const COLUMNS =
  "id, course_id, topic_id, current_version_id, draft_question_type, " +
  "draft_prompt, draft_answer_options, draft_correct_answer, " +
  "draft_explanation, created_at, updated_at";
const VERSION_CONTENT_COLUMNS = "prompt, question_type, answer_options, correct_answer, explanation";

const DRAFT_QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"] as const;

function readNullableDraftQuestionType(
  value: unknown,
): QuestionDraftContent["questionType"] {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value !== "string" ||
    !(DRAFT_QUESTION_TYPES as readonly string[]).includes(value)
  ) {
    throw new MalformedRowError(
      TABLE,
      "draft_question_type",
      `expected one of ${JSON.stringify(DRAFT_QUESTION_TYPES)} or null, got ${JSON.stringify(value)}`,
    );
  }
  return value as QuestionDraftContent["questionType"];
}

function readNullableAnswerOptions(value: unknown): AnswerOption[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  return readAnswerOptions(value);
}

function readNullableCorrectOptionIds(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new MalformedRowError(
      TABLE,
      "draft_correct_answer",
      `expected a JSON array or null, got ${JSON.stringify(value)}`,
    );
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new MalformedRowError(
        TABLE,
        "draft_correct_answer",
        `element ${index} is not a string option id, got ${JSON.stringify(entry)}`,
      );
    }
    return entry;
  });
}

function mapQuestionAuthoringRow(row: Record<string, unknown>): QuestionAuthoringRecord {
  return {
    id: readString(row, TABLE, "id"),
    courseId: readString(row, TABLE, "course_id"),
    topicId: readNullableString(row, TABLE, "topic_id"),
    currentVersionId: readNullableString(row, TABLE, "current_version_id"),
    draft: {
      questionType: readNullableDraftQuestionType(row.draft_question_type),
      prompt: readNullableString(row, TABLE, "draft_prompt"),
      answerOptions: readNullableAnswerOptions(row.draft_answer_options),
      correctOptionIds: readNullableCorrectOptionIds(row.draft_correct_answer),
      explanation: readNullableString(row, TABLE, "draft_explanation"),
    },
    createdAt: readDate(row, TABLE, "created_at"),
    updatedAt: readDate(row, TABLE, "updated_at"),
  };
}

export class PostgresQuestionRepository implements QuestionRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async createDraft(input: CreateQuestionDraftInput): Promise<QuestionAuthoringRecord> {
    const result = await this.db.query(
      `insert into questions (course_id)
        values ($1)
        returning ${COLUMNS}`,
      [input.courseId],
    );
    return mapQuestionAuthoringRow(result.rows[0]);
  }

  async getForAuthoring(questionId: string): Promise<QuestionAuthoringRecord | null> {
    const result = await this.db.query(
      `select ${COLUMNS} from questions where id = $1`,
      [questionId],
    );
    return result.rows.length === 1 ? mapQuestionAuthoringRow(result.rows[0]) : null;
  }

  /** Ordered by insertion (`created_at`, `id` tiebreak) — matches `PostgresTopicRepository.listActiveForCourse`'s own established convention. */
  async listForCourse(courseId: string): Promise<QuestionAuthoringRecord[]> {
    const result = await this.db.query(
      `select ${COLUMNS} from questions
        where course_id = $1
        order by created_at asc, id asc`,
      [courseId],
    );
    return result.rows.map(mapQuestionAuthoringRow);
  }

  async updateDraft(
    questionId: string,
    input: UpdateQuestionDraftInput,
  ): Promise<QuestionAuthoringRecord | null> {
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [questionId];

    if (input.topicId !== undefined) {
      values.push(input.topicId);
      setClauses.push(`topic_id = $${values.length}`);
    }
    if (input.questionType !== undefined) {
      values.push(input.questionType);
      setClauses.push(`draft_question_type = $${values.length}`);
    }
    if (input.prompt !== undefined) {
      values.push(input.prompt);
      setClauses.push(`draft_prompt = $${values.length}`);
    }
    if (input.answerOptions !== undefined) {
      values.push(input.answerOptions === null ? null : JSON.stringify(input.answerOptions));
      setClauses.push(`draft_answer_options = $${values.length}`);
    }
    if (input.correctOptionIds !== undefined) {
      values.push(input.correctOptionIds === null ? null : JSON.stringify(input.correctOptionIds));
      setClauses.push(`draft_correct_answer = $${values.length}`);
    }
    if (input.explanation !== undefined) {
      values.push(input.explanation);
      setClauses.push(`draft_explanation = $${values.length}`);
    }

    const result = await this.db.query(
      `update questions set ${setClauses.join(", ")}
        where id = $1
        returning ${COLUMNS}`,
      values,
    );
    return result.rows.length === 1 ? mapQuestionAuthoringRow(result.rows[0]) : null;
  }

  async getVersionContent(versionId: string): Promise<QuestionDraftContent | null> {
    const result = await this.db.query(
      `select ${VERSION_CONTENT_COLUMNS} from question_versions where id = $1`,
      [versionId],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    const definition = mapQuestionAnswerDefinitionRow(result.rows[0]);
    return {
      questionType: definition.questionType,
      prompt: readString(result.rows[0], VERSIONS_TABLE, "prompt"),
      answerOptions: definition.options,
      correctOptionIds: definition.correctOptionIds,
      explanation: readNullableString(result.rows[0], VERSIONS_TABLE, "explanation"),
    };
  }

  async getVersionPrompts(versionIds: readonly string[]): Promise<Map<string, string>> {
    if (versionIds.length === 0) {
      return new Map();
    }
    const result = await this.db.query(
      `select id, prompt from question_versions where id = any($1)`,
      [versionIds],
    );
    const prompts = new Map<string, string>();
    for (const row of result.rows) {
      prompts.set(readString(row, VERSIONS_TABLE, "id"), readString(row, VERSIONS_TABLE, "prompt"));
    }
    return prompts;
  }
}

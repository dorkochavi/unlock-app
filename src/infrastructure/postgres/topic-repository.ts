/**
 * PostgreSQL implementation of `TopicRepository`
 * (`src/application/topic/ports.ts`), backed by `topics` (Run 005 S4).
 */
import type { CreateTopicInput, Topic, TopicRepository } from "../../application/topic/ports";
import { readDate, readNullableDate, readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "topics";
const COLUMNS = "id, course_id, name, archived_at, created_at, updated_at";

function mapTopicRow(row: Record<string, unknown>): Topic {
  return {
    id: readString(row, TABLE, "id"),
    courseId: readString(row, TABLE, "course_id"),
    name: readString(row, TABLE, "name"),
    archivedAt: readNullableDate(row, TABLE, "archived_at"),
    createdAt: readDate(row, TABLE, "created_at"),
    updatedAt: readDate(row, TABLE, "updated_at"),
  };
}

export class PostgresTopicRepository implements TopicRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async createTopic(input: CreateTopicInput): Promise<Topic> {
    const result = await this.db.query(
      `insert into topics (course_id, name)
        values ($1, $2)
        returning ${COLUMNS}`,
      [input.courseId, input.name],
    );
    return mapTopicRow(result.rows[0]);
  }

  /** Ordered by insertion (`created_at`, `id` tiebreak) — see migration's own doc comment on why no dedicated ordering column exists. */
  async listActiveForCourse(courseId: string): Promise<Topic[]> {
    const result = await this.db.query(
      `select ${COLUMNS} from topics
        where course_id = $1 and archived_at is null
        order by created_at asc, id asc`,
      [courseId],
    );
    return result.rows.map(mapTopicRow);
  }

  async getTopic(topicId: string): Promise<Topic | null> {
    const result = await this.db.query(
      `select ${COLUMNS} from topics where id = $1`,
      [topicId],
    );
    return result.rows.length === 1 ? mapTopicRow(result.rows[0]) : null;
  }

  async renameTopic(topicId: string, name: string): Promise<Topic | null> {
    const result = await this.db.query(
      `update topics set name = $2, updated_at = now()
        where id = $1
        returning ${COLUMNS}`,
      [topicId, name],
    );
    return result.rows.length === 1 ? mapTopicRow(result.rows[0]) : null;
  }

  /** `coalesce` keeps the original `archived_at` instant on a repeat archive call — idempotent, matches the port's own documented contract. */
  async archiveTopic(topicId: string): Promise<Topic | null> {
    const result = await this.db.query(
      `update topics set archived_at = coalesce(archived_at, now()), updated_at = now()
        where id = $1
        returning ${COLUMNS}`,
      [topicId],
    );
    return result.rows.length === 1 ? mapTopicRow(result.rows[0]) : null;
  }
}

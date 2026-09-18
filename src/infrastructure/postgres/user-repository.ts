/**
 * PostgreSQL implementation of `UserRepository`
 * (`src/application/user/ports.ts`), backed by `users.timezone`.
 */
import type { IanaTimezone } from "../../domain/user/timezone";
import type { UserRepository, UserTimezoneRecord } from "../../application/user/ports";
import { readNullableString, readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "users";

function mapRow(row: Record<string, unknown>): UserTimezoneRecord {
  return {
    userId: readString(row, TABLE, "id"),
    timezone: readNullableString(row, TABLE, "timezone"),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async findTimezone(userId: string): Promise<UserTimezoneRecord | null> {
    const result = await this.db.query(
      "select id, timezone from users where id = $1",
      [userId],
    );
    return result.rows.length === 1 ? mapRow(result.rows[0]) : null;
  }

  async setTimezone(
    userId: string,
    timezone: IanaTimezone,
  ): Promise<UserTimezoneRecord | null> {
    const result = await this.db.query(
      "update users set timezone = $2 where id = $1 returning id, timezone",
      [userId, timezone],
    );
    return result.rows.length === 1 ? mapRow(result.rows[0]) : null;
  }
}

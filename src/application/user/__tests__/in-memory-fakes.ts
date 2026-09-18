/**
 * In-memory fake for the user-timezone application layer's persistence
 * port — proves application-layer orchestration semantics only (validation,
 * the "no such user" case), not PostgreSQL constraint behavior. Mirrors
 * `src/application/course/__tests__/in-memory-fakes.ts`'s own scope note.
 */
import type { UserRepository, UserTimezoneRecord } from "../ports";

export class InMemoryUserDatabase {
  private users = new Map<string, string | null>();

  /** Test setup helper — not part of any port. */
  seedUser(userId: string, timezone: string | null = null): void {
    this.users.set(userId, timezone);
  }

  repo(): UserRepository {
    return {
      findTimezone: async (userId): Promise<UserTimezoneRecord | null> => {
        if (!this.users.has(userId)) return null;
        return { userId, timezone: this.users.get(userId) ?? null };
      },
      setTimezone: async (userId, timezone): Promise<UserTimezoneRecord | null> => {
        if (!this.users.has(userId)) return null;
        this.users.set(userId, timezone);
        return { userId, timezone };
      },
    };
  }
}

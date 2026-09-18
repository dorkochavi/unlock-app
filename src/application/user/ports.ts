/**
 * Persistence port for the user-timezone application layer —
 * `docs/OPEN_QUESTIONS.md` #35 (RESOLVED), `docs/DATABASE.md` §26. A small,
 * explicit interface, not a generic `Repository<T>`
 * (`docs/ARCHITECTURE.md` §20/§29, same discipline `src/application/
 * course/ports.ts` already follows). No Postgres/Supabase types leak into
 * this signature.
 */
import type { IanaTimezone } from "../../domain/user/timezone";

export interface UserTimezoneRecord {
  userId: string;
  /** `null` means no timezone has been detected/persisted for this user yet. */
  timezone: string | null;
}

export interface UserRepository {
  /** `null` if no user row exists for `userId`. */
  findTimezone(userId: string): Promise<UserTimezoneRecord | null>;

  /**
   * Persists `timezone` (already validated/canonicalized —
   * `src/domain/user/timezone.ts`) as this user's timezone. Returns the
   * updated record, or `null` if no user row exists for `userId`.
   */
  setTimezone(
    userId: string,
    timezone: IanaTimezone,
  ): Promise<UserTimezoneRecord | null>;
}

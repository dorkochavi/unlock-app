/**
 * POST /api/user/timezone — persists the authenticated caller's own
 * detected IANA timezone. Deliberately thin, mirroring
 * `daily-plan/today/route.ts` exactly: every decision worth testing lives
 * in `handle-set-user-timezone.ts`, exercised entirely by unit tests.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build (same reason as
 * `daily-plan/today/route.ts`).
 *
 * Accepts exactly one input: a JSON body `{ timezone: string }`. There is
 * structurally no code path here through which a client-supplied `userId`
 * could reach persistence — the only trusted identity source is
 * `createSupabaseServerClient()` -> `requireAuthenticatedUser()`.
 *
 * ## Auth before database
 *
 * `getPool()`/`PostgresUserRepository` are constructed LAZILY, inside the
 * `persistTimezone` closure below — not eagerly before it.
 * `handleSetUserTimezone`'s own control flow calls `authenticate()` first
 * and returns immediately on `UNAUTHENTICATED`, and validates the request
 * body BEFORE ever invoking `persistTimezone` — so this closure body, and
 * therefore `getPool()`/`DATABASE_URL`, is structurally unreachable for an
 * unauthenticated or malformed request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { setUserTimezone } from "@/application/user/set-user-timezone";
import { PostgresUserRepository } from "@/infrastructure/postgres/user-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleSetUserTimezone } from "./handle-set-user-timezone";

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient();

    let timezone: unknown;
    try {
      const json: unknown = await request.json();
      timezone =
        json !== null && typeof json === "object" && "timezone" in json
          ? (json as { timezone: unknown }).timezone
          : undefined;
    } catch {
      // Malformed/absent JSON body — `timezone` stays `undefined`, which
      // `handleSetUserTimezone` already maps to a stable 400.
      timezone = undefined;
    }

    const { status, body } = await handleSetUserTimezone({
      authenticate: () => requireAuthenticatedUser(supabase),
      timezone,
      persistTimezone: (command) => {
        // Reached ONLY for an already-authenticated, well-formed request
        // — see this file's own module doc comment.
        const users = new PostgresUserRepository(getPool());
        return setUserTimezone(command, users);
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST /api/user/timezone: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

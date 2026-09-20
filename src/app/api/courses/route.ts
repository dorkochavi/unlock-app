/**
 * POST /api/courses — Run 005 S2 Course create. Deliberately thin, mirrors
 * `daily-plan/items/.../answer/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction are LAZY, inside the `create`
 * closure below. `handleCreateCourse`'s own control flow calls
 * `authenticate()` first and returns immediately on `UNAUTHENTICATED`, and
 * validates the request body BEFORE ever invoking `create` — so this
 * closure body, and therefore `getPool()`/`DATABASE_URL`, is structurally
 * unreachable for an unauthenticated or malformed request.
 *
 * `createCourse`'s two writes (Course + creator's OWNER membership) run
 * inside one transaction via `PostgresCourseUnitOfWork`/
 * `PgConnectionProvider` — see `create-course.ts`'s own doc comment
 * (Run 005 S2 DB review finding).
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleCreateCourse } from "./handle-create-course";

import { createCourse } from "@/application/course/create-course";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresCourseUnitOfWork } from "@/infrastructure/postgres/postgres-course-unit-of-work";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleCreateCourse({
      authenticate: () => requireAuthenticatedUser(supabase),
      body,
      create: (command) => {
        // Reached ONLY for an already-authenticated, well-formed request —
        // see this file's own module doc comment.
        const pool = getPool();
        const uow = new PostgresCourseUnitOfWork(new PgConnectionProvider(pool));
        return createCourse(command, uow);
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("POST /api/courses: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

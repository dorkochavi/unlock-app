/**
 * SERVER-ONLY. Request-scoped Supabase server client factory for the
 * Next.js App Router.
 *
 * `createSupabaseServerClient()` is an async FUNCTION, deliberately never
 * a module-level singleton — every call builds a fresh client bound to
 * that call's own `await cookies()` read, which is itself request-scoped
 * (Next.js's `next/headers` `cookies()` is backed by AsyncLocalStorage
 * per request). A caller MUST call this once per request, never cache
 * its result across requests — reusing one client across requests would
 * leak one user's session into another's.
 *
 * `typeof window` guard: genuinely redundant here in practice (`next/
 * headers` already has no browser build and Next's own bundler refuses to
 * include it in a client bundle at build time), but kept for the same
 * defense-in-depth reason `pg-pool.ts` has one, and for consistency
 * across every file under `src/infrastructure/supabase/`. The
 * `server-only` npm package (the officially-blessed, stronger mechanism)
 * is not installed in this repo yet.
 *
 * Cookie handling follows the current (non-deprecated) `@supabase/ssr`
 * `getAll`/`setAll` API exactly, per its own documented Next.js App
 * Router pattern:
 * - `getAll()` always works — reading cookies has no restrictions.
 * - `setAll()` is wrapped in try/catch: Next.js only allows cookie
 *   mutation from a Route Handler or Server Action, not from a Server
 *   Component render — calling `.set()` in the latter throws. This is
 *   the standard, documented `@supabase/ssr` pattern for this exact case
 *   (not invented here): the write is silently dropped when it cannot
 *   legally happen, and a session-refresh write from a Server Component
 *   render is lost unless a future `middleware.ts` also refreshes it. No
 *   `middleware.ts` exists in this repo yet. Current Route Handlers that use
 *   this request-scoped client can set cookies without hitting this fallback;
 *   the catch remains specifically for Server Component render contexts.
 *
 * Uses ONLY `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` —
 * never the service-role key. Authenticating a request's own user never
 * requires bypassing RLS; see `requireAuthenticatedUser` for what this
 * client is actually used for.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/infrastructure/supabase/server-client.ts must never be evaluated " +
      "in a browser context.",
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "createSupabaseServerClient(): NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set — see .env.example.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Expected when called from a Server Component render — see
          // this file's own doc comment.
        }
      },
    },
  });
}

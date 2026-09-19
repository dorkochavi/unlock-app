/**
 * Browser-side Supabase client factory. Only the two `NEXT_PUBLIC_*`
 * values are used here — both are deliberately public (shipped to every
 * browser); no service-role key, no `DATABASE_URL`, and no application
 * `userId` input belongs anywhere near this file.
 *
 * Meant to be called from Client Component code (this module itself has
 * no `"use client"` boundary of its own — it exports a plain factory
 * function, not a component; the calling Client Component is what
 * establishes the boundary).
 *
 * Lazy, not eager: env vars are only read/validated when the factory is
 * actually CALLED, never at module-import time — matches
 * `src/infrastructure/postgres/pg-pool.ts`'s own "avoid import-time
 * failure" discipline, so importing this module during a build/test never
 * throws by itself.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "createSupabaseBrowserClient(): NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set — see .env.example.",
    );
  }

  return createBrowserClient(url, anonKey);
}

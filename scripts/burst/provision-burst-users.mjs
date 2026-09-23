#!/usr/bin/env node
/**
 * Pre-Pilot S3 — creates N email-confirmed TEST learner accounts in a
 * Supabase project so `burst-hosted.mjs` can sign in without email
 * confirmation. THIS MUTATES THE SUPABASE PROJECT NAMED BY
 * NEXT_PUBLIC_SUPABASE_URL — a Dor-owned action; Claude does not run it.
 *
 * Requires the explicit flag `--yes-mutate-hosted`, plus env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only secret —
 *   read from the environment, never printed), BURST_EMAIL_PATTERN
 *   (contains {n}), BURST_PASSWORD, BURST_LEARNERS (default 30).
 *
 * Creates auth users only (the auth->public.users provisioning trigger
 * creates the identity rows). Does not delete anything. Already-existing
 * users are reported and skipped.
 */
import { createClient } from "@supabase/supabase-js";

import { expandEmailPattern } from "./burst-stats.mjs";

if (!process.argv.includes("--yes-mutate-hosted")) {
  console.error("Refusing to run: pass --yes-mutate-hosted to confirm you intend to create auth users.");
  process.exit(2);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    process.exit(2);
  }
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const pattern = requireEnv("BURST_EMAIL_PATTERN");
const password = requireEnv("BURST_PASSWORD");
const count = Number(process.env.BURST_LEARNERS ?? "30");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let created = 0;
let skipped = 0;
let failed = 0;
for (let n = 1; n <= count; n += 1) {
  const { error } = await admin.auth.admin.createUser({
    email: expandEmailPattern(pattern, n),
    password,
    email_confirm: true,
  });
  if (!error) created += 1;
  else if (/already|registered|exists/i.test(error.message)) skipped += 1;
  else {
    failed += 1;
    console.error(`user ${n}: ${error.message}`);
  }
}
console.log(JSON.stringify({ host: new URL(url).host, requested: count, created, skipped, failed }));
process.exit(failed > 0 ? 1 : 0);

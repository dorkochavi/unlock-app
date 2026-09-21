import fs from "node:fs";
import path from "node:path";

function readStdin() {
  return new Promise((resolve) => {
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", () => resolve(""));
  });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeSegment(value, fallback = "unknown") {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 160);
}

function normalizeSlashes(value) {
  return value.replaceAll("\\", "/");
}

function resolveProjectRoot(input) {
  const workspaceProjectDir = input?.workspace?.project_dir;

  if (
    typeof workspaceProjectDir === "string" &&
    path.isAbsolute(workspaceProjectDir)
  ) {
    return path.resolve(workspaceProjectDir);
  }

  const fromEnv = process.env.CLAUDE_PROJECT_DIR;

  if (fromEnv && path.isAbsolute(fromEnv)) {
    return path.resolve(fromEnv);
  }

  const cwd =
    typeof input?.cwd === "string"
      ? input.cwd
      : process.cwd();

  return path.resolve(cwd);
}

function readRunIdFromPlan(projectRoot) {
  try {
    const planPath = path.join(
      projectRoot,
      "docs",
      "CHATGPT_PLAN.md",
    );

    const contents = fs.readFileSync(planPath, "utf8");

    const match = contents.match(
      /^RUN_ID:\s*`?([^`\r\n]+)`?\s*$/m,
    );

    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function resolveRunId(projectRoot) {
  const fromEnv = process.env.UNLOCK_RUN_ID?.trim();

  if (fromEnv) {
    return sanitizeSegment(fromEnv, "UNASSIGNED");
  }

  const fromPlan = readRunIdFromPlan(projectRoot);

  if (fromPlan) {
    return sanitizeSegment(fromPlan, "UNASSIGNED");
  }

  return "UNASSIGNED";
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function objectOrNull(value) {
  return value && typeof value === "object"
    ? value
    : null;
}

function safeMissCauses(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = {};

  for (const [key, count] of Object.entries(value)) {
    if (
      typeof key === "string" &&
      Number.isFinite(count)
    ) {
      result[key] = count;
    }
  }

  return Object.keys(result).length > 0
    ? result
    : null;
}

function snapshotFromInput(input, runId) {
  const contextWindow =
    objectOrNull(input.context_window) ?? {};

  const currentUsage =
    objectOrNull(contextWindow.current_usage) ?? {};

  const cost = objectOrNull(input.cost) ?? {};
  const cache = objectOrNull(input.prompt_cache);
  const effort = objectOrNull(input.effort);
  const thinking = objectOrNull(input.thinking);

  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),

    run_id: runId,
    session_id: input.session_id ?? null,
    session_name: input.session_name ?? null,
    prompt_id: input.prompt_id ?? null,

    claude_code_version: input.version ?? null,

    model: {
      id: input.model?.id ?? null,
      display_name:
        input.model?.display_name ?? null,
    },

    effort: effort?.level ?? null,
    thinking_enabled:
      booleanOrNull(thinking?.enabled),

    fast_mode:
      booleanOrNull(input.fast_mode),

    cost: {
      total_cost_usd:
        numberOrNull(cost.total_cost_usd),
      total_duration_ms:
        numberOrNull(cost.total_duration_ms),
      total_api_duration_ms:
        numberOrNull(cost.total_api_duration_ms),
      total_lines_added:
        numberOrNull(cost.total_lines_added),
      total_lines_removed:
        numberOrNull(cost.total_lines_removed),
    },

    context: {
      total_input_tokens:
        numberOrNull(
          contextWindow.total_input_tokens,
        ),
      total_output_tokens:
        numberOrNull(
          contextWindow.total_output_tokens,
        ),
      context_window_size:
        numberOrNull(
          contextWindow.context_window_size,
        ),
      used_percentage:
        numberOrNull(
          contextWindow.used_percentage,
        ),
      remaining_percentage:
        numberOrNull(
          contextWindow.remaining_percentage,
        ),

      current_usage: {
        input_tokens:
          numberOrNull(
            currentUsage.input_tokens,
          ),
        output_tokens:
          numberOrNull(
            currentUsage.output_tokens,
          ),
        cache_creation_input_tokens:
          numberOrNull(
            currentUsage.cache_creation_input_tokens,
          ),
        cache_read_input_tokens:
          numberOrNull(
            currentUsage.cache_read_input_tokens,
          ),
      },

      exceeds_200k_tokens:
        booleanOrNull(
          input.exceeds_200k_tokens,
        ),
    },

    prompt_cache: cache
      ? {
          warm:
            booleanOrNull(cache.warm),
          caching_observed:
            booleanOrNull(
              cache.caching_observed,
            ),
          ttl:
            typeof cache.ttl === "string"
              ? cache.ttl
              : null,
          expires_at:
            numberOrNull(cache.expires_at),
          requests:
            numberOrNull(cache.requests),
          misses:
            numberOrNull(cache.misses),
          expected_rebuilds:
            numberOrNull(
              cache.expected_rebuilds,
            ),
          hit_ratio:
            numberOrNull(cache.hit_ratio),
          cache_write_tokens:
            numberOrNull(
              cache.cache_write_tokens,
            ),
          miss_recache_tokens:
            numberOrNull(
              cache.miss_recache_tokens,
            ),
          last_miss_at:
            numberOrNull(
              cache.last_miss_at,
            ),
          last_miss_causes:
            Array.isArray(
              cache.last_miss_cause?.causes,
            )
              ? cache.last_miss_cause.causes
                  .filter(
                    (value) =>
                      typeof value === "string",
                  )
              : null,
          miss_causes:
            safeMissCauses(
              cache.miss_causes,
            ),
          recache_tokens_if_cold:
            numberOrNull(
              cache.recache_tokens_if_cold,
            ),
        }
      : null,
  };
}

function writeSnapshot(
  projectRoot,
  runId,
  snapshot,
) {
  const sessionId = sanitizeSegment(
    snapshot.session_id,
    "unknown-session",
  );

  const directory = path.join(
    projectRoot,
    "scratch",
    "telemetry",
    runId,
    "sessions",
  );

  fs.mkdirSync(directory, {
    recursive: true,
  });

  const target = path.join(
    directory,
    `${sessionId}.json`,
  );

  const temporary = `${target}.tmp`;

  fs.writeFileSync(
    temporary,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );

  fs.renameSync(temporary, target);
}

function compactNumber(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "n/a";
  }

  const totalSeconds = Math.floor(
    milliseconds / 1000,
  );

  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

function formatCost(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(2)}`;
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return `${Math.round(value)}%`;
}

function formatCache(snapshot) {
  const cache = snapshot.prompt_cache;

  if (!cache) {
    return "cache n/a";
  }

  if (!cache.caching_observed) {
    return "cache off";
  }

  const hitRatio =
    Number.isFinite(cache.hit_ratio)
      ? `${Math.round(cache.hit_ratio * 100)}%`
      : "n/a";

  const misses =
    Number.isFinite(cache.misses)
      ? cache.misses
      : "?";

  return `cache ${hitRatio}/${misses}m`;
}

function renderStatus(snapshot) {
  const model =
    snapshot.model.display_name ??
    snapshot.model.id ??
    "Claude";

  const context =
    formatPercentage(
      snapshot.context.used_percentage,
    );

  const input =
    compactNumber(
      snapshot.context.total_input_tokens,
    );

  const output =
    compactNumber(
      snapshot.context.total_output_tokens,
    );

  const duration =
    formatDuration(
      snapshot.cost.total_duration_ms,
    );

  const cost =
    formatCost(
      snapshot.cost.total_cost_usd,
    );

  const cache =
    formatCache(snapshot);

  return [
    `[${model}]`,
    `ctx ${context}`,
    `in ${input}`,
    `out ${output}`,
    cache,
    duration,
    cost,
  ].join(" | ");
}

async function main() {
  const rawInput = await readStdin();

  if (!rawInput.trim()) {
    return;
  }

  const input = safeJsonParse(rawInput);

  if (!input || typeof input !== "object") {
    return;
  }

  const projectRoot =
    resolveProjectRoot(input);

  const runId =
    resolveRunId(projectRoot);

  const snapshot =
    snapshotFromInput(
      input,
      runId,
    );

  try {
    writeSnapshot(
      projectRoot,
      runId,
      snapshot,
    );
  } catch {
    // Telemetry persistence must never break
    // or clutter the Claude Code UI.
  }

  process.stdout.write(
    `${renderStatus(snapshot)}\n`,
  );
}

main().catch(() => {
  // A status-line failure should degrade silently.
  process.stdout.write(
    "[UNLOCK] telemetry unavailable\n",
  );
});
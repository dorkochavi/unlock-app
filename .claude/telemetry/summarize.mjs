import fs from "node:fs";
import path from "node:path";

function normalizeSlashes(value) {
  return value.replaceAll("\\", "/");
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

function resolveProjectRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;

  if (fromEnv && path.isAbsolute(fromEnv)) {
    return path.resolve(fromEnv);
  }

  let current = process.cwd();

  while (true) {
    const hasPlan = fs.existsSync(
      path.join(current, "docs", "CHATGPT_PLAN.md"),
    );

    const hasGit = fs.existsSync(
      path.join(current, ".git"),
    );

    if (hasPlan || hasGit) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

function readRunIdFromPlan(projectRoot) {
  try {
    const planPath = path.join(
      projectRoot,
      "docs",
      "CHATGPT_PLAN.md",
    );

    const contents = fs.readFileSync(
      planPath,
      "utf8",
    );

    const match = contents.match(
      /^RUN_ID:\s*`?([^`\r\n]+)`?\s*$/m,
    );

    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function resolveRunId(projectRoot) {
  const cliArg = process.argv[2]?.trim();

  if (cliArg) {
    return sanitizeSegment(cliArg, "UNASSIGNED");
  }

  const fromEnv =
    process.env.UNLOCK_RUN_ID?.trim();

  if (fromEnv) {
    return sanitizeSegment(
      fromEnv,
      "UNASSIGNED",
    );
  }

  const fromPlan =
    readRunIdFromPlan(projectRoot);

  if (fromPlan) {
    return sanitizeSegment(
      fromPlan,
      "UNASSIGNED",
    );
  }

  return "UNASSIGNED";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readJsonFile(filePath) {
  try {
    return safeJsonParse(
      fs.readFileSync(filePath, "utf8"),
    );
  } catch {
    return null;
  }
}

function readJsonLines(filePath) {
  try {
    const contents = fs.readFileSync(
      filePath,
      "utf8",
    );

    return contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map(safeJsonParse)
      .filter(
        (value) =>
          value &&
          typeof value === "object",
      );
  } catch {
    return [];
  }
}

function listFiles(directory, suffix) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) =>
      suffix ? name.endsWith(suffix) : true,
    )
    .map((name) =>
      path.join(directory, name),
    );
}

function countBy(items, selector) {
  const counts = new Map();

  for (const item of items) {
    const key = selector(item);

    if (
      key === null ||
      key === undefined ||
      key === ""
    ) {
      continue;
    }

    counts.set(
      key,
      (counts.get(key) ?? 0) + 1,
    );
  }

  return counts;
}

/**
 * Like `countBy`, but `selector` returns an array of keys per item instead
 * of one — needed so one compound-command shell event can contribute more
 * than one `command_class`/category count. `shell_activity.total` still
 * counts EVENTS (one per Bash/PowerShell tool call); the by-class/by-category
 * breakdowns below can now sum to more than that total for a Run containing
 * compound commands — expected, not a bug (each real sub-command is counted
 * once).
 */
function countByMulti(items, selector) {
  const counts = new Map();

  for (const item of items) {
    for (const key of selector(item)) {
      if (
        key === null ||
        key === undefined ||
        key === ""
      ) {
        continue;
      }

      counts.set(
        key,
        (counts.get(key) ?? 0) + 1,
      );
    }
  }

  return counts;
}

function mapToSortedObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort(
      ([a], [b]) =>
        String(a).localeCompare(String(b)),
    ),
  );
}

function topEntries(map, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return String(a[0]).localeCompare(
        String(b[0]),
      );
    })
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
    }));
}

function finiteNumbers(values) {
  return values.filter(Number.isFinite);
}

function sum(values) {
  return finiteNumbers(values).reduce(
    (total, value) => total + value,
    0,
  );
}

function max(values) {
  const numbers = finiteNumbers(values);

  return numbers.length > 0
    ? Math.max(...numbers)
    : null;
}

function min(values) {
  const numbers = finiteNumbers(values);

  return numbers.length > 0
    ? Math.min(...numbers)
    : null;
}

function latestSnapshot(snapshots) {
  if (snapshots.length === 0) {
    return null;
  }

  return [...snapshots].sort((a, b) =>
    String(b.timestamp).localeCompare(
      String(a.timestamp),
    ),
  )[0];
}

function classifyCommand(commandClass) {
  if (!commandClass) {
    return null;
  }

  if (
    commandClass.startsWith("npm-run:test") ||
    commandClass === "npm:test" ||
    commandClass.startsWith("npx:vitest") ||
    commandClass.startsWith("npx:playwright")
  ) {
    return "TEST";
  }

  if (
    commandClass === "npm-run:lint" ||
    commandClass === "npm-run:typecheck" ||
    commandClass === "npm-run:build" ||
    // Direct `npx` invocations of the same checks `npm run lint`/
    // `npm run typecheck` wrap — a very common way to run them (e.g. after
    // a targeted change) that was previously falling through to OTHER
    // (Run 007 S1 telemetry health-check finding).
    commandClass === "npx:tsc" ||
    commandClass === "npx:eslint"
  ) {
    return "VERIFICATION";
  }

  if (
    commandClass.startsWith("git:")
  ) {
    return "GIT";
  }

  return "OTHER";
}

/**
 * Every class an event contributed, for aggregation. Prefers the new
 * `command_classes` array (one entry per meaningful command found in a
 * compound `a && b` invocation); falls back to the older scalar
 * `command_class` field for raw events written before that field existed,
 * so historical raw JSONL never needs to be rewritten.
 */
function eventCommandClasses(event) {
  if (Array.isArray(event.command_classes)) {
    return event.command_classes.filter(Boolean);
  }

  return event.command_class ? [event.command_class] : [];
}

function isHistoricalRunPath(filePath) {
  return (
    typeof filePath === "string" &&
    normalizeSlashes(filePath).startsWith(
      "docs/RUNS/",
    )
  );
}

function percentage(numerator, denominator) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function aggregate(runId, events, snapshots) {
  const reads = events.filter(
    (event) =>
      event.activity === "FILE_READ" &&
      event.success !== false,
  );

  const searches = events.filter(
    (event) =>
      event.activity === "SEARCH_GREP" ||
      event.activity === "SEARCH_GLOB",
  );

  const instructionLoads = events.filter(
    (event) =>
      event.activity ===
      "INSTRUCTION_LOAD",
  );

  const toolEvents = events.filter(
    (event) =>
      event.event === "PostToolUse" ||
      event.event === "PostToolUseFailure",
  );

  const shellEvents = events.filter(
    (event) =>
      event.activity === "SHELL",
  );

  const subagentStarts = events.filter(
    (event) =>
      event.activity === "SUBAGENT_START",
  );

  const subagentStops = events.filter(
    (event) =>
      event.activity === "SUBAGENT_STOP",
  );

  const compactionStarts = events.filter(
    (event) =>
      event.activity === "COMPACT_START",
  );

  const sessionStarts = events.filter(
    (event) =>
      event.activity === "SESSION_START",
  );

  const sessionEnds = events.filter(
    (event) =>
      event.activity === "SESSION_END",
  );

  const readCounts = countBy(
    reads,
    (event) => event.file_path,
  );

  const classificationCounts = countBy(
    reads,
    (event) =>
      event.file_classification ?? "OTHER",
  );

  const instructionFileCounts = countBy(
    instructionLoads,
    (event) => event.file_path,
  );

  const instructionReasonCounts = countBy(
    instructionLoads,
    (event) => event.load_reason ?? "unknown",
  );

  const toolCounts = countBy(
    toolEvents,
    (event) => event.tool_name,
  );

  const failedToolCounts = countBy(
    toolEvents.filter(
      (event) => event.success === false,
    ),
    (event) => event.tool_name,
  );

  const commandCounts = countByMulti(
    shellEvents,
    eventCommandClasses,
  );

  const commandCategoryCounts = countByMulti(
    shellEvents,
    (event) =>
      eventCommandClasses(event).map(
        classifyCommand,
      ),
  );

  const subagentTypeCounts = countBy(
    subagentStarts,
    (event) =>
      event.subagent_type ?? "unknown",
  );

  const sessionIds = new Set(
    [
      ...events.map(
        (event) => event.session_id,
      ),
      ...snapshots.map(
        (snapshot) => snapshot.session_id,
      ),
    ].filter(Boolean),
  );

  const mainReads = reads.filter(
    (event) => !event.agent_id,
  );

  const subagentReads = reads.filter(
    (event) => Boolean(event.agent_id),
  );

  const coldReads = reads.filter(
    (event) =>
      event.file_classification === "COLD",
  );

  const restrictedReads = reads.filter(
    (event) =>
      event.file_classification ===
      "RESTRICTED",
  );

  const historicalRunReads =
    reads.filter((event) =>
      isHistoricalRunPath(event.file_path),
    );

  const repeatedFiles = [
    ...readCounts.entries(),
  ].filter(([, count]) => count > 1);

  const rereadCount = repeatedFiles.reduce(
    (total, [, count]) =>
      total + count - 1,
    0,
  );

  const latestBySession = [];

  for (const sessionId of sessionIds) {
    const matching = snapshots.filter(
      (snapshot) =>
        snapshot.session_id === sessionId,
    );

    const latest =
      latestSnapshot(matching);

    if (latest) {
      latestBySession.push(latest);
    }
  }

  const totalDurations =
    latestBySession.map(
      (snapshot) =>
        snapshot.cost?.total_duration_ms,
    );

  const apiDurations =
    latestBySession.map(
      (snapshot) =>
        snapshot.cost?.total_api_duration_ms,
    );

  const costs =
    latestBySession.map(
      (snapshot) =>
        snapshot.cost?.total_cost_usd,
    );

  const endingContextPercentages =
    latestBySession.map(
      (snapshot) =>
        snapshot.context?.used_percentage,
    );

  const totalInputSnapshots =
    latestBySession.map(
      (snapshot) =>
        snapshot.context?.total_input_tokens,
    );

  const totalOutputSnapshots =
    latestBySession.map(
      (snapshot) =>
        snapshot.context?.total_output_tokens,
    );

  const cacheRatios =
    latestBySession.map(
      (snapshot) =>
        snapshot.prompt_cache?.hit_ratio,
    );

  const cacheMisses =
    latestBySession.map(
      (snapshot) =>
        snapshot.prompt_cache?.misses,
    );

  const uniqueReadFiles =
    readCounts.size;

  const totalReads =
    reads.length;

  return {
    schema_version: 1,
    generated_at:
      new Date().toISOString(),

    run_id: runId,

    sessions: {
      observed: sessionIds.size,
      starts: sessionStarts.length,
      ends: sessionEnds.length,
      models: [
        ...new Set(
          latestBySession
            .map(
              (snapshot) =>
                snapshot.model?.display_name ??
                snapshot.model?.id,
            )
            .filter(Boolean),
        ),
      ],
      claude_code_versions: [
        ...new Set(
          latestBySession
            .map(
              (snapshot) =>
                snapshot.claude_code_version,
            )
            .filter(Boolean),
        ),
      ],
    },

    performance: {
      summed_session_wall_duration_ms:
        totalDurations.some(Number.isFinite)
          ? sum(totalDurations)
          : null,

      summed_session_api_duration_ms:
        apiDurations.some(Number.isFinite)
          ? sum(apiDurations)
          : null,

      summed_estimated_cost_usd:
        costs.some(Number.isFinite)
          ? round(sum(costs), 6)
          : null,

      note:
        "Session duration/cost values are summed from latest per-session snapshots. Overlapping sessions may make wall-clock totals exceed elapsed real-world Run time.",
    },

    context: {
      ending_context_used_percentage_max:
        max(endingContextPercentages),

      ending_context_used_percentage_min:
        min(endingContextPercentages),

      latest_session_input_token_values:
        finiteNumbers(totalInputSnapshots),

      latest_session_output_token_values:
        finiteNumbers(totalOutputSnapshots),

      note:
        "Status-line token values are runtime session/context measurements, not a guaranteed aggregate of every billed token across the Run.",

      compactions:
        compactionStarts.length,

      compaction_triggers:
        mapToSortedObject(
          countBy(
            compactionStarts,
            (event) =>
              event.trigger ?? "unknown",
          ),
        ),
    },

    cache: {
      sessions_with_cache_data:
        latestBySession.filter(
          (snapshot) =>
            snapshot.prompt_cache,
        ).length,

      hit_ratio_values:
        finiteNumbers(cacheRatios),

      average_hit_ratio:
        finiteNumbers(cacheRatios).length > 0
          ? round(
              sum(cacheRatios) /
                finiteNumbers(cacheRatios)
                  .length,
              4,
            )
          : null,

      total_reported_misses:
        finiteNumbers(cacheMisses).length > 0
          ? sum(cacheMisses)
          : null,
    },

    file_access: {
      total_reads: totalReads,
      unique_files_read: uniqueReadFiles,
      reread_count: rereadCount,

      reread_rate:
        round(
          percentage(
            rereadCount,
            totalReads,
          ),
          4,
        ),

      files_read_more_than_once:
        repeatedFiles.length,

      max_reads_single_file:
        readCounts.size > 0
          ? Math.max(
              ...readCounts.values(),
            )
          : 0,

      main_context_reads:
        mainReads.length,

      subagent_reads:
        subagentReads.length,

      cold_reads:
        coldReads.length,

      unique_cold_files:
        new Set(
          coldReads
            .map(
              (event) =>
                event.file_path,
            )
            .filter(Boolean),
        ).size,

      restricted_reads:
        restrictedReads.length,

      historical_run_reads:
        historicalRunReads.length,

      unique_historical_run_files:
        new Set(
          historicalRunReads
            .map(
              (event) =>
                event.file_path,
            )
            .filter(Boolean),
        ).size,

      by_classification:
        mapToSortedObject(
          classificationCounts,
        ),

      most_read_files:
        topEntries(
          readCounts,
          12,
        ),
    },

    instructions: {
      total_loads:
        instructionLoads.length,

      unique_instruction_files:
        instructionFileCounts.size,

      by_reason:
        mapToSortedObject(
          instructionReasonCounts,
        ),

      most_loaded:
        topEntries(
          instructionFileCounts,
          12,
        ),
    },

    search: {
      total_operations:
        searches.length,

      grep:
        searches.filter(
          (event) =>
            event.activity ===
            "SEARCH_GREP",
        ).length,

      glob:
        searches.filter(
          (event) =>
            event.activity ===
            "SEARCH_GLOB",
        ).length,

      response_chars:
        sum(
          searches.map(
            (event) =>
              event.response_chars,
          ),
        ),
    },

    tools: {
      total_calls:
        toolEvents.length,

      failures:
        toolEvents.filter(
          (event) =>
            event.success === false,
        ).length,

      by_tool:
        mapToSortedObject(
          toolCounts,
        ),

      failures_by_tool:
        mapToSortedObject(
          failedToolCounts,
        ),

      total_duration_ms:
        sum(
          toolEvents.map(
            (event) =>
              event.duration_ms,
          ),
        ),

      total_response_chars:
        sum(
          toolEvents.map(
            (event) =>
              event.response_chars,
          ),
        ),
    },

    shell_activity: {
      total:
        shellEvents.length,

      by_command_class:
        mapToSortedObject(
          commandCounts,
        ),

      by_category:
        mapToSortedObject(
          commandCategoryCounts,
        ),
    },

    subagents: {
      started:
        subagentStarts.length,

      completed:
        subagentStops.length,

      by_type:
        mapToSortedObject(
          subagentTypeCounts,
        ),

      file_reads:
        subagentReads.length,
    },

    qualitative: {
      context_misses:
        "NOT AUTOMATICALLY INFERRED",

      unnecessary_rechecks:
        "NOT AUTOMATICALLY INFERRED",
    },

    limitations: [
      "Telemetry records metadata, not file contents, prompts, or tool-response bodies.",
      "Grep/Glob discovery does not count as a substantive file read.",
      "Instruction-loading events depend on what Claude Code exposes; some project-instruction mechanisms may not emit equivalent events.",
      "Run duration may span multiple or overlapping sessions; summed session duration is not guaranteed to equal human elapsed Run time.",
      "Context misses and unnecessary rechecks require closeout judgment and are intentionally not inferred from raw events.",
      "shell_activity.by_command_class/by_category count each meaningful command in a compound `a && b` invocation separately, so their totals can exceed shell_activity.total (one entry per Bash/PowerShell tool call, not per sub-command).",
      "Raw events collected before command_classes existed carry only their first-matched command (the old command_class field); a compound command from before that field existed cannot be reclassified into its later sub-commands without rewriting historical raw data, which this summarizer does not do.",
    ],
  };
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "NOT AVAILABLE";
  }

  const seconds = Math.floor(
    milliseconds / 1000,
  );

  const hours = Math.floor(
    seconds / 3600,
  );

  const minutes = Math.floor(
    (seconds % 3600) / 60,
  );

  const remainingSeconds =
    seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return "NOT AVAILABLE";
  }

  return `$${value.toFixed(4)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "NOT AVAILABLE";
  }

  return `${Math.round(value * 100)}%`;
}

function formatRawPercent(value) {
  if (!Number.isFinite(value)) {
    return "NOT AVAILABLE";
  }

  return `${Math.round(value)}%`;
}

function formatList(values) {
  return values.length > 0
    ? values.join(", ")
    : "NOT AVAILABLE";
}

function markdownTable(rows) {
  if (rows.length === 0) {
    return "_None recorded._";
  }

  return [
    "| File | Reads |",
    "|---|---:|",
    ...rows.map(
      ({ key, count }) =>
        `| \`${String(key).replaceAll("|", "\\|")}\` | ${count} |`,
    ),
  ].join("\n");
}

function renderMarkdown(summary) {
  const fileAccess =
    summary.file_access;

  const context =
    summary.context;

  const cache =
    summary.cache;

  const lines = [
    `# Run Telemetry Summary`,
    ``,
    `Run: \`${summary.run_id}\``,
    ``,
    `Generated: ${summary.generated_at}`,
    ``,
    `## Performance`,
    ``,
    `- Sessions observed: ${summary.sessions.observed}`,
    `- Models: ${formatList(summary.sessions.models)}`,
    `- Claude Code versions: ${formatList(summary.sessions.claude_code_versions)}`,
    `- Summed session duration: ${formatDuration(summary.performance.summed_session_wall_duration_ms)}`,
    `- Summed API duration: ${formatDuration(summary.performance.summed_session_api_duration_ms)}`,
    `- Estimated cost: ${formatCurrency(summary.performance.summed_estimated_cost_usd)}`,
    ``,
    `## Context`,
    ``,
    `- Highest ending context usage: ${formatRawPercent(context.ending_context_used_percentage_max)}`,
    `- Compactions: ${context.compactions}`,
    `- Latest session input-token values: ${
      context.latest_session_input_token_values.length > 0
        ? context.latest_session_input_token_values.join(", ")
        : "NOT AVAILABLE"
    }`,
    `- Latest session output-token values: ${
      context.latest_session_output_token_values.length > 0
        ? context.latest_session_output_token_values.join(", ")
        : "NOT AVAILABLE"
    }`,
    ``,
    `> Token values above are runtime session/context measurements, not guaranteed total billed-token aggregates for the Run.`,
    ``,
    `## Prompt Cache`,
    ``,
    `- Sessions with cache data: ${cache.sessions_with_cache_data}`,
    `- Average reported hit ratio: ${formatPercent(cache.average_hit_ratio)}`,
    `- Total reported misses: ${
      Number.isFinite(cache.total_reported_misses)
        ? cache.total_reported_misses
        : "NOT AVAILABLE"
    }`,
    ``,
    `## Context Access`,
    ``,
    `- Total substantive file reads: ${fileAccess.total_reads}`,
    `- Unique files read: ${fileAccess.unique_files_read}`,
    `- Re-reads: ${fileAccess.reread_count}`,
    `- Re-read rate: ${formatPercent(fileAccess.reread_rate)}`,
    `- Main-context reads: ${fileAccess.main_context_reads}`,
    `- Subagent reads: ${fileAccess.subagent_reads}`,
    `- Unique COLD files read: ${fileAccess.unique_cold_files}`,
    `- Historical Run files read: ${fileAccess.unique_historical_run_files}`,
    ``,
    `### Most-read files`,
    ``,
    markdownTable(
      fileAccess.most_read_files,
    ),
    ``,
    `## Instruction Loading`,
    ``,
    `- Instruction loads observed: ${summary.instructions.total_loads}`,
    `- Unique instruction files observed: ${summary.instructions.unique_instruction_files}`,
    ``,
    `Load reasons:`,
    ``,
    "```json",
    JSON.stringify(
      summary.instructions.by_reason,
      null,
      2,
    ),
    "```",
    ``,
    `## Search`,
    ``,
    `- Search operations: ${summary.search.total_operations}`,
    `- Grep: ${summary.search.grep}`,
    `- Glob: ${summary.search.glob}`,
    `- Search response characters: ${summary.search.response_chars}`,
    ``,
    `## Tool Activity`,
    ``,
    `- Tool calls observed: ${summary.tools.total_calls}`,
    `- Tool failures: ${summary.tools.failures}`,
    `- Total recorded tool duration: ${formatDuration(summary.tools.total_duration_ms)}`,
    `- Tool response characters: ${summary.tools.total_response_chars}`,
    ``,
    `## Subagents`,
    ``,
    `- Started: ${summary.subagents.started}`,
    `- Completed: ${summary.subagents.completed}`,
    `- File reads inside subagents: ${summary.subagents.file_reads}`,
    ``,
    `## Verification Activity`,
    ``,
    "```json",
    JSON.stringify(
      summary.shell_activity.by_category,
      null,
      2,
    ),
    "```",
    ``,
    `## Qualitative Closeout`,
    ``,
    `Context misses: **NOT AUTOMATICALLY INFERRED**`,
    ``,
    `Unnecessary rechecks: **NOT AUTOMATICALLY INFERRED**`,
    ``,
    `Add qualitative observations to the durable Run Report only when materially useful.`,
    ``,
    `## Measurement Limitations`,
    ``,
    ...summary.limitations.map(
      (item) => `- ${item}`,
    ),
    ``,
  ];

  return `${lines.join("\n")}\n`;
}

function writeOutputs(
  runDirectory,
  summary,
) {
  fs.mkdirSync(runDirectory, {
    recursive: true,
  });

  const jsonPath = path.join(
    runDirectory,
    "summary.json",
  );

  const markdownPath = path.join(
    runDirectory,
    "summary.md",
  );

  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    markdownPath,
    renderMarkdown(summary),
    "utf8",
  );

  return {
    jsonPath,
    markdownPath,
  };
}

function main() {
  const projectRoot =
    resolveProjectRoot();

  const runId =
    resolveRunId(projectRoot);

  const runDirectory = path.join(
    projectRoot,
    "scratch",
    "telemetry",
    runId,
  );

  const rawDirectory = path.join(
    runDirectory,
    "raw",
  );

  const sessionsDirectory = path.join(
    runDirectory,
    "sessions",
  );

  const events = listFiles(
    rawDirectory,
    ".jsonl",
  ).flatMap(readJsonLines);

  const snapshots = listFiles(
    sessionsDirectory,
    ".json",
  )
    .map(readJsonFile)
    .filter(
      (value) =>
        value &&
        typeof value === "object",
    );

  const summary = aggregate(
    runId,
    events,
    snapshots,
  );

  const outputs = writeOutputs(
    runDirectory,
    summary,
  );

  process.stdout.write(
    [
      `UNLOCK telemetry summarized.`,
      `Run: ${runId}`,
      `Events: ${events.length}`,
      `Sessions: ${summary.sessions.observed}`,
      `Summary: ${normalizeSlashes(
        path.relative(
          projectRoot,
          outputs.markdownPath,
        ),
      )}`,
    ].join("\n") + "\n",
  );
}

main();
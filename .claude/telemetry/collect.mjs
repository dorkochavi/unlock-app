import fs from "node:fs";
import path from "node:path";

const DEBUG = process.env.UNLOCK_TELEMETRY_DEBUG === "1";

function debug(...args) {
  if (DEBUG) {
    console.error("[unlock-telemetry]", ...args);
  }
}

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

function findProjectRoot(input) {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;

  if (fromEnv && path.isAbsolute(fromEnv)) {
    return path.resolve(fromEnv);
  }

  if (input?.cwd && path.isAbsolute(input.cwd)) {
    let current = path.resolve(input.cwd);

    while (true) {
      const hasPlan = fs.existsSync(
        path.join(current, "docs", "CHATGPT_PLAN.md"),
      );

      const hasGit = fs.existsSync(path.join(current, ".git"));

      if (hasPlan || hasGit) {
        return current;
      }

      const parent = path.dirname(current);

      if (parent === current) {
        break;
      }

      current = parent;
    }

    return path.resolve(input.cwd);
  }

  return process.cwd();
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

function persistRunIdForSession(runId) {
  const envFile = process.env.CLAUDE_ENV_FILE;

  if (!envFile) {
    return;
  }

  try {
    fs.appendFileSync(
      envFile,
      `UNLOCK_RUN_ID=${runId}\n`,
      "utf8",
    );
  } catch (error) {
    debug("Could not persist UNLOCK_RUN_ID:", error);
  }
}

function redactPath(rawPath, projectRoot) {
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    return null;
  }

  try {
    const absolutePath = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(projectRoot, rawPath);

    const relative = path.relative(projectRoot, absolutePath);

    const isInsideProject =
      relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative);

    if (relative === "") {
      return ".";
    }

    if (isInsideProject) {
      return normalizeSlashes(relative);
    }

    return `<external>/${path.basename(absolutePath)}`;
  } catch {
    return "<unresolved>";
  }
}

function classifyPath(relativePath) {
  if (!relativePath) {
    return "OTHER";
  }

  const value = normalizeSlashes(relativePath);

  const hotFiles = new Set([
    "AGENTS.md",
    "CLAUDE.md",
    "docs/CHATGPT_PLAN.md",
    "docs/DEV_STATUS.md",
  ]);

  if (hotFiles.has(value)) {
    return "HOT";
  }

  if (
    value === "docs/CONTEXT_MAP.md" ||
    value.startsWith(".claude/rules/") ||
    value.startsWith(".claude/skills/") ||
    value.startsWith(".cursor/rules/")
  ) {
    return "WARM";
  }

  if (
    value.startsWith("docs/RUNS/") ||
    value === "docs/INVARIANT_MATRIX.md"
  ) {
    return "RESTRICTED";
  }

  if (
    value.includes("/__tests__/") ||
    value.includes("/tests/") ||
    value.includes("/test/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(value)
  ) {
    return "TEST";
  }

  if (
    value.startsWith("src/") ||
    value.startsWith("supabase/migrations/")
  ) {
    return "IMPLEMENTATION";
  }

  if (value.startsWith("docs/")) {
    return "COLD";
  }

  return "OTHER";
}

function safeResponseChars(response) {
  if (response === undefined || response === null) {
    return 0;
  }

  try {
    if (typeof response === "string") {
      return response.length;
    }

    return JSON.stringify(response).length;
  } catch {
    return null;
  }
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function commandClass(toolName, toolInput) {
  if (toolName !== "Bash" && toolName !== "PowerShell") {
    return null;
  }

  const command =
    typeof toolInput?.command === "string"
      ? toolInput.command.trim()
      : "";

  if (!command) {
    return "shell:unknown";
  }

  const normalized = command
    .replace(/\s+/g, " ")
    .trim();

  let match = normalized.match(
    /^npm\s+run\s+([a-zA-Z0-9:_-]+)/,
  );

  if (match) {
    return `npm-run:${match[1]}`;
  }

  match = normalized.match(
    /^npm\s+(test|install|ci)\b/,
  );

  if (match) {
    return `npm:${match[1]}`;
  }

  match = normalized.match(
    /^npx\s+([a-zA-Z0-9@/_-]+)/,
  );

  if (match) {
    return `npx:${match[1]}`;
  }

  match = normalized.match(
    /^git\s+([a-zA-Z0-9_-]+)/,
  );

  if (match) {
    return `git:${match[1]}`;
  }

  match = normalized.match(
    /^node\s+/,
  );

  if (match) {
    return "node";
  }

  match = normalized.match(
    /^pnpm\s+([a-zA-Z0-9:_-]+)/,
  );

  if (match) {
    return `pnpm:${match[1]}`;
  }

  match = normalized.match(
    /^yarn\s+([a-zA-Z0-9:_-]+)/,
  );

  if (match) {
    return `yarn:${match[1]}`;
  }

  return "shell:other";
}

function activityForTool(toolName) {
  switch (toolName) {
    case "Read":
      return "FILE_READ";

    case "Grep":
      return "SEARCH_GREP";

    case "Glob":
      return "SEARCH_GLOB";

    case "Edit":
      return "FILE_EDIT";

    case "Write":
      return "FILE_WRITE";

    case "Bash":
    case "PowerShell":
      return "SHELL";

    default:
      return "TOOL";
  }
}

function extractToolFilePath(toolName, toolInput, projectRoot) {
  if (!toolInput || typeof toolInput !== "object") {
    return null;
  }

  if (
    toolName === "Read" ||
    toolName === "Edit" ||
    toolName === "Write"
  ) {
    return redactPath(
      toolInput.file_path ??
        toolInput.filePath ??
        toolInput.path,
      projectRoot,
    );
  }

  if (toolName === "Grep" || toolName === "Glob") {
    return redactPath(
      toolInput.path ??
        toolInput.cwd,
      projectRoot,
    );
  }

  return null;
}

function buildBaseEvent(input, runId) {
  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    run_id: runId,
    session_id: input.session_id ?? null,
    prompt_id: input.prompt_id ?? null,
    event: input.hook_event_name ?? "UNKNOWN",
    agent_id: input.agent_id ?? null,
    agent_type: input.agent_type ?? null,
    effort:
      input.effort &&
      typeof input.effort.level === "string"
        ? input.effort.level
        : null,
  };
}

function buildEvent(input, projectRoot, runId) {
  const base = buildBaseEvent(input, runId);
  const eventName = input.hook_event_name;

  if (eventName === "SessionStart") {
    return {
      ...base,
      activity: "SESSION_START",
      source: input.source ?? null,
      model: input.model ?? null,
    };
  }

  if (eventName === "SessionEnd") {
    return {
      ...base,
      activity: "SESSION_END",
      reason: input.reason ?? null,
    };
  }

  if (eventName === "InstructionsLoaded") {
    const filePath = redactPath(
      input.file_path,
      projectRoot,
    );

    return {
      ...base,
      activity: "INSTRUCTION_LOAD",
      file_path: filePath,
      file_classification: classifyPath(filePath),
      memory_type: input.memory_type ?? null,
      load_reason: input.load_reason ?? null,
      globs: Array.isArray(input.globs)
        ? input.globs
        : null,
      trigger_file_path: redactPath(
        input.trigger_file_path,
        projectRoot,
      ),
      parent_file_path: redactPath(
        input.parent_file_path,
        projectRoot,
      ),
    };
  }

  if (
    eventName === "PostToolUse" ||
    eventName === "PostToolUseFailure"
  ) {
    const toolName = input.tool_name ?? "UNKNOWN";
    const filePath = extractToolFilePath(
      toolName,
      input.tool_input,
      projectRoot,
    );

    const event = {
      ...base,
      activity: activityForTool(toolName),
      success: eventName === "PostToolUse",
      tool_name: toolName,
      tool_use_id: input.tool_use_id ?? null,
      duration_ms: numberOrNull(input.duration_ms),
      file_path: filePath,
      file_classification: classifyPath(filePath),
      response_chars:
        eventName === "PostToolUse"
          ? safeResponseChars(input.tool_response)
          : null,
      command_class: commandClass(
        toolName,
        input.tool_input,
      ),
    };

    if (toolName === "Read") {
      event.read_offset = numberOrNull(
        input.tool_input?.offset,
      );

      event.read_limit = numberOrNull(
        input.tool_input?.limit,
      );
    }

    return event;
  }

  if (eventName === "SubagentStart") {
    return {
      ...base,
      activity: "SUBAGENT_START",
      subagent_id: input.agent_id ?? null,
      subagent_type: input.agent_type ?? null,
    };
  }

  if (eventName === "SubagentStop") {
    return {
      ...base,
      activity: "SUBAGENT_STOP",
      subagent_id: input.agent_id ?? null,
      subagent_type: input.agent_type ?? null,
    };
  }

  if (eventName === "PreCompact") {
    return {
      ...base,
      activity: "COMPACT_START",
      trigger: input.trigger ?? null,
    };
  }

  if (eventName === "PostCompact") {
    return {
      ...base,
      activity: "COMPACT_END",
      trigger: input.trigger ?? null,
    };
  }

  return {
    ...base,
    activity: "LIFECYCLE",
  };
}

function appendEvent(projectRoot, runId, input, event) {
  const sessionId = sanitizeSegment(
    input.session_id,
    "unknown-session",
  );

  const runDir = path.join(
    projectRoot,
    "scratch",
    "telemetry",
    runId,
  );

  const rawDir = path.join(runDir, "raw");

  fs.mkdirSync(rawDir, {
    recursive: true,
  });

  const eventPath = path.join(
    rawDir,
    `${sessionId}.jsonl`,
  );

  fs.appendFileSync(
    eventPath,
    `${JSON.stringify(event)}\n`,
    "utf8",
  );
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

  const projectRoot = findProjectRoot(input);
  const runId = resolveRunId(projectRoot);

  if (input.hook_event_name === "SessionStart") {
    persistRunIdForSession(runId);
  }

  const event = buildEvent(
    input,
    projectRoot,
    runId,
  );

  appendEvent(
    projectRoot,
    runId,
    input,
    event,
  );
}

main().catch((error) => {
  debug(error);

  // Telemetry must never block Claude Code.
  process.exitCode = 0;
});
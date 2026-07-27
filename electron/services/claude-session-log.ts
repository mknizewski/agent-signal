import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { ClaudeExternalSession } from "../../src/shared/external-sessions";
import type {
  SessionStatus,
  SessionSubagent
} from "../../src/shared/types";

const MAX_LOG_READ_BYTES = 2 * 1024 * 1024;
const MAX_SUBAGENTS_PER_SESSION = 32;
const MAX_SUBAGENT_META_BYTES = 64 * 1024;

export type ClaudeLogActivity =
  | "working"
  | "attention"
  | "idle"
  | "error"
  | "unknown";

export interface ClaudeLogState {
  activity: ClaudeLogActivity;
  activeTurnId?: string;
  pendingAttentionToolIds?: string[];
  permissionMode?: string;
}

interface CachedLogState extends ClaudeLogState {
  path: string;
  offset: number;
  remainder: string;
}

export class ClaudeSessionLogTracker {
  private readonly states = new Map<string, CachedLogState>();
  private readonly transcriptPaths = new Map<string, string>();
  private readonly projectsRoot: string;

  constructor(projectsRoot = defaultClaudeProjectsRoot()) {
    this.projectsRoot = projectsRoot;
  }

  async enrich(
    sessions: ClaudeExternalSession[],
    trackedSessionIds: string[]
  ): Promise<ClaudeExternalSession[]> {
    const tracked = new Set(trackedSessionIds);
    for (const sessionId of this.states.keys()) {
      if (!tracked.has(sessionId)) this.states.delete(sessionId);
    }
    for (const sessionId of this.transcriptPaths.keys()) {
      if (!tracked.has(sessionId)) this.transcriptPaths.delete(sessionId);
    }

    return Promise.all(
      sessions.map(async (session) => {
        if (!tracked.has(session.sessionId)) return session;
        const logPath = await this.findTranscriptPath(session);
        if (!logPath) {
          return { ...session, logActivity: "unknown" };
        }
        return {
          ...session,
          logActivity: await this.readActivity(session.sessionId, logPath)
        };
      })
    );
  }

  async listSubagents(
    sessions: ClaudeExternalSession[],
    trackedSessionIds: string[]
  ): Promise<SessionSubagent[]> {
    const tracked = new Set(trackedSessionIds);
    const discovered = await Promise.all(
      sessions
        .filter((session) => tracked.has(session.sessionId))
        .map(async (session) => {
          const transcriptPath = await this.findTranscriptPath(session);
          if (!transcriptPath) return [];
          return readClaudeSubagents(
            session.sessionId,
            path.join(
              path.dirname(transcriptPath),
              safeSessionId(session.sessionId),
              "subagents"
            )
          );
        })
    );
    return discovered.flat();
  }

  private async findTranscriptPath(
    session: ClaudeExternalSession
  ): Promise<string | undefined> {
    const cached = this.transcriptPaths.get(session.sessionId);
    if (cached && (await isFile(cached))) return cached;
    this.transcriptPaths.delete(session.sessionId);

    const fileName = `${safeSessionId(session.sessionId)}.jsonl`;
    const directProjectKey = claudeProjectKey(session.cwd);
    if (directProjectKey) {
      const directPath = path.join(
        this.projectsRoot,
        directProjectKey,
        fileName
      );
      if (await isFile(directPath)) {
        this.transcriptPaths.set(session.sessionId, directPath);
        return directPath;
      }
    }

    try {
      const projects = await readdir(this.projectsRoot, {
        withFileTypes: true
      });
      for (const project of projects) {
        if (!project.isDirectory()) continue;
        const candidate = path.join(this.projectsRoot, project.name, fileName);
        if (!(await isFile(candidate))) continue;
        this.transcriptPaths.set(session.sessionId, candidate);
        return candidate;
      }
    } catch {
      // Claude Code has not created its local project store yet.
    }
    return undefined;
  }

  private async readActivity(
    sessionId: string,
    logPath: string
  ): Promise<ClaudeLogActivity> {
    const previous = this.states.get(sessionId);
    try {
      const fileStats = await stat(logPath);
      if (
        !previous ||
        previous.path !== logPath ||
        fileStats.size < previous.offset
      ) {
        const start = Math.max(0, fileStats.size - MAX_LOG_READ_BYTES);
        const data = await readLogRange(logPath, start, fileStats.size - start);
        const initial: CachedLogState = {
          path: logPath,
          offset: fileStats.size,
          remainder: "",
          activity: "unknown"
        };
        this.consume(initial, completeLogLines(data, start > 0));
        this.states.set(sessionId, initial);
        return initial.activity;
      }

      if (fileStats.size === previous.offset) return previous.activity;

      const length = fileStats.size - previous.offset;
      if (length > MAX_LOG_READ_BYTES) {
        const start = fileStats.size - MAX_LOG_READ_BYTES;
        const data = await readLogRange(logPath, start, MAX_LOG_READ_BYTES);
        const refreshed: CachedLogState = {
          path: logPath,
          offset: fileStats.size,
          remainder: "",
          activity: "unknown"
        };
        this.consume(refreshed, completeLogLines(data, true));
        this.states.set(sessionId, refreshed);
        return refreshed.activity;
      }

      const data = await readLogRange(logPath, previous.offset, length);
      previous.offset += data.length;
      this.consume(previous, data.toString("utf8"));
      return previous.activity;
    } catch {
      return previous?.activity ?? "unknown";
    }
  }

  private consume(state: CachedLogState, chunk: string): void {
    const combined = state.remainder + chunk;
    const lines = combined.split(/\r?\n/);
    state.remainder = lines.pop() ?? "";
    const next = reduceClaudeLogLines(lines, state);
    state.activity = next.activity;
    state.activeTurnId = next.activeTurnId;
    state.permissionMode = next.permissionMode;
    if (next.pendingAttentionToolIds?.length) {
      state.pendingAttentionToolIds = next.pendingAttentionToolIds;
    } else {
      delete state.pendingAttentionToolIds;
    }
  }
}

export function reduceClaudeLogLines(
  lines: string[],
  initial: ClaudeLogState = { activity: "unknown" }
): ClaudeLogState {
  const state: ClaudeLogState = {
    ...initial,
    pendingAttentionToolIds: initial.pendingAttentionToolIds
      ? [...initial.pendingAttentionToolIds]
      : undefined
  };

  for (const line of lines) {
    if (
      !line.includes('"type"') &&
      !line.includes('"message"') &&
      !line.includes('"permissionMode"')
    ) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as ClaudeTranscriptEntry;
      if (typeof entry.permissionMode === "string") {
        state.permissionMode = entry.permissionMode;
      }

      if (entry.type === "system" && entry.subtype === "api_error") {
        state.activity = "error";
        state.activeTurnId = undefined;
        delete state.pendingAttentionToolIds;
        continue;
      }

      if (entry.type === "user") {
        consumeUserEntry(state, entry);
        continue;
      }
      if (entry.type !== "assistant") continue;

      const blocks = Array.isArray(entry.message?.content)
        ? entry.message.content
        : [];
      for (const block of blocks) {
        if (block?.type !== "tool_use" || typeof block.id !== "string") {
          continue;
        }
        if (isInteractiveClaudeTool(block.name)) {
          const pending = new Set(state.pendingAttentionToolIds ?? []);
          pending.add(block.id);
          state.pendingAttentionToolIds = [...pending];
          state.activity = "attention";
        } else if (state.activity !== "attention") {
          state.activity = "working";
        }
      }

      if (isTerminalClaudeStopReason(entry.message?.stop_reason)) {
        state.activity = "idle";
        state.activeTurnId = undefined;
        delete state.pendingAttentionToolIds;
      } else if (
        entry.message?.stop_reason === "tool_use" &&
        state.activity !== "attention"
      ) {
        state.activity = "working";
      }
    } catch {
      // A concurrently written partial JSONL record is retried on the next pass.
    }
  }

  return state;
}

interface ClaudeTranscriptEntry {
  type?: string;
  subtype?: string;
  uuid?: string;
  isMeta?: boolean;
  permissionMode?: string;
  message?: {
    role?: string;
    stop_reason?: string | null;
    content?: string | ClaudeContentBlock[];
  };
}

interface ClaudeContentBlock {
  type?: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
}

function consumeUserEntry(
  state: ClaudeLogState,
  entry: ClaudeTranscriptEntry
): void {
  if (entry.isMeta) return;
  const content = entry.message?.content;
  if (typeof content === "string") {
    state.activity = "working";
    state.activeTurnId = entry.uuid;
    delete state.pendingAttentionToolIds;
    return;
  }
  if (!Array.isArray(content)) return;

  const containsUserText = content.some((block) => block?.type === "text");
  const resolvedIds = new Set(
    content.flatMap((block) =>
      block?.type === "tool_result" && typeof block.tool_use_id === "string"
        ? [block.tool_use_id]
        : []
    )
  );
  if (resolvedIds.size === 0) {
    if (containsUserText) {
      state.activity = "working";
      state.activeTurnId = entry.uuid;
      delete state.pendingAttentionToolIds;
    }
    return;
  }

  const pending = (state.pendingAttentionToolIds ?? []).filter(
    (toolId) => !resolvedIds.has(toolId)
  );
  if (pending.length > 0) {
    state.pendingAttentionToolIds = pending;
    state.activity = "attention";
  } else {
    delete state.pendingAttentionToolIds;
    state.activity = state.activeTurnId ? "working" : "unknown";
  }
}

function isTerminalClaudeStopReason(reason: unknown): boolean {
  return reason === "end_turn" || reason === "stop_sequence";
}

interface ClaudeSubagentMeta {
  agentType?: unknown;
  description?: unknown;
  spawnDepth?: unknown;
  stoppedByUser?: unknown;
}

async function readClaudeSubagents(
  parentSessionId: string,
  subagentsDirectory: string
): Promise<SessionSubagent[]> {
  let entries;
  try {
    entries = await readdir(subagentsDirectory, { withFileTypes: true });
  } catch {
    return [];
  }

  const subagents = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /^agent-[a-zA-Z0-9_-]+\.jsonl$/.test(entry.name)
      )
      .slice(0, MAX_SUBAGENTS_PER_SESSION)
      .map(async (entry) => {
        const agentId = path.basename(entry.name, ".jsonl");
        const transcriptPath = path.join(subagentsDirectory, entry.name);
        const meta = await readClaudeSubagentMeta(
          path.join(subagentsDirectory, `${agentId}.meta.json`)
        );
        try {
          const fileStats = await stat(transcriptPath);
          const start = Math.max(
            0,
            fileStats.size - MAX_LOG_READ_BYTES
          );
          const data = await readLogRange(
            transcriptPath,
            start,
            fileStats.size - start
          );
          const state = reduceClaudeLogLines(
            completeLogLines(data, start > 0).split(/\r?\n/)
          );
          const role = cleanClaudeSubagentText(meta.agentType);
          const title =
            cleanClaudeSubagentText(meta.description) ||
            role ||
            "Subagent Claude";
          return {
            id: `claude-subagent:${parentSessionId}:${agentId}`,
            threadId: agentId,
            parentThreadId: parentSessionId,
            title,
            ...(role ? { role } : {}),
            depth:
              typeof meta.spawnDepth === "number" &&
              Number.isFinite(meta.spawnDepth)
                ? Math.max(1, Math.round(meta.spawnDepth))
                : 1,
            status:
              meta.stoppedByUser === true
                ? "idle"
                : claudeSubagentStatus(state.activity),
            updatedAt: fileStats.mtime.toISOString()
          } satisfies SessionSubagent;
        } catch {
          return undefined;
        }
      })
  );
  return subagents.filter(
    (subagent): subagent is SessionSubagent => Boolean(subagent)
  );
}

async function readClaudeSubagentMeta(
  metaPath: string
): Promise<ClaudeSubagentMeta> {
  try {
    const fileStats = await stat(metaPath);
    if (!fileStats.isFile() || fileStats.size > MAX_SUBAGENT_META_BYTES) {
      return {};
    }
    const data = await readLogRange(metaPath, 0, fileStats.size);
    return JSON.parse(data.toString("utf8")) as ClaudeSubagentMeta;
  } catch {
    return {};
  }
}

function claudeSubagentStatus(
  activity: ClaudeLogActivity
): SessionStatus {
  if (activity === "working") return "working";
  if (activity === "attention") return "attention";
  if (activity === "error") return "error";
  if (activity === "idle") return "idle";
  return "unavailable";
}

function cleanClaudeSubagentText(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 160)
    : "";
}

function isInteractiveClaudeTool(name: unknown): boolean {
  if (typeof name !== "string") return false;
  return [
    "askuserquestion",
    "exitplanmode",
    "request_user_input",
    "request_permissions",
    "request_permission"
  ].includes(name.trim().toLowerCase());
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function readLogRange(
  logPath: string,
  start: number,
  length: number
): Promise<Buffer> {
  const data = Buffer.alloc(length);
  const handle = await open(logPath, "r");
  let bytesRead = 0;
  try {
    while (bytesRead < length) {
      const result = await handle.read(
        data,
        bytesRead,
        length - bytesRead,
        start + bytesRead
      );
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }
  } finally {
    await handle.close();
  }
  return data.subarray(0, bytesRead);
}

function completeLogLines(data: Buffer, startsMidFile: boolean): string {
  const text = data.toString("utf8");
  if (!startsMidFile) return text;
  const firstLineBreak = text.indexOf("\n");
  return firstLineBreak >= 0 ? text.slice(firstLineBreak + 1) : "";
}

function safeSessionId(sessionId: string): string {
  return path.basename(sessionId.trim());
}

function claudeProjectKey(cwd: string | undefined): string | undefined {
  const cleaned = cwd?.trim();
  if (!cleaned) return undefined;
  return cleaned.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function defaultClaudeProjectsRoot(): string {
  const configRoot =
    process.env.CLAUDE_CONFIG_DIR?.trim() ||
    path.join(homedir(), ".claude");
  return path.join(configRoot, "projects");
}

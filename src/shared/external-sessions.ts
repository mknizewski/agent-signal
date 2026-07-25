import type {
  DiscoveredSession,
  SessionStatus,
  SessionSubagent
} from "./types";
import { projectNameFromPath } from "./preferences";

export interface CodexThreadStatus {
  type?: "notLoaded" | "idle" | "systemError" | "active" | string;
  activeFlags?: string[];
}

export interface CodexExternalThread {
  id: string;
  name?: string | null;
  preview?: string | null;
  cwd?: string | null;
  path?: string | null;
  createdAt?: number | string | null;
  updatedAt?: number | string | null;
  status?: CodexThreadStatus | null;
  logActivity?: "working" | "attention" | "idle" | "unknown";
  agentNickname?: string | null;
  agentRole?: string | null;
  source?:
    | string
    | {
        subAgent?:
          | string
          | {
              thread_spawn?: {
                parent_thread_id?: string;
                depth?: number;
                agent_nickname?: string | null;
                agent_role?: string | null;
              };
            };
      };
}

export interface ClaudeExternalSession {
  sessionId: string;
  summary: string;
  lastModified: number;
  customTitle?: string;
  firstPrompt?: string;
  cwd?: string;
  createdAt?: number;
  tag?: string;
}

const EXTERNAL_ACTIVITY_WINDOW_MS = 12_000;

export function mapCodexThread(
  thread: CodexExternalThread,
  now = new Date()
): DiscoveredSession {
  const createdAt = toIso(thread.createdAt, now);
  const updatedAt = toIso(thread.updatedAt, new Date(createdAt));
  const status = codexStatus(thread, updatedAt, now);
  const preview = cleanText(thread.preview) || "Sesja Codexa";
  const workingDirectory = cleanText(thread.cwd);

  return {
    id: `codex:${thread.id}`,
    agent: "codex",
    source: "codex-app",
    title: cleanText(thread.name) || preview,
    summary: preview,
    workingDirectory,
    projectName: projectNameFromPath(workingDirectory),
    status,
    statusText: codexStatusText(status),
    createdAt,
    updatedAt,
    threadId: thread.id
  };
}

export function isCodexSubagentThread(
  thread: CodexExternalThread
): boolean {
  return Boolean(subagentSpawnSource(thread));
}

export function mapCodexSubagent(
  thread: CodexExternalThread,
  now = new Date()
): SessionSubagent | undefined {
  const source = subagentSpawnSource(thread);
  if (!source?.parent_thread_id) return undefined;
  const updatedAt = toIso(thread.updatedAt, now);
  const preview = cleanText(thread.preview);
  const nickname =
    cleanText(thread.agentNickname) ||
    cleanText(source.agent_nickname);
  const role =
    cleanText(thread.agentRole) ||
    cleanText(source.agent_role);
  const status = codexSubagentStatus(thread);

  return {
    id: `codex-subagent:${thread.id}`,
    threadId: thread.id,
    parentThreadId: source.parent_thread_id,
    title:
      nickname ||
      cleanText(thread.name) ||
      role ||
      preview ||
      "Subagent",
    ...(role ? { role } : {}),
    depth:
      typeof source.depth === "number" && Number.isFinite(source.depth)
        ? Math.max(1, Math.round(source.depth))
        : 1,
    status,
    updatedAt
  };
}

export function mapClaudeSession(
  session: ClaudeExternalSession,
  now = new Date()
): DiscoveredSession {
  const createdAt = new Date(
    session.createdAt ?? session.lastModified
  ).toISOString();
  const updatedAt = new Date(session.lastModified).toISOString();
  const recentlyActive =
    Math.abs(now.getTime() - session.lastModified) <=
    EXTERNAL_ACTIVITY_WINDOW_MS;
  const status: SessionStatus = recentlyActive ? "working" : "idle";
  const title =
    cleanText(session.customTitle) ||
    cleanText(session.summary) ||
    cleanText(session.firstPrompt) ||
    "Sesja Claude Code";
  const workingDirectory = cleanText(session.cwd);

  return {
    id: `claude:${session.sessionId}`,
    agent: "claude",
    source: "claude-code",
    title,
    summary: cleanText(session.firstPrompt) || title,
    workingDirectory,
    projectName: projectNameFromPath(workingDirectory),
    status,
    statusText: recentlyActive
      ? "Aktywność wykryta w Claude Code"
      : "Sesja jest bezczynna",
    createdAt,
    updatedAt,
    sessionId: session.sessionId
  };
}

function codexStatus(
  thread: CodexExternalThread,
  updatedAt: string,
  now: Date
): SessionStatus {
  const runtimeStatus = thread.status?.type;
  const activeFlags = thread.status?.activeFlags ?? [];

  if (
    runtimeStatus === "active" &&
    activeFlags.some((flag) =>
      ["waitingOnApproval", "waitingOnUserInput"].includes(flag)
    )
  ) {
    return "attention";
  }
  if (runtimeStatus === "systemError") return "error";
  if (thread.logActivity === "attention") return "attention";
  if (runtimeStatus === "active") return "working";
  if (thread.logActivity === "working") return "working";
  if (thread.logActivity === "idle") return "idle";
  if (runtimeStatus === "idle") return "idle";
  if (thread.updatedAt == null) return "unavailable";

  const recentlyActive =
    Math.abs(now.getTime() - new Date(updatedAt).getTime()) <=
    EXTERNAL_ACTIVITY_WINDOW_MS;
  return recentlyActive ? "working" : "unavailable";
}

function codexSubagentStatus(
  thread: CodexExternalThread
): SessionStatus {
  const runtimeStatus = thread.status?.type;
  const activeFlags = thread.status?.activeFlags ?? [];
  if (
    runtimeStatus === "active" &&
    activeFlags.some((flag) =>
      ["waitingOnApproval", "waitingOnUserInput"].includes(flag)
    )
  ) {
    return "attention";
  }
  if (runtimeStatus === "active") return "working";
  if (runtimeStatus === "systemError") return "error";
  if (runtimeStatus === "idle" || runtimeStatus === "notLoaded") {
    return "idle";
  }
  return "unavailable";
}

function subagentSpawnSource(
  thread: CodexExternalThread
):
  | {
      parent_thread_id?: string;
      depth?: number;
      agent_nickname?: string | null;
      agent_role?: string | null;
    }
  | undefined {
  if (!thread.source || typeof thread.source !== "object") {
    return undefined;
  }
  const subAgent = thread.source.subAgent;
  if (!subAgent || typeof subAgent !== "object") return undefined;
  return subAgent.thread_spawn;
}

function codexStatusText(status: SessionStatus): string {
  if (status === "attention") {
    return "Czeka na zatwierdzenie w aplikacji Codex";
  }
  if (status === "working") return "Aktywność wykryta w Codex";
  if (status === "error") return "Sesja Codexa zgłosiła błąd";
  if (status === "idle") return "Sesja jest bezczynna";
  return "Nie można potwierdzić stanu sesji Codexa";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(
  value: number | string | null | undefined,
  fallback: Date
): string {
  if (typeof value === "number") {
    const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

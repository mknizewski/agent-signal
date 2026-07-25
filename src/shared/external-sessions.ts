import type { DiscoveredSession, SessionStatus } from "./types";

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

  return {
    id: `codex:${thread.id}`,
    agent: "codex",
    source: "codex-app",
    title: cleanText(thread.name) || preview,
    summary: preview,
    workingDirectory: cleanText(thread.cwd),
    status,
    statusText: codexStatusText(status),
    createdAt,
    updatedAt,
    threadId: thread.id
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

  return {
    id: `claude:${session.sessionId}`,
    agent: "claude",
    source: "claude-code",
    title,
    summary: cleanText(session.firstPrompt) || title,
    workingDirectory: cleanText(session.cwd),
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

function codexStatusText(status: SessionStatus): string {
  if (status === "attention") return "Czeka na decyzję w aplikacji Codex";
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

export type AgentKind = "codex" | "claude";

export type SessionSource = "codex-app" | "claude-code";

export type SessionStatus =
  | "working"
  | "attention"
  | "idle"
  | "error"
  | "unavailable";

export interface DiscoveredSession {
  id: string;
  agent: AgentKind;
  source: SessionSource;
  title: string;
  summary: string;
  workingDirectory: string;
  status: SessionStatus;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  threadId?: string;
  sessionId?: string;
}

export interface TrackedSession extends DiscoveredSession {
  trackedAt: string;
  available: boolean;
}

export interface TrackedSessionRecord {
  id: string;
  agent: AgentKind;
  source: SessionSource;
  title: string;
  summary: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  trackedAt: string;
  threadId?: string;
  sessionId?: string;
}

export interface ArchivedSessionRecord extends TrackedSessionRecord {
  archivedAt: string;
}

export interface TrackingState {
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
}

export interface ProviderStatus {
  id: AgentKind;
  available: boolean;
  label: string;
  version?: string;
  executable?: string;
  source: "cli" | "sdk" | "missing";
  detail: string;
}

export interface AppSnapshot {
  trackedSessions: TrackedSession[];
  archivedSessions: ArchivedSessionRecord[];
  availableSessions: DiscoveredSession[];
  providers: Record<AgentKind, ProviderStatus>;
  updatedAt: string;
}

export interface TrackSessionsInput {
  sessionIds: string[];
}

export interface AgentSignalApi {
  getSnapshot(): Promise<AppSnapshot>;
  trackSessions(input: TrackSessionsInput): Promise<AppSnapshot>;
  archiveSession(sessionId: string): Promise<AppSnapshot>;
  restoreArchivedSession(sessionId: string): Promise<AppSnapshot>;
  deleteArchivedSession(sessionId: string): Promise<AppSnapshot>;
  refresh(): Promise<AppSnapshot>;
  setCompactMode(compact: boolean): Promise<void>;
  setWindowTheme(theme: "light" | "dark"): Promise<void>;
  exitApp(): Promise<void>;
  onSnapshot(listener: (snapshot: AppSnapshot) => void): () => void;
}

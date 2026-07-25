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

export interface MobileSessionSummary {
  key: string;
  agent: AgentKind;
  title: string;
  status: SessionStatus;
  statusText: string;
  updatedAt: string;
}

export interface MobileProviderSummary {
  id: AgentKind;
  label: string;
  available: boolean;
}

export interface MobileSnapshot {
  sessions: MobileSessionSummary[];
  providers: Record<AgentKind, MobileProviderSummary>;
  counts: Record<SessionStatus, number>;
  updatedAt: string;
}

export interface PairedMobileDevice {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt: string;
  connected: boolean;
  notificationsEnabled: boolean;
}

export interface MobileGatewayStatus {
  enabled: boolean;
  running: boolean;
  address?: string;
  hostname?: string;
  origin?: string;
  certificateFingerprint?: string;
  error?: string;
  devices: PairedMobileDevice[];
}

export interface MobilePairingSession {
  certificateUrl: string;
  certificateQrDataUrl: string;
  pairingUrl: string;
  pairingQrDataUrl: string;
  certificateFingerprint: string;
  expiresAt: string;
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
  getMobileGatewayStatus(): Promise<MobileGatewayStatus>;
  setMobileGatewayEnabled(enabled: boolean): Promise<MobileGatewayStatus>;
  createMobilePairing(): Promise<MobilePairingSession>;
  revokeMobileDevice(deviceId: string): Promise<MobileGatewayStatus>;
  resetMobileAccess(): Promise<MobileGatewayStatus>;
  onSnapshot(listener: (snapshot: AppSnapshot) => void): () => void;
  onMobileGatewayStatus(
    listener: (status: MobileGatewayStatus) => void
  ): () => void;
}

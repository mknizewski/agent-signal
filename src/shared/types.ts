export type AgentKind = "codex" | "claude";

export type SessionSource = "codex-app" | "claude-code";

export type AppLanguage = "pl" | "en";

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
  projectName: string;
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
  pinned: boolean;
}

export interface TrackedSessionRecord {
  id: string;
  agent: AgentKind;
  source: SessionSource;
  title: string;
  summary: string;
  workingDirectory: string;
  projectName: string;
  pinned?: boolean;
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
  preferences: AppPreferences;
  projectGroups: ProjectGroupConfig[];
}

export interface ProjectGroupConfig {
  projectKey: string;
  label?: string;
  symbol?: string;
  color?: string;
  collapsed?: boolean;
  order: number;
}

export interface AppPreferences {
  language: AppLanguage;
  groupTrackedByProject: boolean;
  autoGroupProjects: boolean;
  groupPickerByProject: boolean;
  openChatOnDoubleClick: boolean;
  enablePinning: boolean;
  watchedSidebarExpanded: boolean;
  idlePetAnimation: boolean;
  idleAfterMinutes: number;
  detectNewSessions: boolean;
  promptForNewSessions: boolean;
  systemNotifications: boolean;
  approvalNotifications: boolean;
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
  preferences: AppPreferences;
  projectGroups: ProjectGroupConfig[];
  pendingSessionPrompts: string[];
  updatedAt: string;
}

export interface TrackSessionsInput {
  sessionIds: string[];
}

export interface UpdateTrackedSessionInput {
  sessionId: string;
  pinned?: boolean;
  projectName?: string;
}

export interface UpdateProjectGroupInput {
  projectKey: string;
  label?: string;
  symbol?: string;
  color?: string;
  collapsed?: boolean;
}

export interface ReorderProjectGroupsInput {
  projectKeys: string[];
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
  updateTrackedSession(input: UpdateTrackedSessionInput): Promise<AppSnapshot>;
  updatePreferences(
    patch: Partial<AppPreferences>
  ): Promise<AppSnapshot>;
  updateProjectGroup(input: UpdateProjectGroupInput): Promise<AppSnapshot>;
  reorderProjectGroups(
    input: ReorderProjectGroupsInput
  ): Promise<AppSnapshot>;
  dismissSessionPrompt(sessionId: string): Promise<AppSnapshot>;
  openSession(sessionId: string): Promise<void>;
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

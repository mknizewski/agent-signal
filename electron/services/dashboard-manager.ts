import type {
  AppPreferences,
  AppSnapshot,
  ArchivedSessionRecord,
  DiscoveredSession,
  ProviderStatus,
  ProjectGroupConfig,
  ReorderProjectGroupsInput,
  SetProjectGroupsCollapsedInput,
  SessionSubagent,
  TrackSessionsInput,
  TrackedSessionRecord,
  UpdateProjectGroupInput,
  UpdateTrackedSessionInput
} from "../../src/shared/types";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  projectNameFromPath
} from "../../src/shared/preferences";
import {
  normalizeProjectGroupConfigs,
  setProjectGroupsCollapsed
} from "../../src/shared/project-groups";
import {
  createArchivedSessionRecord,
  createTrackingRecord,
  resolveTrackedSessions,
  restoreTrackingRecord,
  untrackedSessions
} from "../../src/shared/tracking";
import { detectProviders } from "./detector";
import { ExternalSessionSync } from "./external-session-sync";
import { TrackingStore } from "./store";

export class DashboardManager {
  private records: TrackedSessionRecord[] = [];
  private archivedRecords: ArchivedSessionRecord[] = [];
  private catalog: DiscoveredSession[] = [];
  private subagents: SessionSubagent[] = [];
  private preferences: AppPreferences = DEFAULT_PREFERENCES;
  private projectGroups: ProjectGroupConfig[] = [];
  private pendingSessionPrompts = new Set<string>();
  private knownCatalogIds = new Set<string>();
  private catalogInitialized = false;
  private providers = detectProviders();
  private externalSessionSync?: ExternalSessionSync;
  private saveQueue = Promise.resolve();

  constructor(
    private readonly store: TrackingStore,
    private readonly onSnapshot: (snapshot: AppSnapshot) => void
  ) {}

  async initialize(): Promise<void> {
    const state = await this.store.load();
    this.records = state.trackedSessions;
    this.archivedRecords = state.archivedSessions;
    this.preferences = normalizePreferences(state.preferences);
    this.projectGroups = normalizeProjectGroupConfigs(state.projectGroups);
    this.providers = detectProviders();
    this.emit();
    this.startExternalSync();
  }

  getSnapshot(): AppSnapshot {
    const subagentsByParent = new Map<string, SessionSubagent[]>();
    for (const subagent of this.subagents) {
      const current = subagentsByParent.get(subagent.parentThreadId) ?? [];
      current.push(subagent);
      subagentsByParent.set(subagent.parentThreadId, current);
    }
    const trackedSessions = resolveTrackedSessions(
      this.records,
      this.catalog,
      this.preferences.autoGroupProjects
    ).map((session) => ({
      ...session,
      subagents: session.threadId
        ? (subagentsByParent.get(session.threadId) ?? []).sort(
            compareSubagents
          )
        : []
    }));
    return {
      trackedSessions,
      archivedSessions: this.archivedRecords,
      availableSessions: untrackedSessions(
        this.records,
        this.catalog,
        this.archivedRecords
      ),
      providers: {
        codex: publicProviderStatus(this.providers.codex),
        claude: publicProviderStatus(this.providers.claude)
      },
      preferences: this.preferences,
      projectGroups: this.projectGroups.map((group) => ({ ...group })),
      pendingSessionPrompts: [...this.pendingSessionPrompts].filter((id) =>
        this.catalog.some((session) => session.id === id)
      ),
      updatedAt: new Date().toISOString()
    };
  }

  async trackSessions(input: TrackSessionsInput): Promise<AppSnapshot> {
    const requestedIds = [...new Set(input.sessionIds)];
    if (requestedIds.length === 0) {
      throw new Error("Wybierz co najmniej jeden czat.");
    }

    const catalogById = new Map(
      this.catalog.map((session) => [session.id, session])
    );
    const hiddenIds = new Set([
      ...this.records.map((record) => record.id),
      ...this.archivedRecords.map((record) => record.id)
    ]);
    const now = new Date().toISOString();
    const sessionsToTrack = requestedIds
      .filter((id) => !hiddenIds.has(id))
      .map((id) => catalogById.get(id));
    if (sessionsToTrack.some((session) => !session)) {
      throw new Error("Wybrany czat nie jest już dostępny. Odśwież listę.");
    }
    this.records.push(
      ...sessionsToTrack.map((session) => createTrackingRecord(session!, now))
    );
    for (const sessionId of requestedIds) {
      this.pendingSessionPrompts.delete(sessionId);
    }

    this.persistAndEmit();
    void this.externalSessionSync?.refreshNow();
    return this.getSnapshot();
  }

  async archiveSession(sessionId: string): Promise<AppSnapshot> {
    return this.archiveSessions({ sessionIds: [sessionId] });
  }

  async archiveSessions(input: TrackSessionsInput): Promise<AppSnapshot> {
    const requestedIds = [...new Set(input.sessionIds)];
    const requestedSet = new Set(requestedIds);
    const records = this.records.filter((item) => requestedSet.has(item.id));
    if (records.length !== requestedIds.length) {
      throw new Error("Co najmniej jeden czat nie jest już obserwowany.");
    }
    const catalogById = new Map(this.catalog.map((item) => [item.id, item]));
    this.records = this.records.filter((item) => !requestedSet.has(item.id));
    this.archivedRecords = [
      ...records.map((record) =>
        createArchivedSessionRecord(record, catalogById.get(record.id))
      ),
      ...this.archivedRecords
    ];
    this.persistAndEmit();
    return this.getSnapshot();
  }

  async restoreArchivedSession(sessionId: string): Promise<AppSnapshot> {
    const archived = this.archivedRecords.find((item) => item.id === sessionId);
    if (!archived) {
      throw new Error("Ten czat nie znajduje się już w archiwum.");
    }
    this.archivedRecords = this.archivedRecords.filter(
      (item) => item.id !== sessionId
    );
    this.records.push(restoreTrackingRecord(archived));
    this.persistAndEmit();
    void this.externalSessionSync?.refreshNow();
    return this.getSnapshot();
  }

  async deleteArchivedSession(sessionId: string): Promise<AppSnapshot> {
    return this.deleteArchivedSessions({ sessionIds: [sessionId] });
  }

  async deleteArchivedSessions(
    input: TrackSessionsInput
  ): Promise<AppSnapshot> {
    const requestedIds = [...new Set(input.sessionIds)];
    const requestedSet = new Set(requestedIds);
    const records = this.archivedRecords.filter((item) =>
      requestedSet.has(item.id)
    );
    if (records.length !== requestedIds.length) {
      throw new Error("Co najmniej jeden czat nie znajduje się już w archiwum.");
    }
    this.archivedRecords = this.archivedRecords.filter(
      (item) => !requestedSet.has(item.id)
    );
    this.persistAndEmit();
    return this.getSnapshot();
  }

  updateTrackedSession(input: UpdateTrackedSessionInput): AppSnapshot {
    const record = this.records.find((item) => item.id === input.sessionId);
    if (!record) {
      throw new Error("Ten czat nie jest już obserwowany.");
    }

    if (typeof input.pinned === "boolean") {
      record.pinned = this.preferences.enablePinning
        ? input.pinned
        : false;
    }
    if (typeof input.projectName === "string") {
      record.projectName = input.projectName.trim().slice(0, 80);
    }
    if (input.groupOverride !== undefined) {
      if (input.groupOverride === null) delete record.groupOverride;
      else record.groupOverride = input.groupOverride.trim().slice(0, 80);
    }
    this.persistAndEmit();
    return this.getSnapshot();
  }

  updatePreferences(patch: Partial<AppPreferences>): AppSnapshot {
    this.preferences = normalizePreferences({
      ...this.preferences,
      ...patch
    });
    if (!this.preferences.enablePinning) {
      this.records = this.records.map((record) => ({
        ...record,
        pinned: false
      }));
    }
    if (this.preferences.autoGroupProjects) {
      const catalogById = new Map(
        this.catalog.map((session) => [session.id, session])
      );
      this.records = this.records.map((record) => ({
        ...record,
        projectName:
          catalogById.get(record.id)?.projectName ||
          projectNameFromPath(record.workingDirectory)
      }));
    }
    if (
      !this.preferences.detectNewSessions ||
      !this.preferences.promptForNewSessions
    ) {
      this.pendingSessionPrompts.clear();
    }
    this.persistAndEmit();
    return this.getSnapshot();
  }

  updateProjectGroup(input: UpdateProjectGroupInput): AppSnapshot {
    const existing = this.projectGroups.find(
      (group) => group.projectKey === input.projectKey
    );
    const maxOrder = this.projectGroups.reduce(
      (highest, group) => Math.max(highest, group.order),
      -1
    );
    const next: ProjectGroupConfig = {
      ...existing,
      projectKey: input.projectKey,
      order: existing?.order ?? maxOrder + 1
    };
    if (input.label !== undefined) {
      const label = input.label.trim().slice(0, 80);
      if (label) next.label = label;
      else delete next.label;
    }
    if (input.symbol !== undefined) {
      const symbol = [...input.symbol.trim()].slice(0, 2).join("");
      if (symbol) next.symbol = symbol;
      else delete next.symbol;
    }
    if (input.color !== undefined) {
      const color = input.color.trim().toLowerCase();
      if (color) next.color = color;
      else delete next.color;
    }
    if (input.collapsed !== undefined) {
      if (input.collapsed) next.collapsed = true;
      else delete next.collapsed;
    }
    if (input.sidebarCollapsed !== undefined) {
      if (input.sidebarCollapsed) next.sidebarCollapsed = true;
      else delete next.sidebarCollapsed;
    }
    this.projectGroups = normalizeProjectGroupConfigs([
      ...this.projectGroups.filter(
        (group) => group.projectKey !== input.projectKey
      ),
      next
    ]);
    this.persistAndEmit();
    return this.getSnapshot();
  }

  reorderProjectGroups(input: ReorderProjectGroupsInput): AppSnapshot {
    const existing = new Map(
      this.projectGroups.map((group) => [group.projectKey, group])
    );
    const orderedKeys = [...new Set(input.projectKeys)];
    const orderedSet = new Set(orderedKeys);
    const reordered = orderedKeys.map((projectKey, order) => ({
      ...(existing.get(projectKey) ?? { projectKey }),
      order
    }));
    const remaining = this.projectGroups
      .filter((group) => !orderedSet.has(group.projectKey))
      .sort((left, right) => left.order - right.order)
      .map((group, index) => ({
        ...group,
        order: orderedKeys.length + index
      }));
    this.projectGroups = normalizeProjectGroupConfigs([
      ...reordered,
      ...remaining
    ]);
    this.persistAndEmit();
    return this.getSnapshot();
  }

  setProjectGroupsCollapsed(
    input: SetProjectGroupsCollapsedInput
  ): AppSnapshot {
    this.projectGroups = setProjectGroupsCollapsed(
      this.projectGroups,
      input.projectKeys,
      input.collapsed
    );
    this.persistAndEmit();
    return this.getSnapshot();
  }

  dismissSessionPrompt(sessionId: string): AppSnapshot {
    this.pendingSessionPrompts.delete(sessionId);
    this.emit();
    return this.getSnapshot();
  }

  getTrackedSessionRecord(sessionId: string): TrackedSessionRecord {
    const record = this.records.find((item) => item.id === sessionId);
    if (!record) {
      throw new Error("Ten czat nie jest już obserwowany.");
    }
    return { ...record };
  }

  refresh(): AppSnapshot {
    this.providers = detectProviders();
    void this.externalSessionSync?.refreshNow();
    const snapshot = this.getSnapshot();
    this.onSnapshot(snapshot);
    return snapshot;
  }

  async shutdown(): Promise<void> {
    await this.externalSessionSync?.stop();
    await this.saveQueue;
  }

  private startExternalSync(): void {
    this.externalSessionSync = new ExternalSessionSync({
      getCodexExecutable: () => this.providers.codex.executable,
      getTrackedCodexThreadIds: () =>
        this.records.flatMap((record) =>
          record.source === "codex-app" && record.threadId
            ? [record.threadId]
            : []
        ),
      onSessions: (sessions, subagents) => {
        const hiddenIds = new Set([
          ...this.records.map((record) => record.id),
          ...this.archivedRecords.map((record) => record.id)
        ]);
        if (
          this.catalogInitialized &&
          this.preferences.detectNewSessions &&
          this.preferences.promptForNewSessions
        ) {
          for (const session of sessions) {
            if (
              !this.knownCatalogIds.has(session.id) &&
              !hiddenIds.has(session.id)
            ) {
              this.pendingSessionPrompts.add(session.id);
            }
          }
        }
        this.knownCatalogIds = new Set(
          sessions.map((session) => session.id)
        );
        this.catalogInitialized = true;
        this.catalog = sessions;
        this.subagents = subagents;
        this.emit();
      },
      onDiagnostic: (message, error) => {
        console.warn(message, error);
      }
    });
    void this.externalSessionSync.start().catch((error) => {
      console.warn("Nie udało się uruchomić katalogu sesji.", error);
    });
  }

  private persistAndEmit(): void {
    const records = this.records.map((record) => ({ ...record }));
    const archivedRecords = this.archivedRecords.map((record) => ({
      ...record
    }));
    const projectGroups = this.projectGroups.map((group) => ({ ...group }));
    this.saveQueue = this.saveQueue
      .then(() =>
        this.store.save({
          trackedSessions: records,
          archivedSessions: archivedRecords,
          preferences: this.preferences,
          projectGroups
        })
      )
      .catch((error) => {
        console.error("Could not save Agent Signal dashboard state", error);
      });
    this.emit();
  }

  private emit(): void {
    this.onSnapshot(this.getSnapshot());
  }
}

function publicProviderStatus(provider: ProviderStatus): ProviderStatus {
  const { executable: _executable, ...publicStatus } = provider;
  return publicStatus;
}

function compareSubagents(
  left: SessionSubagent,
  right: SessionSubagent
): number {
  const activePriority = (status: SessionSubagent["status"]) =>
    status === "attention"
      ? 0
      : status === "working"
        ? 1
        : status === "error"
          ? 2
          : status === "idle"
            ? 3
            : 4;
  const priorityDifference =
    activePriority(left.status) - activePriority(right.status);
  if (priorityDifference !== 0) return priorityDifference;
  return (
    new Date(right.updatedAt).getTime() -
    new Date(left.updatedAt).getTime()
  );
}

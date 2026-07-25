import type {
  AppSnapshot,
  ArchivedSessionRecord,
  DiscoveredSession,
  ProviderStatus,
  TrackSessionsInput,
  TrackedSessionRecord
} from "../../src/shared/types";
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
    this.providers = detectProviders();
    this.emit();
    this.startExternalSync();
  }

  getSnapshot(): AppSnapshot {
    return {
      trackedSessions: resolveTrackedSessions(this.records, this.catalog),
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

    this.persistAndEmit();
    void this.externalSessionSync?.refreshNow();
    return this.getSnapshot();
  }

  async archiveSession(sessionId: string): Promise<AppSnapshot> {
    const record = this.records.find((item) => item.id === sessionId);
    if (!record) {
      throw new Error("Ten czat nie jest już obserwowany.");
    }
    const currentSession = this.catalog.find((item) => item.id === sessionId);
    this.records = this.records.filter((item) => item.id !== sessionId);
    this.archivedRecords.unshift(
      createArchivedSessionRecord(record, currentSession)
    );
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
    const previousLength = this.archivedRecords.length;
    this.archivedRecords = this.archivedRecords.filter(
      (item) => item.id !== sessionId
    );
    if (this.archivedRecords.length === previousLength) {
      throw new Error("Ten czat nie znajduje się już w archiwum.");
    }
    this.persistAndEmit();
    return this.getSnapshot();
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
      onSessions: (sessions) => {
        this.catalog = sessions;
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
    this.saveQueue = this.saveQueue
      .then(() =>
        this.store.save({
          trackedSessions: records,
          archivedSessions: archivedRecords
        })
      )
      .catch((error) => {
        console.error("Could not save AgentSignal dashboard state", error);
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

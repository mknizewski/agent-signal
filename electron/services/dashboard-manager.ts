import type {
  AppSnapshot,
  DiscoveredSession,
  ProviderStatus,
  TrackSessionsInput,
  TrackedSessionRecord
} from "../../src/shared/types";
import {
  createTrackingRecord,
  resolveTrackedSessions,
  untrackedSessions
} from "../../src/shared/tracking";
import { detectProviders } from "./detector";
import { ExternalSessionSync } from "./external-session-sync";
import { TrackingStore } from "./store";

export class DashboardManager {
  private records: TrackedSessionRecord[] = [];
  private catalog: DiscoveredSession[] = [];
  private providers = detectProviders();
  private externalSessionSync?: ExternalSessionSync;
  private saveQueue = Promise.resolve();

  constructor(
    private readonly store: TrackingStore,
    private readonly onSnapshot: (snapshot: AppSnapshot) => void
  ) {}

  async initialize(): Promise<void> {
    this.records = await this.store.load();
    this.providers = detectProviders();
    this.emit();
    this.startExternalSync();
  }

  getSnapshot(): AppSnapshot {
    return {
      trackedSessions: resolveTrackedSessions(this.records, this.catalog),
      availableSessions: untrackedSessions(this.records, this.catalog),
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
    const trackedIds = new Set(this.records.map((record) => record.id));
    const now = new Date().toISOString();
    const sessionsToTrack = requestedIds
      .filter((id) => !trackedIds.has(id))
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

  async untrackSession(sessionId: string): Promise<AppSnapshot> {
    const previousLength = this.records.length;
    this.records = this.records.filter((record) => record.id !== sessionId);
    if (this.records.length === previousLength) {
      throw new Error("Ten czat nie jest już obserwowany.");
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
    this.saveQueue = this.saveQueue
      .then(() => this.store.save(records))
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

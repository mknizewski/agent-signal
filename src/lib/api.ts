import type {
  AgentSignalApi,
  AppPreferences,
  AppSnapshot,
  ArchivedSessionRecord,
  DiscoveredSession,
  MobileGatewayStatus,
  TrackSessionsInput,
  TrackedSession
} from "../shared/types";
import {
  DEFAULT_PREFERENCES,
  projectNameFromPath
} from "../shared/preferences";

const demoNow = Date.now();

const demoCatalog: DiscoveredSession[] = [
  session({
    id: "codex:demo-1",
    agent: "codex",
    title: "Refaktor modułu płatności",
    summary: "Uprość obsługę płatności i uruchom testy.",
    directory: "D:\\Git\\checkout-service",
    status: "working",
    updatedOffset: 5_000
  }),
  session({
    id: "claude:demo-2",
    agent: "claude",
    title: "Błąd logowania SSO",
    summary: "Sprawdź przyczynę błędu integracji.",
    directory: "D:\\Git\\customer-portal",
    status: "attention",
    updatedOffset: 42_000
  }),
  session({
    id: "codex:demo-3",
    agent: "codex",
    title: "Walidacja formularza",
    summary: "Dodaj walidację formularza rejestracji.",
    directory: "D:\\Git\\customer-portal",
    status: "idle",
    updatedOffset: 31 * 60_000
  }),
  session({
    id: "claude:demo-4",
    agent: "claude",
    title: "Dokumentacja API",
    summary: "Uzupełnij przykłady integracji.",
    directory: "D:\\Git\\developer-docs",
    status: "idle",
    updatedOffset: 75 * 60_000
  }),
  session({
    id: "codex:demo-5",
    agent: "codex",
    title: "Aktualizacja zależności",
    summary: "Sprawdź aktualizacje paczek.",
    directory: "D:\\Git\\admin-panel",
    status: "idle",
    updatedOffset: 3 * 60 * 60_000
  })
];

let demoSnapshot: AppSnapshot = {
  updatedAt: new Date().toISOString(),
  providers: {
    codex: {
      id: "codex",
      label: "Codex",
      available: true,
      source: "cli",
      detail: "Połączono z lokalną historią Codexa"
    },
    claude: {
      id: "claude",
      label: "Claude Code",
      available: true,
      source: "sdk",
      detail: "Połączono z lokalnymi sesjami Claude Code"
    }
  },
  preferences: DEFAULT_PREFERENCES,
  projectGroups: [
    {
      projectKey: "customer-portal",
      color: "#8d6bc5",
      order: 0
    },
    {
      projectKey: "checkout-service",
      color: "#2d9f75",
      order: 1
    }
  ],
  pendingSessionPrompts: ["codex:demo-5"],
  trackedSessions: demoCatalog.slice(0, 3).map((item) => ({
    ...item,
    trackedAt: new Date(demoNow - 2 * 60 * 60_000).toISOString(),
    pinned: item.id === "codex:demo-1",
    available: true
  })),
  archivedSessions: demoCatalog.slice(3, 4).map((item) => ({
    ...stripRuntimeStatus(item),
    trackedAt: new Date(demoNow - 3 * 60 * 60_000).toISOString(),
    archivedAt: new Date(demoNow - 45 * 60_000).toISOString()
  })),
  availableSessions: demoCatalog.slice(4)
};

const demoListeners = new Set<(snapshot: AppSnapshot) => void>();
const demoMobileListeners = new Set<(status: MobileGatewayStatus) => void>();
let demoMobileStatus: MobileGatewayStatus = {
  enabled: false,
  running: false,
  devices: []
};

function emitDemo(): void {
  demoSnapshot = { ...demoSnapshot, updatedAt: new Date().toISOString() };
  for (const listener of demoListeners) listener(demoSnapshot);
}

const demoApi: AgentSignalApi = {
  getSnapshot: async () => demoSnapshot,
  trackSessions: async (input: TrackSessionsInput) => {
    const selectedIds = new Set(input.sessionIds);
    const selected = demoSnapshot.availableSessions.filter((item) =>
      selectedIds.has(item.id)
    );
    const trackedAt = new Date().toISOString();
    demoSnapshot = {
      ...demoSnapshot,
      trackedSessions: [
        ...demoSnapshot.trackedSessions,
        ...selected.map((item) => ({
          ...item,
          trackedAt,
          pinned: false,
          available: true
        }))
      ],
      availableSessions: demoSnapshot.availableSessions.filter(
        (item) => !selectedIds.has(item.id)
      ),
      pendingSessionPrompts: demoSnapshot.pendingSessionPrompts.filter(
        (item) => !selectedIds.has(item)
      )
    };
    emitDemo();
    return demoSnapshot;
  },
  archiveSession: async (sessionId: string) => {
    const removed = demoSnapshot.trackedSessions.find(
      (item) => item.id === sessionId
    );
    demoSnapshot = {
      ...demoSnapshot,
      trackedSessions: demoSnapshot.trackedSessions.filter(
        (item) => item.id !== sessionId
      ),
      archivedSessions: removed
        ? [
            {
              ...stripRuntimeStatus(removed),
              archivedAt: new Date().toISOString()
            },
            ...demoSnapshot.archivedSessions
          ]
        : demoSnapshot.archivedSessions
    };
    emitDemo();
    return demoSnapshot;
  },
  restoreArchivedSession: async (sessionId: string) => {
    const restored = demoSnapshot.archivedSessions.find(
      (item) => item.id === sessionId
    );
    demoSnapshot = {
      ...demoSnapshot,
      archivedSessions: demoSnapshot.archivedSessions.filter(
        (item) => item.id !== sessionId
      ),
      trackedSessions: restored
        ? [...demoSnapshot.trackedSessions, restoreDemoSession(restored)]
        : demoSnapshot.trackedSessions
    };
    emitDemo();
    return demoSnapshot;
  },
  deleteArchivedSession: async (sessionId: string) => {
    const removed = demoSnapshot.archivedSessions.find(
      (item) => item.id === sessionId
    );
    demoSnapshot = {
      ...demoSnapshot,
      archivedSessions: demoSnapshot.archivedSessions.filter(
        (item) => item.id !== sessionId
      ),
      availableSessions: removed
        ? [...demoSnapshot.availableSessions, archivedToDiscovered(removed)]
        : demoSnapshot.availableSessions
    };
    emitDemo();
    return demoSnapshot;
  },
  updateTrackedSession: async (input) => {
    demoSnapshot = {
      ...demoSnapshot,
      trackedSessions: demoSnapshot.trackedSessions.map((item) =>
        item.id === input.sessionId
          ? {
              ...item,
              ...(input.pinned === undefined
                ? {}
                : { pinned: input.pinned }),
              ...(input.projectName === undefined
                ? {}
                : { projectName: input.projectName })
            }
          : item
      )
    };
    emitDemo();
    return demoSnapshot;
  },
  updatePreferences: async (patch: Partial<AppPreferences>) => {
    demoSnapshot = {
      ...demoSnapshot,
      preferences: { ...demoSnapshot.preferences, ...patch }
    };
    emitDemo();
    return demoSnapshot;
  },
  updateProjectGroup: async (input) => {
    const existing = demoSnapshot.projectGroups.find(
      (group) => group.projectKey === input.projectKey
    );
    demoSnapshot = {
      ...demoSnapshot,
      projectGroups: [
        ...demoSnapshot.projectGroups.filter(
          (group) => group.projectKey !== input.projectKey
        ),
        {
          projectKey: input.projectKey,
          order: existing?.order ?? demoSnapshot.projectGroups.length,
          ...(input.label.trim() ? { label: input.label.trim() } : {}),
          ...(input.symbol.trim() ? { symbol: input.symbol.trim() } : {}),
          ...(input.color ? { color: input.color } : {})
        }
      ]
    };
    emitDemo();
    return demoSnapshot;
  },
  reorderProjectGroups: async (input) => {
    const existing = new Map(
      demoSnapshot.projectGroups.map((group) => [group.projectKey, group])
    );
    demoSnapshot = {
      ...demoSnapshot,
      projectGroups: input.projectKeys.map((projectKey, order) => ({
        ...(existing.get(projectKey) ?? { projectKey }),
        order
      }))
    };
    emitDemo();
    return demoSnapshot;
  },
  dismissSessionPrompt: async (sessionId: string) => {
    demoSnapshot = {
      ...demoSnapshot,
      pendingSessionPrompts: demoSnapshot.pendingSessionPrompts.filter(
        (item) => item !== sessionId
      )
    };
    emitDemo();
    return demoSnapshot;
  },
  openSession: async () => undefined,
  refresh: async () => {
    emitDemo();
    return demoSnapshot;
  },
  setCompactMode: async () => undefined,
  setWindowTheme: async () => undefined,
  exitApp: async () => undefined,
  getMobileGatewayStatus: async () => demoMobileStatus,
  setMobileGatewayEnabled: async (enabled) => {
    demoMobileStatus = {
      ...demoMobileStatus,
      enabled,
      running: enabled,
      address: enabled ? "192.168.1.20" : undefined,
      hostname: enabled ? "agentsignal-demo.local" : undefined,
      origin: enabled ? "https://agentsignal-demo.local:47831" : undefined,
      certificateFingerprint: enabled
        ? "DE:MO:00:00:00:00"
        : undefined
    };
    for (const listener of demoMobileListeners) listener(demoMobileStatus);
    return demoMobileStatus;
  },
  createMobilePairing: async () => ({
    certificateUrl: "http://192.168.1.20:47830/",
    certificateQrDataUrl: "",
    pairingUrl: "https://agentsignal-demo.local:47831/pair#pair=demo",
    pairingQrDataUrl: "",
    certificateFingerprint: "DE:MO:00:00:00:00",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }),
  revokeMobileDevice: async () => demoMobileStatus,
  resetMobileAccess: async () => {
    demoMobileStatus = { enabled: false, running: false, devices: [] };
    for (const listener of demoMobileListeners) listener(demoMobileStatus);
    return demoMobileStatus;
  },
  onSnapshot: (listener) => {
    demoListeners.add(listener);
    return () => demoListeners.delete(listener);
  },
  onMobileGatewayStatus: (listener) => {
    demoMobileListeners.add(listener);
    return () => demoMobileListeners.delete(listener);
  }
};

function session(input: {
  id: string;
  agent: "codex" | "claude";
  title: string;
  summary: string;
  directory: string;
  status: DiscoveredSession["status"];
  updatedOffset: number;
}): DiscoveredSession {
  return {
    id: input.id,
    agent: input.agent,
    source: input.agent === "codex" ? "codex-app" : "claude-code",
    title: input.title,
    summary: input.summary,
    workingDirectory: input.directory,
    projectName: projectNameFromPath(input.directory),
    status: input.status,
    statusText:
      input.status === "working"
        ? "Agent wykonuje zadanie"
        : input.status === "attention"
          ? "Czeka na decyzję w aplikacji źródłowej"
          : "Sesja jest bezczynna",
    createdAt: new Date(demoNow - 2 * 60 * 60_000).toISOString(),
    updatedAt: new Date(demoNow - input.updatedOffset).toISOString(),
    ...(input.agent === "codex"
      ? { threadId: input.id }
      : { sessionId: input.id })
  };
}

function stripRuntimeStatus(
  session: DiscoveredSession | TrackedSession
): Omit<ArchivedSessionRecord, "archivedAt"> {
  if ("trackedAt" in session) {
    const {
      status: _status,
      statusText: _statusText,
      available: _available,
      ...record
    } = session;
    return record;
  }
  const {
    status: _status,
    statusText: _statusText,
    ...record
  } = session;
  return {
    ...record,
    trackedAt: new Date().toISOString()
  };
}

function restoreDemoSession(session: ArchivedSessionRecord): TrackedSession {
  const { archivedAt: _archivedAt, ...record } = session;
  const current = demoCatalog.find((item) => item.id === session.id);
  return current
    ? {
        ...current,
        trackedAt: record.trackedAt,
        pinned: record.pinned ?? false,
        available: true
      }
    : {
        ...record,
        pinned: record.pinned ?? false,
        status: "unavailable",
        statusText: "Sesja nie jest obecnie widoczna",
        available: false
      };
}

function archivedToDiscovered(
  session: ArchivedSessionRecord
): DiscoveredSession {
  const current = demoCatalog.find((item) => item.id === session.id);
  if (current) return current;
  const {
    trackedAt: _trackedAt,
    archivedAt: _archivedAt,
    ...record
  } = session;
  return {
    ...record,
    status: "unavailable",
    statusText: "Sesja nie jest obecnie widoczna"
  };
}

export const agentApi: AgentSignalApi = window.agentSignal ?? demoApi;
export const isDemoMode = !window.agentSignal;

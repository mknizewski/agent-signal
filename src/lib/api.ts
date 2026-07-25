import type {
  AgentSignalApi,
  AppSnapshot,
  DiscoveredSession,
  TrackSessionsInput,
  TrackedSession
} from "../shared/types";

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
  trackedSessions: demoCatalog.slice(0, 3).map((item) => ({
    ...item,
    trackedAt: new Date(demoNow - 2 * 60 * 60_000).toISOString(),
    available: true
  })),
  availableSessions: demoCatalog.slice(3)
};

const demoListeners = new Set<(snapshot: AppSnapshot) => void>();

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
          available: true
        }))
      ],
      availableSessions: demoSnapshot.availableSessions.filter(
        (item) => !selectedIds.has(item.id)
      )
    };
    emitDemo();
    return demoSnapshot;
  },
  untrackSession: async (sessionId: string) => {
    const removed = demoSnapshot.trackedSessions.find(
      (item) => item.id === sessionId
    );
    demoSnapshot = {
      ...demoSnapshot,
      trackedSessions: demoSnapshot.trackedSessions.filter(
        (item) => item.id !== sessionId
      ),
      availableSessions: removed
        ? [...demoSnapshot.availableSessions, stripTracking(removed)]
        : demoSnapshot.availableSessions
    };
    emitDemo();
    return demoSnapshot;
  },
  refresh: async () => {
    emitDemo();
    return demoSnapshot;
  },
  setCompactMode: async () => undefined,
  setWindowTheme: async () => undefined,
  exitApp: async () => undefined,
  onSnapshot: (listener) => {
    demoListeners.add(listener);
    return () => demoListeners.delete(listener);
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

function stripTracking(session: TrackedSession): DiscoveredSession {
  const { trackedAt: _trackedAt, available: _available, ...discovered } =
    session;
  return discovered;
}

export const agentApi: AgentSignalApi = window.agentSignal ?? demoApi;
export const isDemoMode = !window.agentSignal;

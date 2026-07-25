import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Bot,
  Circle,
  Moon,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sun
} from "lucide-react";
import { agentApi, isDemoMode } from "./lib/api";
import type {
  AgentKind,
  AppSnapshot,
  SessionStatus
} from "./shared/types";
import { SIGNAL_ORDER, statusDescription, statusLabel } from "./shared/status";
import { AgentMark } from "./components/AgentMark";
import { ArchivedChatRow } from "./components/ArchivedChatRow";
import { AppTitleBar } from "./components/AppTitleBar";
import { ChatPickerModal } from "./components/ChatPickerModal";
import { CompactDashboard } from "./components/CompactDashboard";
import { MobileDevicesModal } from "./components/MobileDevicesModal";
import { TrackedChatRow } from "./components/TrackedChatRow";

type ViewFilter = "all" | "working" | "attention" | "idle" | "archive";
type Theme = "light" | "dark";

const emptySnapshot: AppSnapshot = {
  trackedSessions: [],
  archivedSessions: [],
  availableSessions: [],
  providers: {
    codex: {
      id: "codex",
      label: "Codex",
      available: false,
      source: "missing",
      detail: "Sprawdzanie…"
    },
    claude: {
      id: "claude",
      label: "Claude Code",
      available: false,
      source: "missing",
      detail: "Sprawdzanie…"
    }
  },
  updatedAt: new Date().toISOString()
};

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mobileDevicesOpen, setMobileDevicesOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    window.localStorage.getItem("agent-signal-theme") === "light"
      ? "light"
      : "dark"
  );
  const [compact, setCompact] = useState(
    () => window.localStorage.getItem("agent-signal-compact") === "true"
  );

  useEffect(() => {
    void agentApi.getSnapshot().then(setSnapshot).catch(showError);
    return agentApi.onSnapshot(setSnapshot);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("agent-signal-theme", theme);
    void agentApi.setWindowTheme(theme).catch(() => undefined);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.compact = String(compact);
    window.localStorage.setItem("agent-signal-compact", String(compact));
    void agentApi.setCompactMode(compact).catch(showError);
  }, [compact]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    const next: Record<SessionStatus, number> = {
      working: 0,
      attention: 0,
      idle: 0,
      error: 0,
      unavailable: 0
    };
    for (const session of snapshot.trackedSessions) next[session.status] += 1;
    return next;
  }, [snapshot.trackedSessions]);

  const visibleSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.trackedSessions
      .filter((session) => {
        if (
          filter !== "all" &&
          filter !== "archive" &&
          session.status !== filter
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          session.title,
          session.summary,
          session.workingDirectory,
          session.agent,
          session.statusText
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const statusDifference =
          SIGNAL_ORDER.indexOf(left.status) - SIGNAL_ORDER.indexOf(right.status);
        if (statusDifference !== 0) return statusDifference;
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      });
  }, [filter, query, snapshot.trackedSessions]);

  const visibleArchivedSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.archivedSessions
      .filter((session) => {
        if (!normalizedQuery) return true;
        return [
          session.title,
          session.summary,
          session.workingDirectory,
          session.agent
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort(
        (left, right) =>
          new Date(right.archivedAt).getTime() -
          new Date(left.archivedAt).getTime()
      );
  }, [query, snapshot.archivedSessions]);

  function showError(error: unknown) {
    setToast(error instanceof Error ? error.message : String(error));
  }

  const refresh = async () => {
    setRefreshing(true);
    try {
      setSnapshot(await agentApi.refresh());
    } catch (error) {
      showError(error);
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  };

  const addSessions = async (sessionIds: string[]) => {
    setSnapshot(await agentApi.trackSessions({ sessionIds }));
  };

  const archiveSession = async (sessionId: string) => {
    try {
      setSnapshot(await agentApi.archiveSession(sessionId));
      setToast("Czat przeniesiono do archiwum.");
    } catch (error) {
      showError(error);
    }
  };

  const restoreSession = async (sessionId: string) => {
    try {
      setSnapshot(await agentApi.restoreArchivedSession(sessionId));
      setToast("Czat przywrócono do obserwowanych.");
    } catch (error) {
      showError(error);
    }
  };

  const deleteArchivedSession = async (sessionId: string) => {
    const session = snapshot.archivedSessions.find(
      (item) => item.id === sessionId
    );
    if (
      !window.confirm(
        `Usunąć „${session?.title ?? "ten czat"}” z archiwum AgentSignal?\n\nOryginalna rozmowa w Codex lub Claude Code pozostanie bez zmian.`
      )
    ) {
      return;
    }
    try {
      setSnapshot(await agentApi.deleteArchivedSession(sessionId));
      setToast("Wpis usunięto z archiwum.");
    } catch (error) {
      showError(error);
    }
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  if (compact) {
    return (
      <div className="app-frame">
        <AppTitleBar
          compact
          onToggleCompact={() => setCompact(false)}
        />
        <CompactDashboard
          counts={counts}
          sessions={snapshot.trackedSessions}
          theme={theme}
          refreshing={refreshing}
          updatedAt={snapshot.updatedAt}
          onRefresh={refresh}
          onThemeToggle={toggleTheme}
        />
        {toast && (
          <div
            className="toast"
            role="alert"
          >
            <AlertCircle size={17} />
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-frame">
      <AppTitleBar
        compact={false}
        onToggleCompact={() => setCompact(true)}
      />
      <div className="app-shell">
        <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <strong>AgentSignal</strong>
        </div>

        <nav className="nav-list">
          <NavButton
            active={filter === "all"}
            count={snapshot.trackedSessions.length}
            icon={<Bot size={16} />}
            label="Obserwowane"
            onClick={() => setFilter("all")}
          />
          <NavButton
            active={filter === "working"}
            count={counts.working}
            dot="working"
            label="Pracujące"
            onClick={() => setFilter("working")}
          />
          <NavButton
            active={filter === "attention"}
            count={counts.attention}
            dot="attention"
            label="Wymagają uwagi"
            onClick={() => setFilter("attention")}
          />
          <NavButton
            active={filter === "idle"}
            count={counts.idle}
            dot="idle"
            label="Wolne"
            onClick={() => setFilter("idle")}
          />
          <NavButton
            active={filter === "archive"}
            count={snapshot.archivedSessions.length}
            icon={<Archive size={16} />}
            label="Archiwum"
            onClick={() => setFilter("archive")}
          />
        </nav>

        <div className="sidebar__spacer" />

        <section className="connections">
          <span className="sidebar-label">Źródła</span>
          {(["codex", "claude"] as AgentKind[]).map((agent) => {
            const provider = snapshot.providers[agent];
            return (
              <div
                className="connection"
                key={agent}
                title={provider.detail}
              >
                <AgentMark agent={agent} />
                <div>
                  <strong>{provider.label}</strong>
                  <span
                    className={`connection__state ${
                      provider.available
                        ? "connection__state--online"
                        : "connection__state--offline"
                    }`}
                  >
                    {provider.available ? "Połączono" : "Niedostępny"}
                  </span>
                </div>
                <i className={provider.available ? "is-online" : ""} />
              </div>
            );
          })}
        </section>

        <div className="signal-legend">
          <span className="sidebar-label">Sygnalizacja</span>
          {(["working", "attention", "idle"] as SessionStatus[]).map(
            (status) => (
              <div key={status}>
                <i className={`legend-dot legend-dot--${status}`} />
                <span>
                  <strong>{statusLabel(status)}</strong>
                  <small>{statusDescription(status)}</small>
                </span>
              </div>
            )
          )}
        </div>
        </aside>

        <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {filter === "archive" ? "Historia dashboardu" : "Dashboard agentów"}
            </p>
            <h1>{filter === "archive" ? "Archiwum" : "Obserwowane czaty"}</h1>
            <span>
              {filter === "archive"
                ? "Zakończone obserwowanie sesji"
                : "Sesje Codex i Claude Code"}
            </span>
          </div>
          <div className="page-header__actions">
            <button
              className="icon-button icon-button--bordered"
              type="button"
              title="Urządzenia mobilne"
              aria-label="Urządzenia mobilne"
              onClick={() => setMobileDevicesOpen(true)}
            >
              <Smartphone size={17} />
            </button>
            <button
              className="icon-button icon-button--bordered"
              type="button"
              title={
                theme === "dark"
                  ? "Włącz jasny motyw"
                  : "Włącz ciemny motyw"
              }
              aria-label={
                theme === "dark"
                  ? "Włącz jasny motyw"
                  : "Włącz ciemny motyw"
              }
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="icon-button icon-button--bordered"
              type="button"
              title="Odśwież sesje"
              aria-label="Odśwież sesje"
              onClick={refresh}
            >
              <RefreshCw
                className={refreshing ? "is-spinning" : ""}
                size={17}
              />
            </button>
            {filter !== "archive" && (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={16} />
                Dodaj czat
              </button>
            )}
          </div>
        </header>

        {filter !== "archive" && (
          <section className="status-summary">
            <SummaryItem status="working" count={counts.working} />
            <SummaryItem status="attention" count={counts.attention} />
            <SummaryItem status="idle" count={counts.idle} />
          </section>
        )}

        <div
          className={`list-toolbar ${
            filter === "archive" ? "list-toolbar--archive" : ""
          }`}
        >
          <label className="search-input search-input--page">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                filter === "archive"
                  ? "Szukaj w archiwum"
                  : "Szukaj obserwowanych czatów"
              }
            />
          </label>
          <span>
            {filter === "archive"
              ? `${visibleArchivedSessions.length} ${
                  visibleArchivedSessions.length === 1 ? "wpis" : "wpisów"
                }`
              : `${visibleSessions.length} ${
                  visibleSessions.length === 1 ? "czat" : "czatów"
                }`}
          </span>
        </div>

        <section className="chat-list">
          {filter === "archive" ? (
            visibleArchivedSessions.length > 0 ? (
              <>
                <div className="chat-list__header archive-list__header">
                  <span>Czat</span>
                  <span>Zarchiwizowano</span>
                  <span>Akcje</span>
                </div>
                {visibleArchivedSessions.map((session) => (
                  <ArchivedChatRow
                    key={session.id}
                    session={session}
                    now={now}
                    onRestore={restoreSession}
                    onDelete={deleteArchivedSession}
                  />
                ))}
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon">
                  <Archive size={22} />
                </span>
                <h2>
                  {snapshot.archivedSessions.length === 0
                    ? "Archiwum jest puste"
                    : "Brak wpisów pasujących do wyszukiwania"}
                </h2>
                <p>
                  {snapshot.archivedSessions.length === 0
                    ? "Archiwizuj zakończone czaty z widoku obserwowanych. Dopiero tutaj możesz usunąć wpis z AgentSignal."
                    : "Zmień wyszukiwaną frazę."}
                </p>
              </div>
            )
          ) : visibleSessions.length > 0 ? (
            <>
              <div className="chat-list__header">
                <span>Czat</span>
                <span>Status</span>
                <span>Aktywność</span>
              </div>
              {visibleSessions.map((session) => (
                <TrackedChatRow
                  key={session.id}
                  session={session}
                  now={now}
                  onArchive={archiveSession}
                />
              ))}
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon">
                <SlidersHorizontal size={22} />
              </span>
              <h2>
                {snapshot.trackedSessions.length === 0
                  ? "Nie obserwujesz jeszcze żadnego czatu"
                  : "Brak czatów w tym widoku"}
              </h2>
              <p>
                {snapshot.trackedSessions.length === 0
                  ? "Dodaj istniejącą sesję z Codex lub Claude Code. AgentSignal nie tworzy nowych rozmów — tylko pokazuje ich stan."
                  : "Zmień filtr lub wyszukiwaną frazę."}
              </p>
              {snapshot.trackedSessions.length === 0 && (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus size={15} />
                  Wybierz czaty
                </button>
              )}
            </div>
          )}
        </section>

        {isDemoMode && <span className="demo-badge">Tryb podglądu UI</span>}
        </main>
      </div>

      <ChatPickerModal
        open={pickerOpen}
        sessions={snapshot.availableSessions}
        providers={snapshot.providers}
        onClose={() => setPickerOpen(false)}
        onAdd={addSessions}
      />

      <MobileDevicesModal
        open={mobileDevicesOpen}
        onClose={() => setMobileDevicesOpen(false)}
      />

      {toast && (
        <div
          className="toast"
          role="alert"
        >
          <AlertCircle size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  count: number;
  label: string;
  icon?: React.ReactNode;
  dot?: SessionStatus;
  onClick(): void;
}

function NavButton({
  active,
  count,
  label,
  icon,
  dot,
  onClick
}: NavButtonProps) {
  return (
    <button
      className={active ? "is-active" : ""}
      type="button"
      onClick={onClick}
    >
      {icon ?? (
        <Circle
          className={`nav-dot nav-dot--${dot}`}
          size={9}
          fill="currentColor"
          strokeWidth={0}
        />
      )}
      <span>{label}</span>
      <em>{count}</em>
    </button>
  );
}

function SummaryItem({
  status,
  count
}: {
  status: SessionStatus;
  count: number;
}) {
  return (
    <div>
      <i className={`summary-dot summary-dot--${status}`} />
      <span>
        <strong>{count}</strong>
        <small>{statusLabel(status)}</small>
      </span>
    </div>
  );
}

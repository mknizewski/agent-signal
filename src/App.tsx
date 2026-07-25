import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Bot,
  ChevronDown,
  Circle,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Sun
} from "lucide-react";
import { agentApi, isDemoMode } from "./lib/api";
import { copyFor, localizeRuntimeText } from "./lib/i18n";
import { DEFAULT_PREFERENCES } from "./shared/preferences";
import type {
  AgentKind,
  AppPreferences,
  AppSnapshot,
  SessionStatus,
  TrackedSession
} from "./shared/types";
import {
  SIGNAL_ORDER,
  statusDescription,
  statusLabel
} from "./shared/status";
import { AgentMark } from "./components/AgentMark";
import { ArchivedChatRow } from "./components/ArchivedChatRow";
import { AppTitleBar } from "./components/AppTitleBar";
import { ChatPickerModal } from "./components/ChatPickerModal";
import { CompactDashboard } from "./components/CompactDashboard";
import { MobileDevicesModal } from "./components/MobileDevicesModal";
import { NewSessionPrompt } from "./components/NewSessionPrompt";
import { SettingsView } from "./components/SettingsView";
import { TrackedChatRow } from "./components/TrackedChatRow";

type ViewFilter =
  | "all"
  | "working"
  | "attention"
  | "idle"
  | "archive"
  | "settings";
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
  preferences: DEFAULT_PREFERENCES,
  pendingSessionPrompts: [],
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
  const copy = copyFor(snapshot.preferences.language);

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
    document.documentElement.lang = snapshot.preferences.language;
  }, [snapshot.preferences.language]);

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
          filter !== "settings" &&
          session.status !== filter
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          session.title,
          session.summary,
          session.workingDirectory,
          session.projectName,
          session.agent,
          session.statusText
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort(compareSessions);
  }, [filter, query, snapshot.trackedSessions]);

  const visibleGroups = useMemo(
    () =>
      groupSessions(
        visibleSessions,
        snapshot.preferences.groupTrackedByProject,
        copy.common.noProject
      ),
    [
      copy.common.noProject,
      snapshot.preferences.groupTrackedByProject,
      visibleSessions
    ]
  );

  const sidebarGroups = useMemo(
    () =>
      groupSessions(
        [...snapshot.trackedSessions].sort(compareSessions),
        snapshot.preferences.groupTrackedByProject,
        copy.common.noProject
      ),
    [
      copy.common.noProject,
      snapshot.preferences.groupTrackedByProject,
      snapshot.trackedSessions
    ]
  );

  const visibleArchivedSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.archivedSessions
      .filter((session) => {
        if (!normalizedQuery) return true;
        return [
          session.title,
          session.summary,
          session.workingDirectory,
          session.projectName,
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

  const promptedSession = snapshot.pendingSessionPrompts
    .map((id) =>
      snapshot.availableSessions.find((session) => session.id === id)
    )
    .find((session): session is NonNullable<typeof session> =>
      Boolean(session)
    );

  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setToast(localizeRuntimeText(message, snapshot.preferences.language));
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
      setToast(copy.app.archiveSuccess);
    } catch (error) {
      showError(error);
    }
  };

  const restoreSession = async (sessionId: string) => {
    try {
      setSnapshot(await agentApi.restoreArchivedSession(sessionId));
      setToast(copy.app.restoreSuccess);
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
        copy.app.archiveDeleteConfirm(session?.title ?? copy.app.chatColumn)
      )
    ) {
      return;
    }
    try {
      setSnapshot(await agentApi.deleteArchivedSession(sessionId));
      setToast(copy.app.deleteSuccess);
    } catch (error) {
      showError(error);
    }
  };

  const updatePreferences = async (patch: Partial<AppPreferences>) => {
    try {
      setSnapshot(await agentApi.updatePreferences(patch));
    } catch (error) {
      showError(error);
    }
  };

  const togglePin = async (sessionId: string, pinned: boolean) => {
    try {
      setSnapshot(
        await agentApi.updateTrackedSession({ sessionId, pinned })
      );
    } catch (error) {
      showError(error);
    }
  };

  const openSession = async (sessionId: string) => {
    try {
      await agentApi.openSession(sessionId);
    } catch (error) {
      showError(error);
    }
  };

  const observePromptedSession = async (sessionId: string) => {
    try {
      setSnapshot(await agentApi.trackSessions({ sessionIds: [sessionId] }));
    } catch (error) {
      showError(error);
    }
  };

  const dismissPrompt = async (sessionId: string) => {
    try {
      setSnapshot(await agentApi.dismissSessionPrompt(sessionId));
    } catch (error) {
      showError(error);
    }
  };

  const focusSession = (sessionId: string) => {
    setFilter("all");
    window.requestAnimationFrame(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  if (compact) {
    return (
      <div className="app-frame">
        <AppTitleBar
          compact
          language={snapshot.preferences.language}
          onToggleCompact={() => setCompact(false)}
        />
        <CompactDashboard
          counts={counts}
          sessions={snapshot.trackedSessions}
          theme={theme}
          refreshing={refreshing}
          updatedAt={snapshot.updatedAt}
          now={now}
          preferences={snapshot.preferences}
          onRefresh={refresh}
          onThemeToggle={toggleTheme}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  const settingsView = filter === "settings";
  const archiveView = filter === "archive";

  return (
    <div className="app-frame">
      <AppTitleBar
        compact={false}
        language={snapshot.preferences.language}
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
            <strong>Agent Signal</strong>
          </div>

          <nav className="nav-list">
            <NavButton
              active={filter === "all"}
              count={snapshot.trackedSessions.length}
              icon={<Bot size={16} />}
              label={copy.app.watched}
              onClick={() => setFilter("all")}
            />
            <NavButton
              active={filter === "working"}
              count={counts.working}
              dot="working"
              label={copy.app.working}
              onClick={() => setFilter("working")}
            />
            <NavButton
              active={filter === "attention"}
              count={counts.attention}
              dot="attention"
              label={copy.app.attention}
              onClick={() => setFilter("attention")}
            />
            <NavButton
              active={filter === "idle"}
              count={counts.idle}
              dot="idle"
              label={copy.app.idle}
              onClick={() => setFilter("idle")}
            />
            <NavButton
              active={filter === "archive"}
              count={snapshot.archivedSessions.length}
              icon={<Archive size={16} />}
              label={copy.app.archive}
              onClick={() => setFilter("archive")}
            />
            <NavButton
              active={filter === "settings"}
              count={0}
              hideCount
              icon={<Settings size={16} />}
              label={copy.app.settings}
              onClick={() => setFilter("settings")}
            />
          </nav>

          <section className="sidebar-watched">
            <button
              className="sidebar-watched__toggle"
              type="button"
              title={
                snapshot.preferences.watchedSidebarExpanded
                  ? copy.app.collapseWatched
                  : copy.app.expandWatched
              }
              onClick={() =>
                void updatePreferences({
                  watchedSidebarExpanded:
                    !snapshot.preferences.watchedSidebarExpanded
                })
              }
            >
              <span>{copy.app.watchedSection}</span>
              <ChevronDown
                className={
                  snapshot.preferences.watchedSidebarExpanded
                    ? "is-expanded"
                    : ""
                }
                size={14}
              />
            </button>
            {snapshot.preferences.watchedSidebarExpanded && (
              <div className="sidebar-watched__content">
                {snapshot.trackedSessions.length === 0 ? (
                  <span className="sidebar-watched__empty">
                    {copy.app.noWatched}
                  </span>
                ) : (
                  sidebarGroups.map((group) => (
                    <div
                      className="sidebar-watched__group"
                      key={group.name}
                    >
                      {snapshot.preferences.groupTrackedByProject && (
                        <small>{group.name}</small>
                      )}
                      {group.sessions.map((session) => (
                        <button
                          type="button"
                          key={session.id}
                          title={session.title}
                          onClick={() => focusSession(session.id)}
                        >
                          <i
                            className={`legend-dot legend-dot--${session.status}`}
                          />
                          <span>{session.title}</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <div className="sidebar__spacer" />

          <section className="connections">
            <span className="sidebar-label">{copy.app.sources}</span>
            {(["codex", "claude"] as AgentKind[]).map((agent) => {
              const provider = snapshot.providers[agent];
              return (
                <div
                  className="connection"
                  key={agent}
                  title={localizeRuntimeText(
                    provider.detail,
                    snapshot.preferences.language
                  )}
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
                      {provider.available
                        ? copy.app.connected
                        : copy.app.unavailable}
                    </span>
                  </div>
                  <i className={provider.available ? "is-online" : ""} />
                </div>
              );
            })}
          </section>

          <div className="signal-legend">
            <span className="sidebar-label">{copy.app.signals}</span>
            {(["working", "attention", "idle"] as SessionStatus[]).map(
              (status) => (
                <div key={status}>
                  <i className={`legend-dot legend-dot--${status}`} />
                  <span>
                    <strong>
                      {statusLabel(status, snapshot.preferences.language)}
                    </strong>
                    <small>
                      {statusDescription(
                        status,
                        snapshot.preferences.language
                      )}
                    </small>
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
                {settingsView
                  ? copy.app.settingsEyebrow
                  : archiveView
                    ? copy.app.archiveEyebrow
                    : copy.app.dashboardEyebrow}
              </p>
              <h1>
                {settingsView
                  ? copy.app.settingsTitle
                  : archiveView
                    ? copy.app.archiveTitle
                    : copy.app.watchedTitle}
              </h1>
              <span>
                {settingsView
                  ? copy.app.settingsSubtitle
                  : archiveView
                    ? copy.app.archiveSubtitle
                    : copy.app.watchedSubtitle}
              </span>
            </div>
            <div className="page-header__actions">
              <button
                className="icon-button icon-button--bordered"
                type="button"
                title={copy.app.mobileDevices}
                aria-label={copy.app.mobileDevices}
                onClick={() => setMobileDevicesOpen(true)}
              >
                <Smartphone size={17} />
              </button>
              <button
                className="icon-button icon-button--bordered"
                type="button"
                title={
                  theme === "dark"
                    ? copy.app.lightTheme
                    : copy.app.darkTheme
                }
                aria-label={
                  theme === "dark"
                    ? copy.app.lightTheme
                    : copy.app.darkTheme
                }
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Sun size={17} />
                ) : (
                  <Moon size={17} />
                )}
              </button>
              {!settingsView && (
                <button
                  className="icon-button icon-button--bordered"
                  type="button"
                  title={copy.app.refresh}
                  aria-label={copy.app.refresh}
                  onClick={refresh}
                >
                  <RefreshCw
                    className={refreshing ? "is-spinning" : ""}
                    size={17}
                  />
                </button>
              )}
              {!archiveView && !settingsView && (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus size={16} />
                  {copy.app.addChat}
                </button>
              )}
            </div>
          </header>

          {settingsView ? (
            <SettingsView
              preferences={snapshot.preferences}
              onUpdate={(patch) => void updatePreferences(patch)}
            />
          ) : (
            <>
              {!archiveView && (
                <section className="status-summary">
                  <SummaryItem
                    status="working"
                    count={counts.working}
                    preferences={snapshot.preferences}
                  />
                  <SummaryItem
                    status="attention"
                    count={counts.attention}
                    preferences={snapshot.preferences}
                  />
                  <SummaryItem
                    status="idle"
                    count={counts.idle}
                    preferences={snapshot.preferences}
                  />
                </section>
              )}

              <div
                className={`list-toolbar ${
                  archiveView ? "list-toolbar--archive" : ""
                }`}
              >
                <label className="search-input search-input--page">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      archiveView
                        ? copy.app.searchArchive
                        : copy.app.searchWatched
                    }
                  />
                </label>
                <span>
                  {archiveView
                    ? countLabel(
                        visibleArchivedSessions.length,
                        "archive",
                        snapshot.preferences.language
                      )
                    : countLabel(
                        visibleSessions.length,
                        "chat",
                        snapshot.preferences.language
                      )}
                </span>
              </div>

              {archiveView ? (
                <ArchiveList
                  sessions={visibleArchivedSessions}
                  hasAny={snapshot.archivedSessions.length > 0}
                  now={now}
                  language={snapshot.preferences.language}
                  copy={copy}
                  onRestore={restoreSession}
                  onDelete={deleteArchivedSession}
                />
              ) : visibleSessions.length > 0 ? (
                <div className="project-groups">
                  {visibleGroups.map((group) => (
                    <section
                      className="project-group"
                      key={group.name}
                    >
                      {snapshot.preferences.groupTrackedByProject && (
                        <header className="project-group__header">
                          <div>
                            <span className="project-group__icon">
                              {group.name.slice(0, 1).toUpperCase()}
                            </span>
                            <strong>{group.name}</strong>
                          </div>
                          <span>{group.sessions.length}</span>
                        </header>
                      )}
                      <div className="chat-list">
                        <div className="chat-list__header">
                          <span>{copy.app.chatColumn}</span>
                          <span>{copy.app.statusColumn}</span>
                          <span>{copy.app.activityColumn}</span>
                        </div>
                        {group.sessions.map((session) => (
                          <TrackedChatRow
                            key={session.id}
                            session={session}
                            now={now}
                            preferences={snapshot.preferences}
                            onArchive={archiveSession}
                            onOpen={openSession}
                            onTogglePin={togglePin}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="chat-list">
                  <div className="empty-state">
                    <span className="empty-state__icon">
                      <SlidersHorizontal size={22} />
                    </span>
                    <h2>
                      {snapshot.trackedSessions.length === 0
                        ? copy.app.watchedEmpty
                        : copy.app.watchedNoMatches}
                    </h2>
                    <p>
                      {snapshot.trackedSessions.length === 0
                        ? copy.app.watchedEmptyDescription
                        : copy.app.changeFilter}
                    </p>
                    {snapshot.trackedSessions.length === 0 && (
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => setPickerOpen(true)}
                      >
                        <Plus size={15} />
                        {copy.app.chooseChats}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {isDemoMode && (
            <span className="demo-badge">{copy.app.previewMode}</span>
          )}
        </main>
      </div>

      <ChatPickerModal
        open={pickerOpen}
        sessions={snapshot.availableSessions}
        providers={snapshot.providers}
        preferences={snapshot.preferences}
        onClose={() => setPickerOpen(false)}
        onAdd={addSessions}
      />

      <MobileDevicesModal
        open={mobileDevicesOpen}
        language={snapshot.preferences.language}
        onClose={() => setMobileDevicesOpen(false)}
      />

      {promptedSession && (
        <NewSessionPrompt
          session={promptedSession}
          language={snapshot.preferences.language}
          onObserve={observePromptedSession}
          onDismiss={dismissPrompt}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  count: number;
  label: string;
  icon?: React.ReactNode;
  dot?: SessionStatus;
  hideCount?: boolean;
  onClick(): void;
}

function NavButton({
  active,
  count,
  label,
  icon,
  dot,
  hideCount = false,
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
      {!hideCount && <em>{count}</em>}
    </button>
  );
}

function SummaryItem({
  status,
  count,
  preferences
}: {
  status: SessionStatus;
  count: number;
  preferences: AppPreferences;
}) {
  return (
    <div>
      <i className={`summary-dot summary-dot--${status}`} />
      <span>
        <strong>{count}</strong>
        <small>{statusLabel(status, preferences.language)}</small>
      </span>
    </div>
  );
}

function ArchiveList({
  sessions,
  hasAny,
  now,
  language,
  copy,
  onRestore,
  onDelete
}: {
  sessions: AppSnapshot["archivedSessions"];
  hasAny: boolean;
  now: Date;
  language: AppPreferences["language"];
  copy: ReturnType<typeof copyFor>;
  onRestore(sessionId: string): void;
  onDelete(sessionId: string): void;
}) {
  return (
    <section className="chat-list">
      {sessions.length > 0 ? (
        <>
          <div className="chat-list__header archive-list__header">
            <span>{copy.app.chatColumn}</span>
            <span>{copy.app.archivedColumn}</span>
            <span>{copy.app.actionsColumn}</span>
          </div>
          {sessions.map((session) => (
            <ArchivedChatRow
              key={session.id}
              session={session}
              now={now}
              language={language}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))}
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-state__icon">
            <Archive size={22} />
          </span>
          <h2>
            {hasAny ? copy.app.archiveNoMatches : copy.app.archiveEmpty}
          </h2>
          <p>
            {hasAny
              ? copy.app.changeSearch
              : copy.app.archiveEmptyDescription}
          </p>
        </div>
      )}
    </section>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="toast"
      role="alert"
    >
      <AlertCircle size={17} />
      {message}
    </div>
  );
}

function compareSessions(left: TrackedSession, right: TrackedSession): number {
  const pinDifference =
    Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
  if (pinDifference !== 0) return pinDifference;
  const statusDifference =
    SIGNAL_ORDER.indexOf(left.status) - SIGNAL_ORDER.indexOf(right.status);
  if (statusDifference !== 0) return statusDifference;
  return (
    new Date(right.updatedAt).getTime() -
    new Date(left.updatedAt).getTime()
  );
}

function groupSessions(
  sessions: TrackedSession[],
  grouped: boolean,
  noProjectLabel: string
): Array<{ name: string; sessions: TrackedSession[] }> {
  if (!grouped) return [{ name: "all", sessions }];
  const groups = new Map<string, TrackedSession[]>();
  for (const session of sessions) {
    const name = session.projectName || noProjectLabel;
    groups.set(name, [...(groups.get(name) ?? []), session]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, entries]) => ({ name, sessions: entries }));
}

function countLabel(
  count: number,
  kind: "chat" | "archive",
  language: AppPreferences["language"]
): string {
  if (language === "en") {
    return `${count} ${
      kind === "chat"
        ? count === 1
          ? "chat"
          : "chats"
        : count === 1
          ? "entry"
          : "entries"
    }`;
  }
  if (kind === "chat") return `${count} ${count === 1 ? "czat" : "czatów"}`;
  return `${count} ${count === 1 ? "wpis" : "wpisów"}`;
}

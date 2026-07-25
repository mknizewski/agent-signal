import {
  Moon,
  RefreshCw,
  Sun
} from "lucide-react";
import type {
  AgentKind,
  AppPreferences,
  SessionStatus,
  TrackedSession
} from "../shared/types";
import { formatRelativeTime, statusLabel } from "../shared/status";
import { isSessionSleeping } from "../shared/preferences";
import { copyFor } from "../lib/i18n";
import { StatusPet } from "./StatusPet";

type SignalCounts = Record<SessionStatus, number>;

interface CompactDashboardProps {
  counts: SignalCounts;
  sessions: TrackedSession[];
  theme: "light" | "dark";
  refreshing: boolean;
  updatedAt: string;
  now: Date;
  preferences: AppPreferences;
  onRefresh(): void;
  onThemeToggle(): void;
}

const signalStatuses: SessionStatus[] = [
  "working",
  "attention",
  "idle"
];

export function CompactDashboard({
  counts,
  sessions,
  theme,
  refreshing,
  updatedAt,
  now,
  preferences,
  onRefresh,
  onThemeToggle
}: CompactDashboardProps) {
  const copy = copyFor(preferences.language);
  const headline = compactHeadline(
    counts,
    sessions.length,
    preferences.language
  );

  return (
    <div className="compact-shell">
      <header className="compact-header">
        <div className="brand brand--compact">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <strong>Agent Signal</strong>
        </div>
        <div className="compact-header__actions">
          <button
            className="icon-button"
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
            onClick={onThemeToggle}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className="icon-button"
            type="button"
            title={copy.app.refresh}
            aria-label={copy.app.refresh}
            onClick={onRefresh}
          >
            <RefreshCw
              className={refreshing ? "is-spinning" : ""}
              size={15}
            />
          </button>
        </div>
      </header>

      <main className="compact-dashboard">
        <div className="compact-title">
          <p className="eyebrow">{copy.compact.eyebrow}</p>
          <h1>{headline}</h1>
          <span>
            {sessions.length}{" "}
            {sessions.length === 1
              ? copy.compact.trackedOne
              : copy.compact.trackedMany}
          </span>
        </div>

        <section
          className="compact-traffic"
          aria-label={copy.compact.trafficLabel}
        >
          <div className="traffic-housing">
            {signalStatuses.map((status) => (
              <div
                className={`traffic-light traffic-light--${status} ${
                  counts[status] > 0 ? "is-active" : ""
                }`}
                key={status}
              >
                <strong>{counts[status]}</strong>
              </div>
            ))}
          </div>

          <div className="traffic-summary">
            {signalStatuses.map((status) => (
              <div key={status}>
                <i className={`summary-dot summary-dot--${status}`} />
                <span>
                    <strong>
                      {statusLabel(status, preferences.language)}
                    </strong>
                    <small>
                      {compactStatusText(
                        status,
                        counts[status],
                        preferences.language
                      )}
                    </small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="compact-agents">
          {(["codex", "claude"] as AgentKind[]).map((agent) => {
            const agentSessions = sessions.filter(
              (session) => session.agent === agent
            );
            const status = aggregateAgentStatus(agentSessions);
            const summary = compactAgentSummary(
              agentSessions,
              preferences.language
            );
            const subagents = agentSessions.flatMap(
              (session) => session.subagents
            );
            const activeSubagents = subagents.filter((subagent) =>
              ["working", "attention"].includes(subagent.status)
            ).length;
            const manager =
              agent === "codex" &&
              preferences.showSubagentTeams &&
              subagents.length > 0;
            const visibleSummary =
              manager && activeSubagents > 0
                ? `${summary} · ${copy.subagents.summary(
                    activeSubagents,
                    subagents.length
                  )}`
                : summary;
            const sleeping =
              agentSessions.length > 0 &&
              agentSessions.every((session) =>
                isSessionSleeping(
                  session.status,
                  session.updatedAt,
                  now,
                  preferences
                )
              );
            return (
              <div
                className={`compact-agent compact-agent--${status}`}
                key={agent}
              >
                <StatusPet
                  agent={agent}
                  status={status}
                  size="large"
                  sleeping={sleeping}
                  manager={manager}
                  language={preferences.language}
                />
                <span>
                  <strong>{agent === "codex" ? "Codex" : "Claude"}</strong>
                  <small title={visibleSummary}>{visibleSummary}</small>
                </span>
              </div>
            );
          })}
        </section>

        {(counts.error > 0 || counts.unavailable > 0) && (
          <p className="compact-unknown">
            {copy.compact.unknownSession(
              counts.error + counts.unavailable
            )}
          </p>
        )}

        <footer className="compact-footer">
          {copy.compact.lastSync}{" "}
          {formatRelativeTime(
            updatedAt,
            now,
            preferences.language
          )}
        </footer>
      </main>
    </div>
  );
}

export function compactAgentSummary(
  sessions: TrackedSession[],
  language: AppPreferences["language"] = "pl"
): string {
  const copy = copyFor(language);
  if (sessions.length === 0) return copy.compact.noChats;

  const counts = sessions.reduce<Record<SessionStatus, number>>(
    (result, session) => {
      result[session.status] += 1;
      return result;
    },
    {
      working: 0,
      attention: 0,
      idle: 0,
      error: 0,
      unavailable: 0
    }
  );
  const parts: string[] = [];
  if (counts.attention > 0) {
    parts.push(
      copy.compact.requiresAttention(counts.attention)
    );
  }
  if (counts.working > 0) {
    parts.push(
      copy.compact.isWorking(counts.working)
    );
  }
  if (counts.idle > 0) {
    parts.push(copy.compact.isIdle(counts.idle));
  }
  const unknownCount = counts.error + counts.unavailable;
  if (unknownCount > 0) {
    parts.push(copy.compact.unknown(unknownCount));
  }
  return parts.join(" · ");
}

function aggregateAgentStatus(
  sessions: TrackedSession[]
): SessionStatus {
  const priority: SessionStatus[] = [
    "attention",
    "working",
    "error",
    "idle",
    "unavailable"
  ];
  return (
    priority.find((status) =>
      sessions.some((session) => session.status === status)
    ) ?? "unavailable"
  );
}

function compactHeadline(
  counts: SignalCounts,
  sessionCount: number,
  language: AppPreferences["language"]
): string {
  const copy = copyFor(language);
  if (sessionCount === 0) return copy.compact.noTracked;
  if (counts.attention > 0) return copy.compact.attention;
  if (counts.working > 0) return copy.compact.working;
  if (counts.idle === sessionCount) return copy.compact.allIdle;
  return copy.compact.partial;
}

function compactStatusText(
  status: SessionStatus,
  count: number,
  language: AppPreferences["language"]
): string {
  const copy = copyFor(language);
  if (count === 0) return copy.compact.none;
  if (status === "working") return copy.compact.inProgress(count);
  if (status === "attention") return copy.compact.waiting(count);
  return copy.compact.inactive(count);
}

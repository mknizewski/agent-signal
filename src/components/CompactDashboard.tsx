import {
  Moon,
  RefreshCw,
  Sun
} from "lucide-react";
import type {
  AgentKind,
  SessionStatus,
  TrackedSession
} from "../shared/types";
import { formatRelativeTime, statusLabel } from "../shared/status";
import { StatusPet } from "./StatusPet";

type SignalCounts = Record<SessionStatus, number>;

interface CompactDashboardProps {
  counts: SignalCounts;
  sessions: TrackedSession[];
  theme: "light" | "dark";
  refreshing: boolean;
  updatedAt: string;
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
  onRefresh,
  onThemeToggle
}: CompactDashboardProps) {
  const headline = compactHeadline(counts, sessions.length);

  return (
    <div className="compact-shell">
      <header className="compact-header">
        <div className="brand brand--compact">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <strong>AgentSignal</strong>
        </div>
        <div className="compact-header__actions">
          <button
            className="icon-button"
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
            onClick={onThemeToggle}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className="icon-button"
            type="button"
            title="Odśwież sesje"
            aria-label="Odśwież sesje"
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
          <p className="eyebrow">Tryb kompaktowy</p>
          <h1>{headline}</h1>
          <span>
            {sessions.length}{" "}
            {sessions.length === 1 ? "obserwowany czat" : "obserwowane czaty"}
          </span>
        </div>

        <section
          className="compact-traffic"
          aria-label="Zagregowana sygnalizacja czatów"
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
                  <strong>{statusLabel(status)}</strong>
                  <small>{compactStatusText(status, counts[status])}</small>
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
            const summary = compactAgentSummary(agentSessions);
            return (
              <div
                className={`compact-agent compact-agent--${status}`}
                key={agent}
              >
                <StatusPet
                  agent={agent}
                  status={status}
                  size="large"
                />
                <span>
                  <strong>{agent === "codex" ? "Codex" : "Claude"}</strong>
                  <small title={summary}>{summary}</small>
                </span>
              </div>
            );
          })}
        </section>

        {(counts.error > 0 || counts.unavailable > 0) && (
          <p className="compact-unknown">
            {counts.error + counts.unavailable}{" "}
            {counts.error + counts.unavailable === 1
              ? "sesja bez potwierdzonego stanu"
              : "sesje bez potwierdzonego stanu"}
          </p>
        )}

        <footer className="compact-footer">
          Ostatnia synchronizacja {formatRelativeTime(updatedAt)}
        </footer>
      </main>
    </div>
  );
}

export function compactAgentSummary(sessions: TrackedSession[]): string {
  if (sessions.length === 0) return "Brak czatów";

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
      `${counts.attention} ${
        counts.attention === 1 ? "wymaga uwagi" : "wymagają uwagi"
      }`
    );
  }
  if (counts.working > 0) {
    parts.push(
      `${counts.working} ${counts.working === 1 ? "pracuje" : "pracują"}`
    );
  }
  if (counts.idle > 0) {
    parts.push(`${counts.idle} ${counts.idle === 1 ? "wolny" : "wolne"}`);
  }
  const unknownCount = counts.error + counts.unavailable;
  if (unknownCount > 0) {
    parts.push(`${unknownCount} bez potwierdzonego stanu`);
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
  sessionCount: number
): string {
  if (sessionCount === 0) return "Brak obserwowanych";
  if (counts.attention > 0) return "Potrzebna uwaga";
  if (counts.working > 0) return "Agenci pracują";
  if (counts.idle === sessionCount) return "Wszystkie wolne";
  return "Stan częściowo nieznany";
}

function compactStatusText(
  status: SessionStatus,
  count: number
): string {
  if (count === 0) return "Brak";
  if (status === "working") return `${count} w trakcie pracy`;
  if (status === "attention") return `${count} czeka na Ciebie`;
  return `${count} bez aktywnej pracy`;
}

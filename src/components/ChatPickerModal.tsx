import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type {
  AgentKind,
  AppPreferences,
  DiscoveredSession,
  ProjectGroupConfig,
  ProviderStatus
} from "../shared/types";
import { formatRelativeTime } from "../shared/status";
import { groupSessionsByProject } from "../shared/project-groups";
import { copyFor } from "../lib/i18n";
import { AgentMark } from "./AgentMark";

type SourceFilter = "all" | AgentKind;

interface ChatPickerModalProps {
  open: boolean;
  sessions: DiscoveredSession[];
  providers: Record<AgentKind, ProviderStatus>;
  preferences: AppPreferences;
  projectGroups: ProjectGroupConfig[];
  onClose(): void;
  onAdd(sessionIds: string[]): Promise<void>;
}

export function ChatPickerModal({
  open,
  sessions,
  providers,
  preferences,
  projectGroups,
  onClose,
  onAdd
}: ChatPickerModalProps) {
  const copy = copyFor(preferences.language);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSource("all");
    setSelected(new Set());
    setError("");
  }, [open]);

  const visibleSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (source !== "all" && session.agent !== source) return false;
      if (!normalized) return true;
      return [
        session.title,
        session.summary,
        session.workingDirectory,
        session.agent
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, sessions, source]);
  const sessionGroups = useMemo(
    () =>
      groupSessionsByProject(
        visibleSessions,
        preferences.groupPickerByProject,
        copy.common.noProject,
        projectGroups
      ),
    [
      copy.common.noProject,
      preferences.groupPickerByProject,
      projectGroups,
      visibleSessions
    ]
  );

  if (!open) return null;

  const toggle = (sessionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onAdd([...selected]);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="chat-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-picker-title"
      >
        <header className="chat-picker__header">
          <div>
            <h2 id="chat-picker-title">{copy.picker.title}</h2>
            <p>{copy.picker.subtitle}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={copy.common.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="chat-picker__tools">
          <label className="search-input">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.picker.search}
            />
          </label>
          <div className="source-tabs">
            <button
              className={source === "all" ? "is-active" : ""}
              type="button"
              onClick={() => setSource("all")}
            >
              {copy.picker.all}
            </button>
            <button
              className={source === "codex" ? "is-active" : ""}
              type="button"
              disabled={!providers.codex.available}
              onClick={() => setSource("codex")}
            >
              {copy.common.codex}
            </button>
            <button
              className={source === "claude" ? "is-active" : ""}
              type="button"
              disabled={!providers.claude.available}
              onClick={() => setSource("claude")}
            >
              {copy.common.claude}
            </button>
          </div>
        </div>

        <div className="session-picker-list">
          {visibleSessions.length > 0 ? (
            sessionGroups.map((group) => (
              <section
                className="session-project-group"
                key={group.key}
              >
                {preferences.groupPickerByProject && (
                  <header
                    style={
                      {
                        "--project-color": group.color
                      } as CSSProperties
                    }
                  >
                    <span className="session-project-group__icon">
                      {group.symbol}
                    </span>
                    <strong>{group.name}</strong>
                    <span>{group.sessions.length}</span>
                  </header>
                )}
                {group.sessions.map((session) => {
                  const isSelected = selected.has(session.id);
                  return (
                    <button
                      className={`session-option ${
                        isSelected ? "is-selected" : ""
                      }`}
                      type="button"
                      key={session.id}
                      onClick={() => toggle(session.id)}
                    >
                      <span className="session-option__check">
                        {isSelected && (
                          <Check
                            size={13}
                            strokeWidth={2.4}
                          />
                        )}
                      </span>
                      <AgentMark agent={session.agent} />
                      <span className="session-option__content">
                        <strong>{session.title}</strong>
                        <small>
                          {session.workingDirectory || session.summary}
                        </small>
                      </span>
                      <time>
                        {formatRelativeTime(
                          session.updatedAt,
                          new Date(),
                          preferences.language
                        )}
                      </time>
                    </button>
                  );
                })}
              </section>
            ))
          ) : (
            <div className="picker-empty">
              <p>{copy.picker.empty}</p>
              <span>{copy.picker.emptyDescription}</span>
            </div>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        <footer className="chat-picker__footer">
          <span>
            {selected.size === 0
              ? copy.picker.available(sessions.length)
              : copy.picker.selected(selected.size)}
          </span>
          <div>
            <button
              className="button button--secondary"
              type="button"
              onClick={onClose}
            >
              {copy.common.cancel}
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={busy || selected.size === 0}
              onClick={submit}
            >
              <Plus size={15} />
              {busy ? copy.picker.adding : copy.picker.addSelected}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

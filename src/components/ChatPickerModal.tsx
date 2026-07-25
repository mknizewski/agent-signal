import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type {
  AgentKind,
  DiscoveredSession,
  ProviderStatus
} from "../shared/types";
import { formatRelativeTime } from "../shared/status";
import { AgentMark } from "./AgentMark";

type SourceFilter = "all" | AgentKind;

interface ChatPickerModalProps {
  open: boolean;
  sessions: DiscoveredSession[];
  providers: Record<AgentKind, ProviderStatus>;
  onClose(): void;
  onAdd(sessionIds: string[]): Promise<void>;
}

export function ChatPickerModal({
  open,
  sessions,
  providers,
  onClose,
  onAdd
}: ChatPickerModalProps) {
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
            <h2 id="chat-picker-title">Dodaj czaty</h2>
            <p>Wybierz istniejące sesje, które chcesz obserwować.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Zamknij"
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
              placeholder="Szukaj po tytule lub projekcie"
            />
          </label>
          <div className="source-tabs">
            <button
              className={source === "all" ? "is-active" : ""}
              type="button"
              onClick={() => setSource("all")}
            >
              Wszystkie
            </button>
            <button
              className={source === "codex" ? "is-active" : ""}
              type="button"
              disabled={!providers.codex.available}
              onClick={() => setSource("codex")}
            >
              Codex
            </button>
            <button
              className={source === "claude" ? "is-active" : ""}
              type="button"
              disabled={!providers.claude.available}
              onClick={() => setSource("claude")}
            >
              Claude Code
            </button>
          </div>
        </div>

        <div className="session-picker-list">
          {visibleSessions.length > 0 ? (
            visibleSessions.map((session) => {
              const isSelected = selected.has(session.id);
              return (
                <button
                  className={`session-option ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  key={session.id}
                  onClick={() => toggle(session.id)}
                >
                  <span className="session-option__check">
                    {isSelected && <Check size={13} strokeWidth={2.4} />}
                  </span>
                  <AgentMark agent={session.agent} />
                  <span className="session-option__content">
                    <strong>{session.title}</strong>
                    <small>
                      {session.workingDirectory || session.summary}
                    </small>
                  </span>
                  <time>{formatRelativeTime(session.updatedAt)}</time>
                </button>
              );
            })
          ) : (
            <div className="picker-empty">
              <p>Brak nowych czatów do dodania.</p>
              <span>
                Uruchom sesję w Codex lub Claude Code, a następnie odśwież
                dashboard.
              </span>
            </div>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        <footer className="chat-picker__footer">
          <span>
            {selected.size === 0
              ? `${sessions.length} dostępnych`
              : `Wybrano: ${selected.size}`}
          </span>
          <div>
            <button
              className="button button--secondary"
              type="button"
              onClick={onClose}
            >
              Anuluj
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={busy || selected.size === 0}
              onClick={submit}
            >
              <Plus size={15} />
              {busy ? "Dodawanie…" : "Dodaj wybrane"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

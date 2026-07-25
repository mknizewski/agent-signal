import { X } from "lucide-react";
import type { TrackedSession } from "../shared/types";
import { formatRelativeTime, statusLabel } from "../shared/status";
import { StatusPet } from "./StatusPet";

interface TrackedChatRowProps {
  session: TrackedSession;
  now: Date;
  onRemove(sessionId: string): void;
}

export function TrackedChatRow({
  session,
  now,
  onRemove
}: TrackedChatRowProps) {
  return (
    <article className="chat-row">
      <div
        className={`status-light status-light--${session.status}`}
        title={session.statusText}
        aria-label={statusLabel(session.status)}
      />

      <StatusPet
        agent={session.agent}
        status={session.status}
      />

      <div className="chat-row__identity">
        <div className="chat-row__title">
          <strong>{session.title}</strong>
          <span>{sourceLabel(session.agent)}</span>
        </div>
        <p>
          {session.workingDirectory
            ? compactPath(session.workingDirectory)
            : session.summary}
        </p>
      </div>

      <div className={`chat-row__status chat-row__status--${session.status}`}>
        <strong>{statusLabel(session.status)}</strong>
        <span>{session.statusText}</span>
      </div>

      <time dateTime={session.updatedAt}>
        {formatRelativeTime(session.updatedAt, now)}
      </time>

      <button
        className="row-action"
        type="button"
        title="Przestań obserwować"
        aria-label={`Przestań obserwować: ${session.title}`}
        onClick={() => onRemove(session.id)}
      >
        <X size={16} />
      </button>
    </article>
  );
}

function sourceLabel(agent: TrackedSession["agent"]): string {
  return agent === "codex" ? "Codex" : "Claude Code";
}

function compactPath(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  if (segments.length <= 3) return value;
  return `…/${segments.slice(-2).join("/")}`;
}

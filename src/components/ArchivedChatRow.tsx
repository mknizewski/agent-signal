import { RotateCcw, Trash2 } from "lucide-react";
import type { ArchivedSessionRecord } from "../shared/types";
import { formatRelativeTime } from "../shared/status";
import { AgentMark } from "./AgentMark";

interface ArchivedChatRowProps {
  session: ArchivedSessionRecord;
  now: Date;
  onRestore(sessionId: string): void;
  onDelete(sessionId: string): void;
}

export function ArchivedChatRow({
  session,
  now,
  onRestore,
  onDelete
}: ArchivedChatRowProps) {
  return (
    <article className="chat-row archive-row">
      <AgentMark agent={session.agent} />

      <div className="chat-row__identity">
        <div className="chat-row__title">
          <strong>{session.title}</strong>
          <span>{session.agent === "codex" ? "Codex" : "Claude Code"}</span>
        </div>
        <p>
          {session.workingDirectory
            ? compactPath(session.workingDirectory)
            : session.summary}
        </p>
      </div>

      <div className="archive-row__date">
        <strong>Zarchiwizowano</strong>
        <time dateTime={session.archivedAt}>
          {formatRelativeTime(session.archivedAt, now)}
        </time>
      </div>

      <div className="archive-row__actions">
        <button
          className="row-action"
          type="button"
          title="Przywróć do obserwowanych"
          aria-label={`Przywróć do obserwowanych: ${session.title}`}
          onClick={() => onRestore(session.id)}
        >
          <RotateCcw size={15} />
        </button>
        <button
          className="row-action row-action--danger"
          type="button"
          title="Usuń z archiwum"
          aria-label={`Usuń z archiwum: ${session.title}`}
          onClick={() => onDelete(session.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function compactPath(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  if (segments.length <= 3) return value;
  return `…/${segments.slice(-2).join("/")}`;
}

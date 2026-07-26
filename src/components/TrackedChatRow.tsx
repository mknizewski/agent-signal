import {
  Archive,
  ExternalLink,
  GripVertical,
  Pin,
  PinOff
} from "lucide-react";
import type {
  AppPreferences,
  TrackedSession
} from "../shared/types";
import { formatRelativeTime, statusLabel } from "../shared/status";
import { isSessionSleeping } from "../shared/preferences";
import { CHAT_SESSION_DRAG_TYPE } from "../shared/project-groups";
import { copyFor, localizeRuntimeText } from "../lib/i18n";
import { ChatGroupMenu } from "./ChatGroupMenu";
import { StatusPet } from "./StatusPet";
import { SubagentTeamPanel } from "./SubagentTeamPanel";

interface TrackedChatRowProps {
  session: TrackedSession;
  now: Date;
  preferences: AppPreferences;
  onArchive(sessionId: string): void;
  onOpen(sessionId: string): void;
  onOpenSubagent(threadId: string): void;
  onTogglePin(sessionId: string, pinned: boolean): void;
  projectGroups: Array<{
    key: string;
    name: string;
    symbol: string;
    color: string;
  }>;
  onAssignGroup(sessionId: string, groupOverride: string | null): void;
  dragging: boolean;
  onDragStart(sessionId: string): void;
  onDragEnd(): void;
}

export function TrackedChatRow({
  session,
  now,
  preferences,
  onArchive,
  onOpen,
  onOpenSubagent,
  onTogglePin,
  projectGroups,
  onAssignGroup,
  dragging,
  onDragStart,
  onDragEnd
}: TrackedChatRowProps) {
  const copy = copyFor(preferences.language);
  const sleeping = isSessionSleeping(
    session.status,
    session.updatedAt,
    now,
    preferences
  );
  const visibleSubagents = preferences.showSubagentTeams
    ? session.subagents
    : [];

  return (
    <article
      id={`session-${session.id}`}
      className={`chat-row ${session.pinned ? "chat-row--pinned" : ""} ${
        visibleSubagents.length > 0 ? "chat-row--has-team" : ""
      } ${dragging ? "is-dragging" : ""}`}
      draggable={preferences.groupTrackedByProject}
      onDragStart={(event) => {
        const actionButton = (event.target as HTMLElement).closest("button");
        if (
          actionButton &&
          !actionButton.classList.contains("chat-row__drag")
        ) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(CHAT_SESSION_DRAG_TYPE, session.id);
        event.dataTransfer.setData("text/plain", session.id);
        event.dataTransfer.setDragImage(event.currentTarget, 48, 28);
        onDragStart(session.id);
      }}
      onDragEnd={onDragEnd}
      onDoubleClick={(event) => {
        if (
          preferences.openChatOnDoubleClick &&
          !(event.target as HTMLElement).closest("button, select")
        ) {
          onOpen(session.id);
        }
      }}
    >
      {preferences.groupTrackedByProject ? (
        <button
          className="chat-row__drag"
          type="button"
          draggable
          title={copy.row.dragToGroup}
          aria-label={`${copy.row.dragToGroup}: ${session.title}`}
        >
          <span
            className={`status-light status-light--${session.status}`}
            title={session.statusText}
            aria-hidden="true"
          />
          <GripVertical size={13} />
        </button>
      ) : (
        <div
          className={`status-light status-light--${session.status}`}
          title={session.statusText}
          aria-label={statusLabel(session.status, preferences.language)}
        />
      )}

      <StatusPet
        agent={session.agent}
        status={session.status}
        sleeping={sleeping}
        language={preferences.language}
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
        <strong>{statusLabel(session.status, preferences.language)}</strong>
        <span>
          {localizeRuntimeText(session.statusText, preferences.language)}
        </span>
      </div>

      <time dateTime={session.updatedAt}>
        {formatRelativeTime(
          session.updatedAt,
          now,
          preferences.language
        )}
      </time>

      <div className="chat-row__actions">
        {preferences.groupTrackedByProject && (
          <ChatGroupMenu
            session={session}
            language={preferences.language}
            projectGroups={projectGroups}
            onAssign={(groupOverride) =>
              onAssignGroup(session.id, groupOverride)
            }
          />
        )}
        {preferences.enablePinning && (
          <button
            className={`row-action ${session.pinned ? "is-active" : ""}`}
            type="button"
            title={session.pinned ? copy.row.unpin : copy.row.pin}
            aria-label={`${session.pinned ? copy.row.unpin : copy.row.pin}: ${
              session.title
            }`}
            onClick={() => onTogglePin(session.id, !session.pinned)}
          >
            {session.pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        )}
        <button
          className="row-action"
          type="button"
          title={copy.row.open}
          aria-label={`${copy.row.open}: ${session.title}`}
          onClick={() => onOpen(session.id)}
        >
          <ExternalLink size={15} />
        </button>
        <button
          className="row-action"
          type="button"
          title={copy.row.archive}
          aria-label={`${copy.row.archive}: ${session.title}`}
          onClick={() => onArchive(session.id)}
        >
          <Archive size={15} />
        </button>
      </div>

      {visibleSubagents.length > 0 && (
        <SubagentTeamPanel
          subagents={visibleSubagents}
          language={preferences.language}
          onOpen={onOpenSubagent}
        />
      )}
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

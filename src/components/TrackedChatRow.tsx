import {
  Archive,
  Check,
  ExternalLink,
  GripVertical,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  onRename(sessionId: string, titleOverride: string | null): void;
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
  onRename,
  projectGroups,
  onAssignGroup,
  dragging,
  onDragStart,
  onDragEnd
}: TrackedChatRowProps) {
  const copy = copyFor(preferences.language);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(session.title);
  useEffect(() => {
    if (!editingTitle) setTitleValue(session.title);
  }, [editingTitle, session.title]);
  useEffect(() => {
    if (!editingTitle) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingTitle]);
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
          !(event.target as HTMLElement).closest("button, input, select, form")
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
        {editingTitle ? (
          <form
            className="chat-row__rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = titleValue.trim();
              onRename(session.id, normalized || null);
              setEditingTitle(false);
            }}
          >
            <input
              ref={renameInputRef}
              value={titleValue}
              maxLength={120}
              aria-label={copy.row.renameLabel}
              placeholder={copy.row.renamePlaceholder}
              onChange={(event) => setTitleValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setTitleValue(session.title);
                setEditingTitle(false);
              }}
            />
            <button type="submit" title={copy.row.saveName}>
              <Check size={13} />
            </button>
            <button
              type="button"
              title={copy.row.resetName}
              onClick={() => {
                onRename(session.id, null);
                setEditingTitle(false);
              }}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              title={copy.common.cancel}
              onClick={() => {
                setTitleValue(session.title);
                setEditingTitle(false);
              }}
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <div className="chat-row__title">
            <strong>{session.title}</strong>
            <span>{sourceLabel(session.agent)}</span>
            <button
              className={`chat-row__rename ${
                session.titleOverride ? "is-active" : ""
              }`}
              type="button"
              title={copy.row.rename}
              aria-label={`${copy.row.rename}: ${session.title}`}
              onClick={() => {
                setTitleValue(session.title);
                setEditingTitle(true);
              }}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
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
          agent={session.agent}
          language={preferences.language}
          onOpen={(threadId) => {
            if (session.agent === "codex") onOpenSubagent(threadId);
            else onOpen(session.id);
          }}
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

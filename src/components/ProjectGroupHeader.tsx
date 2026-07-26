import {
  useEffect,
  useState,
  type CSSProperties
} from "react";
import {
  ChevronDown,
  GripVertical,
  Pencil,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import type {
  AppLanguage,
  UpdateProjectGroupInput
} from "../shared/types";
import type { ProjectGroupPresentation } from "../shared/project-groups";
import { copyFor } from "../lib/i18n";

interface ProjectGroupHeaderProps {
  group: ProjectGroupPresentation;
  count: number;
  totalCount: number;
  language: AppLanguage;
  draggable: boolean;
  dragging: boolean;
  dropPosition: "before" | "after" | null;
  onUpdate(input: UpdateProjectGroupInput): Promise<void>;
  onDragStart(projectKey: string): void;
  onDragHover(
    projectKey: string,
    position: "before" | "after"
  ): void;
  onDragDrop(
    projectKey: string,
    position: "before" | "after"
  ): void;
  onMove(projectKey: string, direction: -1 | 1): void;
  onArchiveAll(projectKey: string): void;
  onDragCancel(): void;
}

export function ProjectGroupHeader({
  group,
  count,
  totalCount,
  language,
  draggable,
  dragging,
  dropPosition,
  onUpdate,
  onDragStart,
  onDragHover,
  onDragDrop,
  onMove,
  onArchiveAll,
  onDragCancel
}: ProjectGroupHeaderProps) {
  const copy = copyFor(language);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(group.name);
  const [symbol, setSymbol] = useState(group.symbol);
  const [color, setColor] = useState(group.color);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) return;
    setLabel(group.name);
    setSymbol(group.symbol);
    setColor(group.color);
  }, [editing, group.color, group.name, group.symbol]);

  const save = async () => {
    setBusy(true);
    try {
      await onUpdate({
        projectKey: group.key,
        label: label.trim(),
        symbol: [...symbol.trim()].slice(0, 2).join(""),
        color
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await onUpdate({
        projectKey: group.key,
        label: "",
        symbol: "",
        color: ""
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header
      className={`project-group__header ${
        dragging ? "is-dragging" : ""
      } ${dropPosition ? `is-drop-${dropPosition}` : ""} ${
        editing ? "is-editing" : ""
      }`}
      data-project-key={group.key}
      style={{ "--project-color": group.color } as CSSProperties}
      onDragOver={(event) => {
        if (!draggable) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        const position =
          event.clientY < bounds.top + bounds.height / 2
            ? "before"
            : "after";
        onDragHover(group.key, position);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const position =
          event.clientY < bounds.top + bounds.height / 2
            ? "before"
            : "after";
        onDragDrop(group.key, position);
      }}
    >
      <div className="project-group__identity">
        {draggable && (
          <button
            className="project-group__drag"
            type="button"
            draggable
            title={copy.groups.drag}
            aria-label={copy.groups.drag}
            aria-keyshortcuts="ArrowUp ArrowDown"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", group.key);
              const header = event.currentTarget.closest("header");
              if (header) event.dataTransfer.setDragImage(header, 24, 18);
              onDragStart(group.key);
            }}
            onDragEnd={onDragCancel}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                return;
              }
              event.preventDefault();
              onMove(group.key, event.key === "ArrowUp" ? -1 : 1);
            }}
          >
            <GripVertical size={15} />
          </button>
        )}
        <button
          className="project-group__collapse"
          type="button"
          title={group.collapsed ? copy.groups.expand : copy.groups.collapse}
          aria-label={`${group.collapsed ? copy.groups.expand : copy.groups.collapse}: ${group.name}`}
          aria-expanded={!group.collapsed}
          onClick={() =>
            void onUpdate({
              projectKey: group.key,
              collapsed: !group.collapsed
            })
          }
        >
          <ChevronDown
            className={group.collapsed ? "is-collapsed" : ""}
            size={15}
          />
        </button>
        <span className="project-group__icon">{group.symbol}</span>
        <strong>{group.name}</strong>
        <button
          className="project-group__edit"
          type="button"
          title={copy.groups.edit}
          aria-label={`${copy.groups.edit}: ${group.name}`}
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? <X size={14} /> : <Pencil size={13} />}
        </button>
        <button
          className="project-group__delete"
          type="button"
          title={copy.groups.archiveAll}
          aria-label={`${copy.groups.archiveAll}: ${group.name}`}
          disabled={busy || totalCount === 0}
          onClick={() => onArchiveAll(group.key)}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <span className="project-group__count">{count}</span>

      {editing && (
        <form
          className="project-group-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            <span>{copy.groups.name}</span>
            <input
              autoFocus
              maxLength={80}
              value={label}
              placeholder={copy.groups.namePlaceholder}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="project-group-editor__symbol">
            <span>{copy.groups.symbol}</span>
            <input
              maxLength={2}
              value={symbol}
              placeholder={copy.groups.symbolPlaceholder}
              onChange={(event) =>
                setSymbol([...event.target.value].slice(0, 2).join(""))
              }
            />
          </label>
          <label className="project-group-editor__color">
            <span>{copy.groups.color}</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <div className="project-group-editor__actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={busy}
              onClick={() => void reset()}
            >
              <RotateCcw size={13} />
              {copy.groups.reset}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              {copy.common.cancel}
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={busy || !label.trim() || !symbol.trim()}
            >
              {copy.groups.save}
            </button>
          </div>
        </form>
      )}
    </header>
  );
}

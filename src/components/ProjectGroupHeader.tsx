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
  language: AppLanguage;
  draggable: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onUpdate(input: UpdateProjectGroupInput): Promise<void>;
  onPointerStart(projectKey: string): void;
  onPointerHover(projectKey: string): void;
  onPointerDrop(projectKey: string): void;
  onPointerCancel(): void;
}

export function ProjectGroupHeader({
  group,
  count,
  language,
  draggable,
  dragging,
  dropTarget,
  onUpdate,
  onPointerStart,
  onPointerHover,
  onPointerDrop,
  onPointerCancel
}: ProjectGroupHeaderProps) {
  const copy = copyFor(language);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(group.name);
  const [symbol, setSymbol] = useState(group.symbol);
  const [color, setColor] = useState(group.color);
  const [busy, setBusy] = useState(false);

  const projectKeyAt = (clientX: number, clientY: number) =>
    document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-project-key]")?.dataset.projectKey;

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
      } ${dropTarget ? "is-drop-target" : ""} ${
        editing ? "is-editing" : ""
      }`}
      data-project-key={group.key}
      style={{ "--project-color": group.color } as CSSProperties}
      onPointerEnter={() => onPointerHover(group.key)}
      onPointerUp={() => onPointerDrop(group.key)}
    >
      <div className="project-group__identity">
        {draggable && (
          <span
            className="project-group__drag"
            title={copy.groups.drag}
            aria-label={copy.groups.drag}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              if (event.pointerType === "mouse") return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              onPointerStart(group.key);
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              onPointerStart(group.key);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                return;
              }
              const projectKey = projectKeyAt(event.clientX, event.clientY);
              if (projectKey) onPointerHover(projectKey);
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                onPointerCancel();
                return;
              }
              const projectKey =
                projectKeyAt(event.clientX, event.clientY) || group.key;
              event.currentTarget.releasePointerCapture(event.pointerId);
              onPointerDrop(projectKey);
            }}
            onPointerCancel={onPointerCancel}
          >
            <GripVertical size={15} />
          </span>
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

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  FolderInput,
  FolderMinus,
  RefreshCw
} from "lucide-react";
import type { AppLanguage, TrackedSession } from "../shared/types";
import { copyFor } from "../lib/i18n";

interface ChatGroupMenuProps {
  session: TrackedSession;
  language: AppLanguage;
  projectGroups: Array<{
    key: string;
    name: string;
    symbol: string;
    color: string;
  }>;
  onAssign(groupOverride: string | null): void;
}

interface MenuPosition {
  top: number;
  left: number;
  ready: boolean;
}

export function ChatGroupMenu({
  session,
  language,
  projectGroups,
  onAssign
}: ChatGroupMenuProps) {
  const copy = copyFor(language);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    ready: false
  });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const triggerBounds = triggerRef.current.getBoundingClientRect();
    const menuBounds = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      window.innerWidth - menuBounds.width - margin,
      Math.max(margin, triggerBounds.right - menuBounds.width)
    );
    const below = triggerBounds.bottom + 6;
    const top =
      below + menuBounds.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, triggerBounds.top - menuBounds.height - 6);
    setPosition({ top, left, ready: true });
  }, [open, projectGroups.length]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  const choose = (groupOverride: string | null) => {
    onAssign(groupOverride);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={`row-action chat-row__group-trigger ${
          session.groupOverride === undefined ? "" : "is-active"
        }`}
        type="button"
        title={copy.row.moveToGroup}
        aria-label={`${copy.row.moveToGroup}: ${session.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setPosition((current) => ({ ...current, ready: false }));
          setOpen((current) => !current);
        }}
      >
        <FolderInput size={15} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="chat-group-menu"
            role="menu"
            aria-label={copy.row.groupMenuTitle}
            style={{
              top: position.top,
              left: position.left,
              visibility: position.ready ? "visible" : "hidden"
            }}
          >
            <div className="chat-group-menu__header">
              <strong>{copy.row.groupMenuTitle}</strong>
              <span>{session.title}</span>
            </div>

            <GroupMenuOption
              active={session.groupOverride === undefined}
              icon={<RefreshCw size={14} />}
              label={copy.row.automatic}
              description={copy.row.detectedGroup(
                session.projectName || copy.common.noProject
              )}
              onClick={() => choose(null)}
            />
            <GroupMenuOption
              active={session.groupOverride === ""}
              icon={<FolderMinus size={14} />}
              label={copy.row.noGroup}
              description={copy.row.noGroupDescription}
              onClick={() => choose("")}
            />

            {projectGroups.some((group) => group.key !== "") && (
              <div className="chat-group-menu__separator" />
            )}
            {projectGroups
              .filter((group) => group.key !== "")
              .map((group) => (
                <GroupMenuOption
                  key={group.key}
                  active={session.groupOverride === group.key}
                  icon={
                    <span
                      className="chat-group-menu__symbol"
                      style={
                        {
                          "--group-color": group.color
                        } as CSSProperties
                      }
                    >
                      {group.symbol}
                    </span>
                  }
                  label={group.name}
                  onClick={() => choose(group.key)}
                />
              ))}
          </div>,
          document.body
        )}
    </>
  );
}

interface GroupMenuOptionProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  description?: string;
  onClick(): void;
}

function GroupMenuOption({
  active,
  icon,
  label,
  description,
  onClick
}: GroupMenuOptionProps) {
  return (
    <button
      className={`chat-group-menu__option ${active ? "is-active" : ""}`}
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
    >
      <span className="chat-group-menu__option-icon">{icon}</span>
      <span className="chat-group-menu__option-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      {active && <Check size={14} />}
    </button>
  );
}

import { useEffect, useRef, useState } from "react";
import { agentApi } from "../lib/api";

interface AppTitleBarProps {
  compact: boolean;
  onToggleCompact(): void;
}

type OpenMenu = "file" | "view" | null;

export function AppTitleBar({
  compact,
  onToggleCompact
}: AppTitleBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const menuRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (!menuRoot.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromKeyboard);
    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <header className="app-titlebar">
      <div
        className="app-titlebar__menus"
        ref={menuRoot}
      >
        <span
          className="app-titlebar__icon"
          aria-label="AgentSignal"
        >
          <i />
          <i />
          <i />
        </span>

        <div className="app-menu">
          <button
            className={openMenu === "file" ? "is-open" : ""}
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === "file"}
            onClick={() => toggleMenu("file")}
          >
            Plik
          </button>
          {openMenu === "file" && (
            <div
              className="app-menu__popover"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  void agentApi.exitApp();
                }}
              >
                <span>Wyjście</span>
                <kbd>Alt+F4</kbd>
              </button>
            </div>
          )}
        </div>

        <div className="app-menu">
          <button
            className={openMenu === "view" ? "is-open" : ""}
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === "view"}
            onClick={() => toggleMenu("view")}
          >
            Widok
          </button>
          {openMenu === "view" && (
            <div
              className="app-menu__popover"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onToggleCompact();
                }}
              >
                <span>
                  {compact ? "Pełny widok" : "Tryb kompaktowy"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="app-titlebar__drag" />
    </header>
  );
}

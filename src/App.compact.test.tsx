import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("App compact layout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("removes the full title and menu bar in compact mode", async () => {
    vi.stubGlobal("window", {
      agentSignal: undefined,
      localStorage: {
        getItem: (key: string) =>
          key === "agent-signal-compact" ? "true" : null
      }
    } as unknown as Window);

    const { default: App } = await import("./App");
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('class="compact-shell"');
    expect(markup).not.toContain('class="app-titlebar"');
    expect(markup).not.toContain('class="app-menu"');
  });
});

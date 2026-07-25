import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/preferences";
import { CompactDashboard } from "./CompactDashboard";

describe("CompactDashboard controls", () => {
  it("renders a full-dashboard return arrow instead of an Exit action", () => {
    const markup = renderToStaticMarkup(
      <CompactDashboard
        counts={{
          working: 0,
          attention: 0,
          idle: 0,
          error: 0,
          unavailable: 0
        }}
        sessions={[]}
        theme="dark"
        refreshing={false}
        updatedAt="2026-07-26T00:00:00.000Z"
        now={new Date("2026-07-26T00:00:01.000Z")}
        preferences={DEFAULT_PREFERENCES}
        onRefresh={() => undefined}
        onThemeToggle={() => undefined}
        onExpand={() => undefined}
      />
    );

    expect(markup).toContain("lucide-arrow-left");
    expect(markup).toContain('aria-label="Pełny widok"');
    expect(markup).not.toContain('aria-label="Wyjście"');
    expect(markup).not.toContain("app-titlebar");
    expect(markup).not.toContain("app-menu");
  });
});

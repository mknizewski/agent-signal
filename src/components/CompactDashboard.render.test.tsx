import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/preferences";
import type { TrackedSession } from "../shared/types";
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
    expect(markup.indexOf("lucide-arrow-left")).toBeLessThan(
      markup.indexOf("lucide-sun")
    );
  });

  it("includes detected Claude subagents in the compact summary", () => {
    const timestamp = "2026-07-26T00:00:00.000Z";
    const session: TrackedSession = {
      id: "claude:session-1",
      agent: "claude",
      source: "claude-code",
      title: "Claude task",
      summary: "Claude task",
      workingDirectory: "C:\\Git\\project",
      projectName: "project",
      status: "working",
      statusText: "working",
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId: "session-1",
      trackedAt: timestamp,
      available: true,
      pinned: false,
      subagents: [
        {
          id: "claude-subagent:session-1:agent-worker",
          threadId: "agent-worker",
          parentThreadId: "session-1",
          title: "Worker",
          depth: 1,
          status: "working",
          updatedAt: timestamp
        }
      ]
    };
    const markup = renderToStaticMarkup(
      <CompactDashboard
        counts={{
          working: 1,
          attention: 0,
          idle: 0,
          error: 0,
          unavailable: 0
        }}
        sessions={[session]}
        theme="dark"
        refreshing={false}
        updatedAt={timestamp}
        now={new Date(timestamp)}
        preferences={DEFAULT_PREFERENCES}
        onRefresh={() => undefined}
        onThemeToggle={() => undefined}
        onExpand={() => undefined}
      />
    );

    expect(markup).toContain("1 wykryty subagent");
  });
});

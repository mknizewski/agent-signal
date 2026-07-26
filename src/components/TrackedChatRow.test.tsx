import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/preferences";
import type { TrackedSession } from "../shared/types";
import { TrackedChatRow } from "./TrackedChatRow";

const session: TrackedSession = {
  id: "codex:thread-1",
  agent: "codex",
  source: "codex-app",
  title: "Projekt landing page",
  summary: "",
  workingDirectory: "D:\\Git\\landing",
  projectName: "landing",
  status: "idle",
  statusText: "Sesja jest bezczynna",
  createdAt: "2026-07-26T10:00:00.000Z",
  updatedAt: "2026-07-26T11:00:00.000Z",
  trackedAt: "2026-07-26T10:30:00.000Z",
  available: true,
  pinned: false,
  subagents: []
};

describe("TrackedChatRow group controls", () => {
  it("renders a draggable row with the custom group menu trigger", () => {
    const html = renderToStaticMarkup(
      <TrackedChatRow
        session={session}
        now={new Date("2026-07-26T12:00:00.000Z")}
        preferences={DEFAULT_PREFERENCES}
        projectGroups={[
          {
            key: "landing",
            name: "Landing",
            symbol: "L",
            color: "#6f82e8"
          }
        ]}
        dragging={false}
        onArchive={vi.fn()}
        onOpen={vi.fn()}
        onOpenSubagent={vi.fn()}
        onTogglePin={vi.fn()}
        onAssignGroup={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
      />
    );

    expect(html).toContain('draggable="true"');
    expect(html).toContain("Przeciągnij czat do innej grupy");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("Przenieś czat do grupy");
    expect(html).not.toContain("<select");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionSubagent } from "../shared/types";
import { SubagentTeamPanel } from "./SubagentTeamPanel";

const subagent: SessionSubagent = {
  id: "codex-subagent:child",
  threadId: "child",
  parentThreadId: "parent",
  title: "Research",
  role: "Researcher",
  status: "unavailable",
  updatedAt: "2026-07-26T08:00:00.000Z",
  depth: 1
};

describe("SubagentTeamPanel", () => {
  it("shows presence without exposing inferred statuses", () => {
    const markup = renderToStaticMarkup(
      <SubagentTeamPanel
        subagents={[subagent]}
        language="pl"
        onOpen={() => undefined}
      />
    );

    expect(markup).toContain("1 wykryty subagent");
    expect(markup).toContain("status-pet--presence");
    expect(markup).not.toContain("Stan nieznany");
    expect(markup).not.toContain("subagent-card__status");
  });
});

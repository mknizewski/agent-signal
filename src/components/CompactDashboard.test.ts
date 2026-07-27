import { describe, expect, it } from "vitest";
import type { TrackedSession } from "../shared/types";
import { compactAgentSummary } from "./CompactDashboard";

const baseSession: TrackedSession = {
  id: "codex:thread-1",
  agent: "codex",
  source: "codex-app",
  title: "Test",
  summary: "",
  workingDirectory: "D:\\Git\\project",
  projectName: "project",
  status: "working",
  statusText: "Agent wykonuje zadanie",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T12:00:00.000Z",
  trackedAt: "2026-07-24T11:00:00.000Z",
  pinned: false,
  available: true,
  subagents: []
};

describe("compact agent summary", () => {
  it("describes counts per status instead of applying one status to all chats", () => {
    expect(
      compactAgentSummary([
        baseSession,
        { ...baseSession, id: "codex:thread-2", status: "idle" }
      ])
    ).toBe("1 pracuje · 1 wolny");
  });

  it("uses plural labels and puts attention first", () => {
    expect(
      compactAgentSummary([
        { ...baseSession, status: "attention" },
        { ...baseSession, id: "codex:thread-2", status: "attention" },
        { ...baseSession, id: "codex:thread-3" }
      ])
    ).toBe("2 czekają na zatwierdzenie · 1 pracuje");
  });
});

import { describe, expect, it } from "vitest";
import { mapClaudeSession, mapCodexThread } from "./external-sessions";

const now = new Date("2026-07-24T12:00:00.000Z");

describe("external session mapping", () => {
  it("maps a Codex approval wait to the yellow attention state", () => {
    const session = mapCodexThread(
      {
        id: "thread-1",
        name: "Napraw logowanie",
        preview: "Znajdź błąd logowania",
        cwd: "D:\\Git\\portal",
        createdAt: 1_753_353_000,
        updatedAt: 1_753_353_600,
        status: {
          type: "active",
          activeFlags: ["waitingOnApproval"]
        }
      },
      now
    );

    expect(session.status).toBe("attention");
    expect(session.source).toBe("codex-app");
    expect(session.threadId).toBe("thread-1");
  });

  it("uses recent activity as a fallback for an unloaded Codex thread", () => {
    const session = mapCodexThread(
      {
        id: "thread-2",
        preview: "Uruchom testy",
        updatedAt: now.getTime() - 5_000,
        status: { type: "notLoaded" }
      },
      now
    );

    expect(session.status).toBe("working");
  });

  it("maps an older Codex thread to idle", () => {
    const session = mapCodexThread(
      {
        id: "thread-3",
        preview: "Gotowe",
        updatedAt: now.getTime() - 60_000,
        status: { type: "idle" }
      },
      now
    );

    expect(session.status).toBe("idle");
  });

  it("keeps a Codex thread working while its session log has an open task", () => {
    const session = mapCodexThread(
      {
        id: "thread-4",
        preview: "Długi refaktor",
        updatedAt: now.getTime() - 10 * 60_000,
        status: { type: "notLoaded" },
        logActivity: "working"
      },
      now
    );

    expect(session.status).toBe("working");
  });

  it("does not show a stale unknown Codex thread as free", () => {
    const session = mapCodexThread(
      {
        id: "thread-5",
        preview: "Nieznany stan",
        updatedAt: now.getTime() - 60_000,
        status: { type: "notLoaded" },
        logActivity: "unknown"
      },
      now
    );

    expect(session.status).toBe("unavailable");
  });

  it("maps recent Claude Code transcripts to working sessions", () => {
    const session = mapClaudeSession(
      {
        sessionId: "session-1",
        summary: "Refaktor koszyka",
        firstPrompt: "Uprość moduł koszyka",
        lastModified: now.getTime() - 4_000,
        cwd: "D:\\Git\\shop"
      },
      now
    );

    expect(session.status).toBe("working");
    expect(session.source).toBe("claude-code");
  });
});

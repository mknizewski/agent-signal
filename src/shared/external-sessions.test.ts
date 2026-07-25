import { describe, expect, it } from "vitest";
import {
  extractCodexCollabStatuses,
  isCodexSubagentThread,
  mapClaudeSession,
  mapCodexSubagent,
  mapCodexThread
} from "./external-sessions";

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

  it("prefers an approval detected in the log over an active runtime without flags", () => {
    const session = mapCodexThread(
      {
        id: "thread-approval-log",
        preview: "Uruchom komendę",
        updatedAt: now.getTime(),
        status: { type: "active", activeFlags: [] },
        logActivity: "attention"
      },
      now
    );

    expect(session.status).toBe("attention");
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

  it("maps a spawned Codex thread to its explicit parent session", () => {
    const thread = {
      id: "child-thread",
      agentNickname: "Scout",
      agentRole: "Explore the provider API",
      updatedAt: now.getTime() - 2_000,
      status: { type: "active" },
      source: {
        subAgent: {
          thread_spawn: {
            parent_thread_id: "parent-thread",
            depth: 1,
            agent_nickname: "Fallback",
            agent_role: "Fallback role"
          }
        }
      }
    };

    expect(isCodexSubagentThread(thread)).toBe(true);
    expect(mapCodexSubagent(thread, now)).toMatchObject({
      threadId: "child-thread",
      parentThreadId: "parent-thread",
      title: "Scout",
      role: "Explore the provider API",
      depth: 1,
      status: "working"
    });
  });

  it("does not infer completion from a not-loaded subagent thread", () => {
    const subagent = mapCodexSubagent(
      {
        id: "completed-child",
        preview: "Run regression tests",
        status: { type: "notLoaded" },
        source: {
          subAgent: {
            thread_spawn: {
              parent_thread_id: "parent-thread",
              depth: 2
            }
          }
        }
      },
      now
    );

    expect(subagent?.status).toBe("unavailable");
    expect(subagent?.depth).toBe(2);
  });

  it("uses the parent collab state when a running subagent is not loaded", () => {
    const thread = {
      id: "running-child",
      status: { type: "notLoaded" },
      source: {
        subAgent: {
          thread_spawn: {
            parent_thread_id: "parent-thread"
          }
        }
      }
    };

    expect(mapCodexSubagent(thread, now, "running")?.status).toBe(
      "working"
    );
    expect(mapCodexSubagent(thread, now, "completed")?.status).toBe(
      "idle"
    );
  });

  it("keeps a live child working when the parent state is stale", () => {
    const subagent = mapCodexSubagent(
      {
        id: "live-child",
        status: { type: "active" },
        source: {
          subAgent: {
            thread_spawn: {
              parent_thread_id: "parent-thread"
            }
          }
        }
      },
      now,
      "completed"
    );

    expect(subagent?.status).toBe("working");
  });

  it("extracts the latest official collab state per child thread", () => {
    const statuses = extractCodexCollabStatuses({
      id: "parent-thread",
      turns: [
        {
          items: [
            {
              type: "collabAgentToolCall",
              agentsStates: {
                "child-one": { status: "pendingInit" },
                "child-two": { status: "running" }
              }
            }
          ]
        },
        {
          items: [
            {
              type: "collabAgentToolCall",
              agentsStates: {
                "child-one": { status: "running" },
                "child-two": { status: "completed" },
                malformed: { status: "madeUp" }
              }
            }
          ]
        }
      ]
    });

    expect(Object.fromEntries(statuses)).toEqual({
      "child-one": "running",
      "child-two": "completed"
    });
  });

  it("uses the parent turn lifecycle when Codex only persists subagent activity", () => {
    const running = extractCodexCollabStatuses({
      id: "running-parent",
      turns: [
        {
          status: "inProgress",
          items: [
            {
              type: "subAgentActivity",
              kind: "started",
              agentThreadId: "running-child"
            }
          ]
        }
      ]
    });
    const completed = extractCodexCollabStatuses({
      id: "completed-parent",
      turns: [
        {
          status: "completed",
          items: [
            {
              type: "collabAgentToolCall",
              agentsStates: {
                "completed-child": { status: "running" }
              }
            },
            {
              type: "subAgentActivity",
              kind: "started",
              agentThreadId: "completed-child"
            }
          ]
        }
      ]
    });

    expect(Object.fromEntries(running)).toEqual({
      "running-child": "running"
    });
    expect(Object.fromEntries(completed)).toEqual({
      "completed-child": "completed"
    });
  });

  it("keeps an explicitly completed child completed while its parent still runs", () => {
    const statuses = extractCodexCollabStatuses({
      id: "mixed-parent",
      turns: [
        {
          status: "inProgress",
          items: [
            {
              type: "collabAgentToolCall",
              agentsStates: {
                "done-child": { status: "completed" }
              }
            },
            {
              type: "subAgentActivity",
              kind: "started",
              agentThreadId: "done-child"
            }
          ]
        }
      ]
    });

    expect(statuses.get("done-child")).toBe("completed");
  });

  it("does not infer a team relationship without thread-spawn metadata", () => {
    const unrelatedThread = {
      id: "review-thread",
      agentNickname: "Reviewer",
      status: { type: "active" },
      source: {
        subAgent: "review"
      }
    };

    expect(isCodexSubagentThread(unrelatedThread)).toBe(false);
    expect(mapCodexSubagent(unrelatedThread, now)).toBeUndefined();
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

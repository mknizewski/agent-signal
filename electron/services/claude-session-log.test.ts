import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ClaudeSessionLogTracker,
  reduceClaudeLogLines
} from "./claude-session-log";

function entry(value: unknown): string {
  return JSON.stringify(value);
}

function userPrompt(uuid = "user-1"): string {
  return entry({
    type: "user",
    uuid,
    permissionMode: "acceptEdits",
    message: { role: "user", content: "redacted" }
  });
}

function toolUse(name: string, id: string): string {
  return entry({
    type: "assistant",
    message: {
      role: "assistant",
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id, name, input: {} }]
    }
  });
}

function toolResult(id: string): string {
  return entry({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: "redacted" }]
    }
  });
}

function completedTurn(): string {
  return entry({
    type: "assistant",
    message: {
      role: "assistant",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "redacted" }]
    }
  });
}

describe("Claude session log activity", () => {
  it("keeps a turn working until Claude records an explicit end", () => {
    expect(reduceClaudeLogLines([userPrompt()])).toMatchObject({
      activity: "working",
      activeTurnId: "user-1",
      permissionMode: "acceptEdits"
    });

    expect(
      reduceClaudeLogLines([userPrompt(), toolUse("Bash", "tool-1")])
        .activity
    ).toBe("working");

    expect(
      reduceClaudeLogLines([
        userPrompt(),
        toolUse("Bash", "tool-1"),
        toolResult("tool-1"),
        completedTurn()
      ])
    ).toMatchObject({ activity: "idle", activeTurnId: undefined });
  });

  it("marks AskUserQuestion as attention until its answer is recorded", () => {
    const waiting = reduceClaudeLogLines([
      userPrompt(),
      toolUse("AskUserQuestion", "question-1")
    ]);

    expect(waiting).toMatchObject({
      activity: "attention",
      activeTurnId: "user-1",
      pendingAttentionToolIds: ["question-1"]
    });

    expect(reduceClaudeLogLines([toolResult("question-1")], waiting)).toMatchObject(
      {
        activity: "working",
        activeTurnId: "user-1"
      }
    );
  });

  it("recognizes plan approval without mistaking normal tools for approval", () => {
    expect(
      reduceClaudeLogLines([
        userPrompt(),
        toolUse("ExitPlanMode", "approval-1")
      ]).activity
    ).toBe("attention");
    expect(
      reduceClaudeLogLines([userPrompt(), toolUse("PowerShell", "tool-1")])
        .activity
    ).toBe("working");
  });

  it("ignores title and mode metadata appended after the conversation", () => {
    const state = reduceClaudeLogLines([
      userPrompt(),
      completedTurn(),
      entry({ type: "last-prompt", lastPrompt: "redacted" }),
      entry({ type: "ai-title", aiTitle: "redacted" }),
      entry({ type: "mode", mode: "acceptEdits" })
    ]);

    expect(state.activity).toBe("idle");
  });

  it("treats SDK stop sequences as completed turns", () => {
    const state = reduceClaudeLogLines([
      userPrompt(),
      entry({
        type: "assistant",
        message: {
          role: "assistant",
          stop_reason: "stop_sequence",
          content: [{ type: "text", text: "redacted" }]
        }
      })
    ]);

    expect(state.activity).toBe("idle");
  });

  it("ignores transcript metadata represented as a user message", () => {
    const state = reduceClaudeLogLines([
      userPrompt(),
      completedTurn(),
      entry({
        type: "user",
        isMeta: true,
        message: { role: "user", content: "redacted metadata" }
      })
    ]);

    expect(state.activity).toBe("idle");
  });

  it("tracks a growing transcript incrementally", async () => {
    const projectsRoot = await mkdtemp(
      path.join(tmpdir(), "agent-signal-claude-log-")
    );
    const projectDirectory = path.join(projectsRoot, "C--Git--redacted");
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const logPath = path.join(projectDirectory, `${sessionId}.jsonl`);
    const tracker = new ClaudeSessionLogTracker(projectsRoot);
    const session = {
      sessionId,
      summary: "redacted",
      lastModified: Date.now(),
      cwd: "C:\\Git\\redacted"
    };

    try {
      await mkdir(projectDirectory, { recursive: true });
      await writeFile(logPath, `${userPrompt()}\n`, "utf8");
      let [result] = await tracker.enrich([session], [sessionId]);
      expect(result.logActivity).toBe("working");

      await appendFile(
        logPath,
        `${toolUse("AskUserQuestion", "question-1")}\n`,
        "utf8"
      );
      [result] = await tracker.enrich([session], [sessionId]);
      expect(result.logActivity).toBe("attention");

      await appendFile(
        logPath,
        `${toolResult("question-1")}\n${completedTurn()}\n`,
        "utf8"
      );
      [result] = await tracker.enrich([session], [sessionId]);
      expect(result.logActivity).toBe("idle");
    } finally {
      await rm(projectsRoot, { recursive: true, force: true });
    }
  });

  it("discovers Claude subagents stored beside a tracked transcript", async () => {
    const projectsRoot = await mkdtemp(
      path.join(tmpdir(), "agent-signal-claude-subagents-")
    );
    const projectDirectory = path.join(projectsRoot, "C--Git--redacted");
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const logPath = path.join(projectDirectory, `${sessionId}.jsonl`);
    const subagentsDirectory = path.join(
      projectDirectory,
      sessionId,
      "subagents"
    );
    const session = {
      sessionId,
      summary: "redacted",
      lastModified: Date.now(),
      cwd: "C:\\Git\\redacted"
    };

    try {
      await mkdir(subagentsDirectory, { recursive: true });
      await writeFile(logPath, `${completedTurn()}\n`, "utf8");
      await writeFile(
        path.join(subagentsDirectory, "agent-worker.meta.json"),
        JSON.stringify({
          agentType: "Explore",
          description: "Inspect provider state",
          spawnDepth: 2
        }),
        "utf8"
      );
      await writeFile(
        path.join(subagentsDirectory, "agent-worker.jsonl"),
        `${userPrompt("subagent-turn")}\n`,
        "utf8"
      );

      const tracker = new ClaudeSessionLogTracker(projectsRoot);
      const subagents = await tracker.listSubagents(
        [session],
        [sessionId]
      );

      expect(subagents).toEqual([
        expect.objectContaining({
          id: `claude-subagent:${sessionId}:agent-worker`,
          threadId: "agent-worker",
          parentThreadId: sessionId,
          title: "Inspect provider state",
          role: "Explore",
          depth: 2,
          status: "working"
        })
      ]);
    } finally {
      await rm(projectsRoot, { recursive: true, force: true });
    }
  });

  it("bounds the number of Claude subagent transcripts read per session", async () => {
    const projectsRoot = await mkdtemp(
      path.join(tmpdir(), "agent-signal-claude-subagent-limit-")
    );
    const projectDirectory = path.join(projectsRoot, "C--Git--redacted");
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const logPath = path.join(projectDirectory, `${sessionId}.jsonl`);
    const subagentsDirectory = path.join(
      projectDirectory,
      sessionId,
      "subagents"
    );
    const session = {
      sessionId,
      summary: "redacted",
      lastModified: Date.now(),
      cwd: "C:\\Git\\redacted"
    };

    try {
      await mkdir(subagentsDirectory, { recursive: true });
      await writeFile(logPath, `${completedTurn()}\n`, "utf8");
      await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          writeFile(
            path.join(
              subagentsDirectory,
              `agent-worker-${String(index).padStart(2, "0")}.jsonl`
            ),
            `${completedTurn()}\n`,
            "utf8"
          )
        )
      );

      const tracker = new ClaudeSessionLogTracker(projectsRoot);
      const subagents = await tracker.listSubagents(
        [session],
        [sessionId]
      );

      expect(subagents).toHaveLength(32);
    } finally {
      await rm(projectsRoot, { recursive: true, force: true });
    }
  });
});

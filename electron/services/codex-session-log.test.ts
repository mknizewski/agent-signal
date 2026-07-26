import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CodexSessionLogTracker,
  reduceCodexLogLines
} from "./codex-session-log";

function event(type: string, turnId: string): string {
  return JSON.stringify({
    type: "event_msg",
    payload: { type, turn_id: turnId }
  });
}

function toolCall(
  name: string,
  callId: string,
  args: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    type: "response_item",
    payload: {
      type: "function_call",
      name,
      call_id: callId,
      arguments: JSON.stringify(args)
    }
  });
}

function toolOutput(callId: string): string {
  return JSON.stringify({
    type: "response_item",
    payload: {
      type: "function_call_output",
      call_id: callId,
      output: "redacted"
    }
  });
}

function reasoning(): string {
  return JSON.stringify({
    type: "response_item",
    payload: {
      type: "reasoning",
      encrypted_content: "redacted"
    }
  });
}

describe("Codex session log activity", () => {
  it("marks an open Codex task as working", () => {
    const state = reduceCodexLogLines([event("task_started", "turn-1")]);
    expect(state).toEqual({
      activity: "working",
      activeTurnId: "turn-1"
    });
  });

  it("marks a completed task as idle", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      event("task_complete", "turn-1")
    ]);
    expect(state).toEqual({ activity: "idle", activeTurnId: undefined });
  });

  it("does not close a newer task with an older completion event", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      event("task_started", "turn-2"),
      event("task_complete", "turn-1")
    ]);
    expect(state).toEqual({
      activity: "working",
      activeTurnId: "turn-2"
    });
  });

  it("marks a command awaiting elevated permission as attention", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      toolCall("shell_command", "call-1", {
        command: "redacted",
        sandbox_permissions: "require_escalated",
        justification: "redacted"
      })
    ]);

    expect(state).toEqual({
      activity: "attention",
      activeTurnId: "turn-1",
      pendingAttentionCallIds: ["call-1"]
    });
  });

  it("returns to working after an approval request is resolved", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      toolCall("shell_command", "call-1", {
        sandbox_permissions: "require_escalated"
      }),
      toolOutput("call-1")
    ]);

    expect(state).toEqual({
      activity: "working",
      activeTurnId: "turn-1"
    });
  });

  it("marks request_user_input as attention until the answer arrives", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      toolCall("request_user_input", "question-1")
    ]);

    expect(state.activity).toBe("attention");
    expect(state.pendingAttentionCallIds).toEqual(["question-1"]);

    expect(reduceCodexLogLines([toolOutput("question-1")], state)).toEqual({
      activity: "working",
      activeTurnId: "turn-1"
    });
  });

  it("does not confuse an ordinary running command with an approval wait", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      toolCall("shell_command", "call-1", {
        command: "redacted",
        timeout_ms: 120_000
      })
    ]);

    expect(state).toEqual({
      activity: "working",
      activeTurnId: "turn-1"
    });
  });

  it("keeps a reasoning-only active turn working instead of guessing approval", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      reasoning()
    ]);

    expect(state).toEqual({
      activity: "working",
      activeTurnId: "turn-1"
    });
  });

  it("clears outstanding attention calls when the turn ends", () => {
    const state = reduceCodexLogLines([
      event("task_started", "turn-1"),
      toolCall("request_permissions", "permission-1"),
      event("task_complete", "turn-1")
    ]);

    expect(state).toEqual({ activity: "idle", activeTurnId: undefined });
  });

  it("preserves an approval wait while incrementally reading a growing log", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "agent-signal-codex-log-")
    );
    const logPath = path.join(directory, "session.jsonl");
    const tracker = new CodexSessionLogTracker();
    const thread = { id: "thread-1", path: logPath };

    try {
      await writeFile(logPath, `${event("task_started", "turn-1")}\n`, "utf8");
      let [result] = await tracker.enrich([thread], [thread.id]);
      expect(result.logActivity).toBe("working");

      await appendFile(
        logPath,
        `${toolCall("shell_command", "approval-1", {
          sandbox_permissions: "require_escalated"
        })}\n`,
        "utf8"
      );
      [result] = await tracker.enrich([thread], [thread.id]);
      expect(result.logActivity).toBe("attention");

      await appendFile(logPath, `${toolOutput("approval-1")}\n`, "utf8");
      [result] = await tracker.enrich([thread], [thread.id]);
      expect(result.logActivity).toBe("working");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads the bounded tail of a large log and keeps tracking new events", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "agent-signal-large-codex-log-")
    );
    const logPath = path.join(directory, "session.jsonl");
    const tracker = new CodexSessionLogTracker();
    const thread = { id: "thread-large", path: logPath };

    try {
      const oversizedRecord = JSON.stringify({
        type: "ignored",
        payload: "x".repeat(3 * 1024 * 1024)
      });
      await writeFile(
        logPath,
        `${oversizedRecord}\n${event("task_started", "turn-tail")}\n`,
        "utf8"
      );

      let [result] = await tracker.enrich([thread], [thread.id]);
      expect(result.logActivity).toBe("working");

      await appendFile(
        logPath,
        `${event("task_complete", "turn-tail")}\n`,
        "utf8"
      );
      [result] = await tracker.enrich([thread], [thread.id]);
      expect(result.logActivity).toBe("idle");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

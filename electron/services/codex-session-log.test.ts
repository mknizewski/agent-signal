import { describe, expect, it } from "vitest";
import { reduceCodexLogLines } from "./codex-session-log";

function event(type: string, turnId: string): string {
  return JSON.stringify({
    type: "event_msg",
    payload: { type, turn_id: turnId }
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
});

import { open, readFile, stat } from "node:fs/promises";
import type { CodexExternalThread } from "../../src/shared/external-sessions";

export type CodexLogActivity = "working" | "attention" | "idle" | "unknown";

export interface CodexLogState {
  activity: CodexLogActivity;
  activeTurnId?: string;
  pendingAttentionCallIds?: string[];
  approvalPendingLikely?: boolean;
}

interface CachedLogState extends CodexLogState {
  path: string;
  offset: number;
  remainder: string;
}

export class CodexSessionLogTracker {
  private readonly states = new Map<string, CachedLogState>();

  async enrich(
    threads: CodexExternalThread[],
    trackedThreadIds: string[]
  ): Promise<CodexExternalThread[]> {
    const tracked = new Set(trackedThreadIds);
    for (const threadId of this.states.keys()) {
      if (!tracked.has(threadId)) this.states.delete(threadId);
    }

    return Promise.all(
      threads.map(async (thread) => {
        if (!tracked.has(thread.id)) return thread;
        return {
          ...thread,
          logActivity: await this.readActivity(thread)
        };
      })
    );
  }

  private async readActivity(
    thread: CodexExternalThread
  ): Promise<CodexLogActivity> {
    const logPath = thread.path?.trim();
    if (!logPath) return "unknown";

    const previous = this.states.get(thread.id);
    try {
      const fileStats = await stat(logPath);
      if (
        !previous ||
        previous.path !== logPath ||
        fileStats.size < previous.offset
      ) {
        const data = await readFile(logPath);
        const initial: CachedLogState = {
          path: logPath,
          offset: data.length,
          remainder: "",
          activity: "unknown"
        };
        this.consume(initial, data.toString("utf8"));
        this.states.set(thread.id, initial);
        return inferCodexLogActivity(initial, fileStats.mtimeMs);
      }

      if (fileStats.size === previous.offset) {
        return inferCodexLogActivity(previous, fileStats.mtimeMs);
      }

      const length = fileStats.size - previous.offset;
      const data = Buffer.alloc(length);
      const handle = await open(logPath, "r");
      let bytesRead = 0;
      try {
        while (bytesRead < length) {
          const result = await handle.read(
            data,
            bytesRead,
            length - bytesRead,
            previous.offset + bytesRead
          );
          if (result.bytesRead === 0) break;
          bytesRead += result.bytesRead;
        }
      } finally {
        await handle.close();
      }
      previous.offset += bytesRead;
      this.consume(previous, data.subarray(0, bytesRead).toString("utf8"));
      return inferCodexLogActivity(previous, fileStats.mtimeMs);
    } catch {
      return previous?.activity ?? "unknown";
    }
  }

  private consume(state: CachedLogState, chunk: string): void {
    const combined = state.remainder + chunk;
    const lines = combined.split(/\r?\n/);
    state.remainder = lines.pop() ?? "";
    const next = reduceCodexLogLines(lines, state);
    state.activity = next.activity;
    state.activeTurnId = next.activeTurnId;
    if (next.pendingAttentionCallIds?.length) {
      state.pendingAttentionCallIds = next.pendingAttentionCallIds;
    } else {
      delete state.pendingAttentionCallIds;
    }
    if (next.approvalPendingLikely) {
      state.approvalPendingLikely = true;
    } else {
      delete state.approvalPendingLikely;
    }
  }
}

export function reduceCodexLogLines(
  lines: string[],
  initial: CodexLogState = { activity: "unknown" }
): CodexLogState {
  const state = { ...initial };

  for (const line of lines) {
    if (
      !line.includes('"task_started"') &&
      !line.includes('"task_complete"') &&
      !line.includes('"turn_aborted"') &&
      !line.includes('"function_call"') &&
      !line.includes('"function_call_output"') &&
      !line.includes('"custom_tool_call"') &&
      !line.includes('"custom_tool_call_output"') &&
      !line.includes('"reasoning"') &&
      !line.includes('"message"')
    ) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as {
        type?: string;
        payload?: {
          type?: string;
          turn_id?: string;
          call_id?: string;
          name?: string;
          arguments?: string;
          input?: string;
        };
      };

      const eventType = entry.payload?.type;
      const turnId = entry.payload?.turn_id;
      if (entry.type === "event_msg" && eventType === "task_started") {
        state.activity = "working";
        state.activeTurnId = turnId;
        delete state.pendingAttentionCallIds;
        delete state.approvalPendingLikely;
      } else if (
        entry.type === "event_msg" &&
        (eventType === "task_complete" || eventType === "turn_aborted")
      ) {
        if (!state.activeTurnId || !turnId || state.activeTurnId === turnId) {
          state.activity = "idle";
          state.activeTurnId = undefined;
          delete state.pendingAttentionCallIds;
          delete state.approvalPendingLikely;
        }
      } else if (
        entry.type === "response_item" &&
        isInteractiveCall(entry.payload)
      ) {
        const callId = entry.payload?.call_id;
        if (!callId) continue;
        const pending = new Set(state.pendingAttentionCallIds ?? []);
        pending.add(callId);
        state.pendingAttentionCallIds = [...pending];
        state.activity = "attention";
        delete state.approvalPendingLikely;
      } else if (
        entry.type === "response_item" &&
        isCallOutput(eventType)
      ) {
        const callId = entry.payload?.call_id;
        if (!callId || !state.pendingAttentionCallIds?.includes(callId)) {
          continue;
        }
        const pending = state.pendingAttentionCallIds.filter(
          (candidate) => candidate !== callId
        );
        if (pending.length > 0) {
          state.pendingAttentionCallIds = pending;
          state.activity = "attention";
        } else {
          delete state.pendingAttentionCallIds;
          state.activity = state.activeTurnId ? "working" : "unknown";
        }
        delete state.approvalPendingLikely;
      } else if (
        entry.type === "response_item" &&
        eventType === "reasoning" &&
        state.activeTurnId
      ) {
        state.approvalPendingLikely = true;
      } else if (
        entry.type === "response_item" &&
        (eventType === "function_call" ||
          eventType === "custom_tool_call" ||
          eventType === "message")
      ) {
        delete state.approvalPendingLikely;
      }
    } catch {
      // A concurrently written partial JSONL record is retried on the next pass.
    }
  }

  return state;
}

export function inferCodexLogActivity(
  state: CodexLogState,
  lastLogWriteAt: number,
  now = Date.now()
): CodexLogActivity {
  if (
    state.activity === "working" &&
    state.activeTurnId &&
    state.approvalPendingLikely &&
    now - lastLogWriteAt >= 8_000
  ) {
    return "attention";
  }
  return state.activity;
}

function isInteractiveCall(
  payload:
    | {
        type?: string;
        name?: string;
        arguments?: string;
        input?: string;
      }
    | undefined
): boolean {
  if (
    payload?.type !== "function_call" &&
    payload?.type !== "custom_tool_call"
  ) {
    return false;
  }

  const name = payload.name?.trim().toLowerCase();
  if (
    name === "request_user_input" ||
    name === "request_permissions" ||
    name === "request_permission"
  ) {
    return true;
  }

  const rawArguments =
    payload.type === "custom_tool_call" ? payload.input : payload.arguments;
  if (!rawArguments) return false;
  try {
    const parsed = JSON.parse(rawArguments) as {
      sandbox_permissions?: unknown;
    };
    return parsed.sandbox_permissions === "require_escalated";
  } catch {
    return false;
  }
}

function isCallOutput(type?: string): boolean {
  return (
    type === "function_call_output" || type === "custom_tool_call_output"
  );
}

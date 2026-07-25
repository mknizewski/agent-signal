import { open, readFile, stat } from "node:fs/promises";
import type { CodexExternalThread } from "../../src/shared/external-sessions";

export type CodexLogActivity = "working" | "idle" | "unknown";

export interface CodexLogState {
  activity: CodexLogActivity;
  activeTurnId?: string;
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
        return initial.activity;
      }

      if (fileStats.size === previous.offset) return previous.activity;

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
      return previous.activity;
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
      !line.includes('"turn_aborted"')
    ) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as {
        type?: string;
        payload?: { type?: string; turn_id?: string };
      };
      if (entry.type !== "event_msg") continue;

      const eventType = entry.payload?.type;
      const turnId = entry.payload?.turn_id;
      if (eventType === "task_started") {
        state.activity = "working";
        state.activeTurnId = turnId;
      } else if (
        eventType === "task_complete" ||
        eventType === "turn_aborted"
      ) {
        if (!state.activeTurnId || !turnId || state.activeTurnId === turnId) {
          state.activity = "idle";
          state.activeTurnId = undefined;
        }
      }
    } catch {
      // A concurrently written partial JSONL record is retried on the next pass.
    }
  }

  return state;
}

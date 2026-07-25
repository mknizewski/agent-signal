import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrackedSessionRecord } from "../../src/shared/types";

interface StoredState {
  version: 2;
  trackedSessions: TrackedSessionRecord[];
}

export class TrackingStore {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "agent-signal-state.json");
  }

  async load(): Promise<TrackedSessionRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (parsed.version !== 2 || !Array.isArray(parsed.trackedSessions)) {
        return [];
      }
      return parsed.trackedSessions;
    } catch {
      return [];
    }
  }

  async save(trackedSessions: TrackedSessionRecord[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    const state: StoredState = { version: 2, trackedSessions };
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

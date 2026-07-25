import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ArchivedSessionRecord,
  TrackingState,
  TrackedSessionRecord
} from "../../src/shared/types";

interface StoredStateV2 {
  version: 2;
  trackedSessions: TrackedSessionRecord[];
}

interface StoredStateV3 {
  version: 3;
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
}

export class TrackingStore {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "agent-signal-state.json");
  }

  async load(): Promise<TrackingState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredStateV2 | StoredStateV3>;
      if (!Array.isArray(parsed.trackedSessions)) {
        return emptyState();
      }
      if (parsed.version === 2) {
        return {
          trackedSessions: parsed.trackedSessions,
          archivedSessions: []
        };
      }
      if (parsed.version === 3 && Array.isArray(parsed.archivedSessions)) {
        return {
          trackedSessions: parsed.trackedSessions,
          archivedSessions: parsed.archivedSessions
        };
      }
      return emptyState();
    } catch {
      return emptyState();
    }
  }

  async save(state: TrackingState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    const storedState: StoredStateV3 = {
      version: 3,
      trackedSessions: state.trackedSessions,
      archivedSessions: state.archivedSessions
    };
    await writeFile(
      temporaryPath,
      JSON.stringify(storedState, null, 2),
      "utf8"
    );
    await rename(temporaryPath, this.filePath);
  }
}

function emptyState(): TrackingState {
  return { trackedSessions: [], archivedSessions: [] };
}

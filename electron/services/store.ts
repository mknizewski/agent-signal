import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppPreferences,
  ArchivedSessionRecord,
  TrackingState,
  TrackedSessionRecord
} from "../../src/shared/types";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  projectNameFromPath
} from "../../src/shared/preferences";

interface StoredStateV2 {
  version: 2;
  trackedSessions: TrackedSessionRecord[];
}

interface StoredStateV3 {
  version: 3;
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
}

interface StoredStateV4 {
  version: 4;
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
  preferences: AppPreferences;
}

export class TrackingStore {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "agent-signal-state.json");
  }

  async load(): Promise<TrackingState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<
        StoredStateV2 | StoredStateV3 | StoredStateV4
      >;
      if (!Array.isArray(parsed.trackedSessions)) {
        return emptyState();
      }
      if (parsed.version === 2) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: [],
          preferences: DEFAULT_PREFERENCES
        };
      }
      if (parsed.version === 3 && Array.isArray(parsed.archivedSessions)) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: normalizeArchivedRecords(parsed.archivedSessions),
          preferences: DEFAULT_PREFERENCES
        };
      }
      if (
        parsed.version === 4 &&
        Array.isArray(parsed.archivedSessions)
      ) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: normalizeArchivedRecords(parsed.archivedSessions),
          preferences: normalizePreferences(parsed.preferences)
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
    const storedState: StoredStateV4 = {
      version: 4,
      trackedSessions: state.trackedSessions,
      archivedSessions: state.archivedSessions,
      preferences: normalizePreferences(state.preferences)
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
  return {
    trackedSessions: [],
    archivedSessions: [],
    preferences: DEFAULT_PREFERENCES
  };
}

function normalizeRecords(
  records: TrackedSessionRecord[]
): TrackedSessionRecord[] {
  return records.map((record) => ({
    ...record,
    projectName:
      typeof record.projectName === "string"
        ? record.projectName
        : projectNameFromPath(record.workingDirectory),
    pinned: record.pinned ?? false
  }));
}

function normalizeArchivedRecords(
  records: ArchivedSessionRecord[]
): ArchivedSessionRecord[] {
  return normalizeRecords(records) as ArchivedSessionRecord[];
}

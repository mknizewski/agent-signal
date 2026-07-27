import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppPreferences,
  ArchivedSessionRecord,
  ProjectGroupConfig,
  TrackingState,
  TrackedSessionRecord
} from "../../src/shared/types";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  projectNameFromPath
} from "../../src/shared/preferences";
import { normalizeProjectGroupConfigs } from "../../src/shared/project-groups";

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

interface StoredStateV5 {
  version: 5;
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
  preferences: AppPreferences;
  projectGroups: ProjectGroupConfig[];
}

interface StoredStateV6 {
  version: 6;
  trackedSessions: TrackedSessionRecord[];
  archivedSessions: ArchivedSessionRecord[];
  preferences: AppPreferences;
  projectGroups: ProjectGroupConfig[];
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
        | StoredStateV2
        | StoredStateV3
        | StoredStateV4
        | StoredStateV5
        | StoredStateV6
      >;
      if (!Array.isArray(parsed.trackedSessions)) {
        return emptyState();
      }
      if (parsed.version === 2) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: [],
          preferences: DEFAULT_PREFERENCES,
          projectGroups: []
        };
      }
      if (parsed.version === 3 && Array.isArray(parsed.archivedSessions)) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: normalizeArchivedRecords(parsed.archivedSessions),
          preferences: DEFAULT_PREFERENCES,
          projectGroups: []
        };
      }
      if (
        parsed.version === 4 &&
        Array.isArray(parsed.archivedSessions)
      ) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: normalizeArchivedRecords(parsed.archivedSessions),
          preferences: normalizePreferences(parsed.preferences),
          projectGroups: []
        };
      }
      if (
        (parsed.version === 5 || parsed.version === 6) &&
        Array.isArray(parsed.archivedSessions)
      ) {
        return {
          trackedSessions: normalizeRecords(parsed.trackedSessions),
          archivedSessions: normalizeArchivedRecords(parsed.archivedSessions),
          preferences: normalizePreferences(parsed.preferences),
          projectGroups: normalizeProjectGroupConfigs(parsed.projectGroups)
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
    const storedState: StoredStateV6 = {
      version: 6,
      trackedSessions: state.trackedSessions,
      archivedSessions: state.archivedSessions,
      preferences: normalizePreferences(state.preferences),
      projectGroups: normalizeProjectGroupConfigs(state.projectGroups)
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
    preferences: DEFAULT_PREFERENCES,
    projectGroups: []
  };
}

function normalizeRecords(
  records: TrackedSessionRecord[]
): TrackedSessionRecord[] {
  return records.map((record) => {
    const {
      groupOverride: rawGroupOverride,
      titleOverride: rawTitleOverride,
      ...rest
    } = record;
    const groupOverride =
      typeof rawGroupOverride === "string"
        ? rawGroupOverride.trim().slice(0, 80)
        : undefined;
    const titleOverride =
      typeof rawTitleOverride === "string"
        ? rawTitleOverride.trim().slice(0, 120) || undefined
        : undefined;
    return {
      ...rest,
      projectName:
        typeof record.projectName === "string"
          ? record.projectName
          : projectNameFromPath(record.workingDirectory),
      ...(titleOverride === undefined ? {} : { titleOverride }),
      ...(groupOverride === undefined ? {} : { groupOverride }),
      pinned: record.pinned ?? false
    };
  });
}

function normalizeArchivedRecords(
  records: ArchivedSessionRecord[]
): ArchivedSessionRecord[] {
  return normalizeRecords(records) as ArchivedSessionRecord[];
}

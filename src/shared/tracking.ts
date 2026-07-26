import type {
  ArchivedSessionRecord,
  DiscoveredSession,
  TrackedSession,
  TrackedSessionRecord
} from "./types";

export function createTrackingRecord(
  session: DiscoveredSession,
  trackedAt = new Date().toISOString()
): TrackedSessionRecord {
  return {
    id: session.id,
    agent: session.agent,
    source: session.source,
    title: session.title,
    summary: session.summary,
    workingDirectory: session.workingDirectory,
    projectName: session.projectName,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    trackedAt,
    threadId: session.threadId,
    sessionId: session.sessionId,
    pinned: false
  };
}

export function createArchivedSessionRecord(
  record: TrackedSessionRecord,
  currentSession?: DiscoveredSession,
  archivedAt = new Date().toISOString()
): ArchivedSessionRecord {
  const latestRecord = currentSession
    ? {
        ...createTrackingRecord(currentSession, record.trackedAt),
        projectName: record.projectName || currentSession.projectName,
        ...(record.groupOverride === undefined
          ? {}
          : { groupOverride: record.groupOverride }),
        pinned: record.pinned ?? false
      }
    : record;
  return { ...latestRecord, archivedAt };
}

export function restoreTrackingRecord(
  archived: ArchivedSessionRecord
): TrackedSessionRecord {
  const { archivedAt: _archivedAt, ...record } = archived;
  return record;
}

export function resolveTrackedSessions(
  records: TrackedSessionRecord[],
  catalog: DiscoveredSession[],
  autoGroupProjects = true
): TrackedSession[] {
  const catalogById = new Map(catalog.map((session) => [session.id, session]));

  return records.map((record) => {
    const current = catalogById.get(record.id);
    if (current) {
      return {
        ...current,
        projectName: autoGroupProjects
          ? current.projectName
          : record.projectName,
        ...(record.groupOverride === undefined
          ? {}
          : { groupOverride: record.groupOverride }),
        pinned: record.pinned ?? false,
        trackedAt: record.trackedAt,
        available: true,
        subagents: []
      };
    }

    return {
      ...record,
      projectName: record.projectName,
      pinned: record.pinned ?? false,
      status: "unavailable",
      statusText: "Sesja nie jest obecnie widoczna",
      available: false,
      subagents: []
    };
  });
}

export function untrackedSessions(
  records: TrackedSessionRecord[],
  catalog: DiscoveredSession[],
  archivedRecords: ArchivedSessionRecord[] = []
): DiscoveredSession[] {
  const hiddenIds = new Set([
    ...records.map((record) => record.id),
    ...archivedRecords.map((record) => record.id)
  ]);
  return catalog.filter((session) => !hiddenIds.has(session.id));
}

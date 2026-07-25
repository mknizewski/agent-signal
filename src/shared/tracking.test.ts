import { describe, expect, it } from "vitest";
import type { DiscoveredSession } from "./types";
import {
  createTrackingRecord,
  resolveTrackedSessions,
  untrackedSessions
} from "./tracking";

const session: DiscoveredSession = {
  id: "codex:thread-1",
  agent: "codex",
  source: "codex-app",
  title: "Napraw logowanie",
  summary: "Znajdź przyczynę błędu",
  workingDirectory: "D:\\Git\\portal",
  status: "working",
  statusText: "Aktywność wykryta w Codex",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T12:00:00.000Z",
  threadId: "thread-1"
};

describe("tracking sessions", () => {
  it("creates a durable record and resolves current live status", () => {
    const record = createTrackingRecord(
      session,
      "2026-07-24T12:01:00.000Z"
    );
    const [tracked] = resolveTrackedSessions([record], [
      { ...session, status: "attention" }
    ]);

    expect(tracked.status).toBe("attention");
    expect(tracked.available).toBe(true);
    expect(tracked.trackedAt).toBe("2026-07-24T12:01:00.000Z");
  });

  it("keeps a tracked chat visible when the source temporarily disappears", () => {
    const [tracked] = resolveTrackedSessions(
      [createTrackingRecord(session)],
      []
    );

    expect(tracked.status).toBe("unavailable");
    expect(tracked.title).toBe("Napraw logowanie");
    expect(tracked.available).toBe(false);
  });

  it("removes tracked sessions from the add-chat catalog", () => {
    const record = createTrackingRecord(session);
    expect(untrackedSessions([record], [session])).toEqual([]);
    expect(untrackedSessions([], [session])).toEqual([session]);
  });
});

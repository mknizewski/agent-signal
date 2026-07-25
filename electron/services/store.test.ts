import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TrackedSessionRecord } from "../../src/shared/types";
import { TrackingStore } from "./store";
import { DEFAULT_PREFERENCES } from "../../src/shared/preferences";

const temporaryDirectories: string[] = [];

const trackedSession: TrackedSessionRecord = {
  id: "codex:thread-1",
  agent: "codex",
  source: "codex-app",
  title: "Test session",
  summary: "",
  workingDirectory: "D:\\Git\\project",
  projectName: "project",
  pinned: false,
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T12:00:00.000Z",
  trackedAt: "2026-07-24T11:00:00.000Z",
  threadId: "thread-1"
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("TrackingStore", () => {
  it("migrates version 2 state without losing tracked sessions", async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, "agent-signal-state.json"),
      JSON.stringify({ version: 2, trackedSessions: [trackedSession] }),
      "utf8"
    );

    const state = await new TrackingStore(directory).load();

    expect(state).toEqual({
      trackedSessions: [trackedSession],
      archivedSessions: [],
      preferences: DEFAULT_PREFERENCES,
      projectGroups: []
    });
  });

  it("persists sessions, preferences, and project groups as version 5", async () => {
    const directory = await createTemporaryDirectory();
    const store = new TrackingStore(directory);
    const archived = {
      ...trackedSession,
      archivedAt: "2026-07-24T13:00:00.000Z"
    };

    await store.save({
      trackedSessions: [],
      archivedSessions: [archived],
      preferences: { ...DEFAULT_PREFERENCES, language: "en" },
      projectGroups: [
        {
          projectKey: "project",
          label: "Payments",
          symbol: "P",
          color: "#6f82e8",
          order: 0
        }
      ]
    });

    const stored = JSON.parse(
      await readFile(
        path.join(directory, "agent-signal-state.json"),
        "utf8"
      )
    ) as unknown;
    expect(stored).toEqual({
      version: 5,
      trackedSessions: [],
      archivedSessions: [archived],
      preferences: { ...DEFAULT_PREFERENCES, language: "en" },
      projectGroups: [
        {
          projectKey: "project",
          label: "Payments",
          symbol: "P",
          color: "#6f82e8",
          order: 0
        }
      ]
    });
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-signal-"));
  temporaryDirectories.push(directory);
  return directory;
}

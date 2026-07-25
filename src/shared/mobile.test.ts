import { describe, expect, it } from "vitest";
import type { AppSnapshot } from "./types";
import { createMobileSnapshot } from "./mobile";
import { DEFAULT_PREFERENCES } from "./preferences";

const snapshot: AppSnapshot = {
  trackedSessions: [
    {
      id: "codex:secret-thread-id",
      agent: "codex",
      source: "codex-app",
      title: "Bezpieczny tytuł",
      summary: "Poufne podsumowanie",
      workingDirectory: "C:\\tajny\\projekt",
      projectName: "projekt",
      status: "attention",
      statusText: "Sesja czeka na decyzję",
      createdAt: "2026-07-25T10:00:00.000Z",
      updatedAt: "2026-07-25T10:01:00.000Z",
      trackedAt: "2026-07-25T10:00:30.000Z",
      pinned: false,
      threadId: "secret-thread-id",
      available: true
    }
  ],
  archivedSessions: [],
  availableSessions: [],
  providers: {
    codex: {
      id: "codex",
      label: "Codex",
      available: true,
      source: "cli",
      detail: "lokalny szczegół",
      executable: "C:\\sekret\\codex.exe"
    },
    claude: {
      id: "claude",
      label: "Claude Code",
      available: false,
      source: "missing",
      detail: "brak"
    }
  },
  preferences: DEFAULT_PREFERENCES,
  projectGroups: [],
  pendingSessionPrompts: [],
  updatedAt: "2026-07-25T10:01:01.000Z"
};

describe("createMobileSnapshot", () => {
  it("exposes only the mobile-safe session fields", () => {
    const mobile = createMobileSnapshot(snapshot, "desktop-salt");
    const serialized = JSON.stringify(mobile);

    expect(mobile.sessions).toHaveLength(1);
    expect(mobile.sessions[0]).toMatchObject({
      agent: "codex",
      title: "Bezpieczny tytuł",
      status: "attention"
    });
    expect(mobile.sessions[0].key).not.toContain("secret-thread-id");
    expect(serialized).not.toContain("Poufne podsumowanie");
    expect(serialized).not.toContain("tajny");
    expect(serialized).not.toContain("secret-thread-id");
    expect(serialized).not.toContain("codex.exe");
    expect(mobile.counts.attention).toBe(1);
  });

  it("keeps opaque keys stable for the same installation", () => {
    expect(createMobileSnapshot(snapshot, "salt").sessions[0].key).toBe(
      createMobileSnapshot(snapshot, "salt").sessions[0].key
    );
    expect(createMobileSnapshot(snapshot, "salt").sessions[0].key).not.toBe(
      createMobileSnapshot(snapshot, "other").sessions[0].key
    );
  });
});

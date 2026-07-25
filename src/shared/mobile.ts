import { createHash } from "node:crypto";
import type {
  AppSnapshot,
  MobileSnapshot,
  SessionStatus
} from "./types";

export function createMobileSnapshot(
  snapshot: AppSnapshot,
  keySalt: string
): MobileSnapshot {
  const counts: Record<SessionStatus, number> = {
    working: 0,
    attention: 0,
    idle: 0,
    error: 0,
    unavailable: 0
  };

  const sessions = snapshot.trackedSessions.map((session) => {
    counts[session.status] += 1;
    return {
      key: createHash("sha256")
        .update(keySalt)
        .update("\0")
        .update(session.id)
        .digest("base64url")
        .slice(0, 22),
      agent: session.agent,
      title: session.title,
      status: session.status,
      statusText: session.statusText,
      updatedAt: session.updatedAt
    };
  });

  return {
    sessions,
    providers: {
      codex: {
        id: "codex",
        label: snapshot.providers.codex.label,
        available: snapshot.providers.codex.available
      },
      claude: {
        id: "claude",
        label: snapshot.providers.claude.label,
        available: snapshot.providers.claude.available
      }
    },
    counts,
    updatedAt: snapshot.updatedAt
  };
}

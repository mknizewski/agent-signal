import type { SessionStatus } from "../../src/shared/types";

export interface MobileNotificationPayload {
  title: string;
  body: string;
  status: SessionStatus;
}

export function mobileNotificationForTransition(
  before: SessionStatus | undefined,
  current: SessionStatus,
  sessionTitle: string
): MobileNotificationPayload | undefined {
  if (!before || before === current) return undefined;
  if (current === "attention") {
    return {
      title: "Agent Signal · do zatwierdzenia",
      body: sessionTitle,
      status: current
    };
  }
  if (before === "working" && current === "idle") {
    return {
      title: "Agent Signal · agent jest wolny",
      body: sessionTitle,
      status: current
    };
  }
  return undefined;
}

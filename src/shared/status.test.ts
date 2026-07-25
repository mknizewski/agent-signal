import { describe, expect, it } from "vitest";
import { formatRelativeTime, statusLabel } from "./status";

describe("session status helpers", () => {
  it("uses the requested traffic-light wording", () => {
    expect(statusLabel("working")).toBe("Pracuje");
    expect(statusLabel("attention")).toBe("Wymaga uwagi");
    expect(statusLabel("idle")).toBe("Wolny");
  });

  it("formats compact relative activity times", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    expect(formatRelativeTime("2026-07-24T11:59:55.000Z", now)).toBe(
      "przed chwilą"
    );
    expect(formatRelativeTime("2026-07-24T11:45:00.000Z", now)).toBe(
      "15 min temu"
    );
    expect(formatRelativeTime("2026-07-24T09:00:00.000Z", now)).toBe(
      "3 godz. temu"
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  COMPACT_MODE_SHORTCUT,
  isCompactModeShortcut
} from "./shortcuts";

describe("application shortcuts", () => {
  it("uses F9 to toggle compact mode", () => {
    expect(COMPACT_MODE_SHORTCUT).toBe("F9");
    expect(isCompactModeShortcut({ key: "F9", repeat: false })).toBe(true);
  });

  it("ignores held keys and unrelated shortcuts", () => {
    expect(isCompactModeShortcut({ key: "F9", repeat: true })).toBe(false);
    expect(isCompactModeShortcut({ key: "F8", repeat: false })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { claudeCodeSessionUrl } from "./claude-deep-link";

describe("Claude Desktop deep links", () => {
  it("opens a specific Claude Code session", () => {
    expect(
      claudeCodeSessionUrl("11111111-1111-4111-8111-111111111111")
    ).toBe("claude://code/11111111-1111-4111-8111-111111111111");
  });

  it("rejects values that could alter the deep-link route", () => {
    expect(() => claudeCodeSessionUrl("../new?q=unsafe")).toThrow(
      "Identyfikator sesji Claude Code jest nieprawidłowy."
    );
  });
});

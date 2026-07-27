import { describe, expect, it } from "vitest";
import {
  projectDropPositionForDirection,
  reorderProjectKeys
} from "./shared/project-order";

describe("project group ordering", () => {
  it("places a dragged project after the lower-half target", () => {
    expect(
      reorderProjectKeys(["a", "b", "c"], "a", "c", "after")
    ).toEqual(["b", "c", "a"]);
  });

  it("places a dragged project before the upper-half target", () => {
    expect(
      reorderProjectKeys(["a", "b", "c"], "c", "a", "before")
    ).toEqual(["c", "a", "b"]);
  });

  it("keeps the original array for an invalid drop", () => {
    const projectKeys = ["a", "b"];
    expect(
      reorderProjectKeys(projectKeys, "a", "missing", "after")
    ).toBe(projectKeys);
  });

  it("uses the target's lower edge when dragging down", () => {
    expect(
      projectDropPositionForDirection(["a", "b", "c"], "a", "c")
    ).toBe("after");
    expect(
      reorderProjectKeys(
        ["a", "b", "c"],
        "a",
        "c",
        projectDropPositionForDirection(["a", "b", "c"], "a", "c")!
      )
    ).toEqual(["b", "c", "a"]);
  });

  it("uses the target's upper edge when dragging up", () => {
    expect(
      projectDropPositionForDirection(["a", "b", "c"], "c", "a")
    ).toBe("before");
    expect(
      reorderProjectKeys(
        ["a", "b", "c"],
        "c",
        "a",
        projectDropPositionForDirection(["a", "b", "c"], "c", "a")!
      )
    ).toEqual(["c", "a", "b"]);
  });
});

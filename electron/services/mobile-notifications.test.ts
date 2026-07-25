import { describe, expect, it } from "vitest";
import { mobileNotificationForTransition } from "./mobile-notifications";

describe("mobileNotificationForTransition", () => {
  it("notifies when a session starts requiring attention", () => {
    expect(
      mobileNotificationForTransition("working", "attention", "Płatności")
    ).toEqual({
      title: "AgentSignal · wymaga uwagi",
      body: "Płatności",
      status: "attention"
    });
  });

  it("notifies when working changes to idle", () => {
    expect(
      mobileNotificationForTransition("working", "idle", "Płatności")
    ).toEqual({
      title: "AgentSignal · agent jest wolny",
      body: "Płatności",
      status: "idle"
    });
  });

  it("does not notify for the initial or unrelated transitions", () => {
    expect(
      mobileNotificationForTransition(undefined, "attention", "Płatności")
    ).toBeUndefined();
    expect(
      mobileNotificationForTransition("idle", "working", "Płatności")
    ).toBeUndefined();
    expect(
      mobileNotificationForTransition("attention", "attention", "Płatności")
    ).toBeUndefined();
  });
});

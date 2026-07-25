import { describe, expect, it } from "vitest";
import { MobilePairingRegistry } from "./mobile-pairing";

describe("MobilePairingRegistry", () => {
  it("accepts a fresh code exactly once", () => {
    const registry = new MobilePairingRegistry(60_000);
    const pairing = registry.create(1_000);

    expect(registry.consume(pairing.secret, 2_000)).toBe(true);
    expect(registry.consume(pairing.secret, 2_001)).toBe(false);
  });

  it("rejects an expired or unknown code", () => {
    const registry = new MobilePairingRegistry(1_000);
    const pairing = registry.create(2_000);

    expect(registry.consume(pairing.secret, 3_001)).toBe(false);
    expect(registry.consume("unknown", 2_000)).toBe(false);
  });
});

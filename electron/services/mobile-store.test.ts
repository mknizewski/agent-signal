import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEmptyMobileState,
  MobileStore,
  type MobileState
} from "./mobile-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("MobileStore", () => {
  it("creates a disabled installation identity for a missing store", async () => {
    const store = new MobileStore(await createTemporaryDirectory());
    const state = await store.load();

    expect(state.enabled).toBe(false);
    expect(state.desktopId).toBeTruthy();
    expect(state.keySalt.length).toBeGreaterThan(20);
    expect(state.devices).toEqual([]);
  });

  it("persists paired devices without changing their token hashes", async () => {
    const directory = await createTemporaryDirectory();
    const store = new MobileStore(directory);
    const base = createEmptyMobileState();
    const state: MobileState = {
      ...base,
      enabled: true,
      devices: [
        {
          id: "device-1",
          name: "Pixel",
          tokenHash: "only-a-hash",
          pairedAt: "2026-07-25T10:00:00.000Z",
          lastSeenAt: "2026-07-25T10:01:00.000Z"
        }
      ]
    };

    await store.save(state);

    expect(await store.load()).toEqual(state);
    const raw = await readFile(
      path.join(directory, "agent-signal-mobile.json"),
      "utf8"
    );
    expect(raw).toContain("only-a-hash");
  });

  it("recovers from malformed state", async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, "agent-signal-mobile.json"),
      "{broken",
      "utf8"
    );

    const state = await new MobileStore(directory).load();

    expect(state.enabled).toBe(false);
    expect(state.devices).toEqual([]);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-mobile-"));
  temporaryDirectories.push(directory);
  return directory;
}

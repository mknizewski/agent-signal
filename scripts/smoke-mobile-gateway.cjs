const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const https = require("node:https");
const createMulticastDns = require("multicast-dns");
const os = require("node:os");
const path = require("node:path");

const { MobileGateway } = require("../dist-electron/electron/services/mobile-gateway.js");
const { MobileStore } = require("../dist-electron/electron/services/mobile-store.js");

async function main() {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "agent-signal-mobile-smoke-")
  );
  let gateway;
  try {
    gateway = new MobileGateway({
      store: new MobileStore(temporaryDirectory),
      assetRoot: path.join(__dirname, "..", "dist"),
      protector: {
        protect: (value) => Buffer.from(value, "utf8").toString("base64"),
        unprotect: (value) => Buffer.from(value, "base64").toString("utf8")
      },
      onStatus: () => undefined,
      onDiagnostic: (message, error) => {
        if (error) console.warn(message, error);
      }
    });
    await gateway.initialize();
    await gateway.setEnabled(true);
    gateway.publishSnapshot(mockSnapshot());

    const status = gateway.getStatus();
    assert.equal(status.running, true);
    assert.ok(status.address);
    await assertMdnsAddress(status.hostname, status.address);
    const pairing = await gateway.createPairing();
    const pairingUrl = new URL(pairing.pairingUrl);
    assert.equal(pairingUrl.hostname, status.address);
    assert.equal(pairingUrl.protocol, "https:");
    const secret = pairingUrl.hash.replace("#pair=", "");
    assert.ok(secret);

    const paired = await request(status.address, "/api/v1/pair", {
      method: "POST",
      body: JSON.stringify({ secret, name: "Smoke Android" }),
      headers: {
        "Content-Type": "application/json",
        Origin: `https://${status.address}:47831`
      }
    });
    assert.equal(paired.statusCode, 200);
    const cookie = paired.headers["set-cookie"]?.[0]?.split(";")[0];
    assert.ok(cookie);

    const snapshotResponse = await request(
      status.address,
      "/api/v1/snapshot",
      { headers: { Cookie: cookie } }
    );
    assert.equal(snapshotResponse.statusCode, 200);
    const snapshot = JSON.parse(snapshotResponse.body);
    assert.equal(snapshot.sessions[0].title, "Mobilny smoke test");
    assert.equal(snapshot.sessions[0].status, "working");
    assert.equal(JSON.stringify(snapshot).includes("C:\\secret"), false);
    assert.equal(JSON.stringify(snapshot).includes("source-thread-id"), false);

    const mobilePage = await request(status.address, "/");
    assert.equal(mobilePage.statusCode, 200);
    assert.match(mobilePage.body, /AgentSignal Mobile/);
    console.log(
      `Mobile gateway smoke test passed at ${status.origin} (${status.address}).`
    );
  } finally {
    await gateway?.stop();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function assertMdnsAddress(hostname, expectedAddress) {
  return new Promise((resolve, reject) => {
    const mdns = createMulticastDns({
      interface: expectedAddress,
      type: "udp4",
      loopback: true
    });
    const timer = setTimeout(() => {
      mdns.destroy();
      reject(new Error(`mDNS did not resolve ${hostname}`));
    }, 5_000);
    const finish = (error) => {
      clearTimeout(timer);
      mdns.destroy();
      error ? reject(error) : resolve();
    };
    mdns.on("response", (response) => {
      const answer = response.answers.find(
        (item) => item.name === hostname && item.type === "A"
      );
      if (!answer) return;
      finish(
        answer.data === expectedAddress
          ? undefined
          : new Error(`mDNS returned ${answer.data}, expected ${expectedAddress}`)
      );
    });
    mdns.once("error", finish);
    mdns.once("ready", () => {
      mdns.query([{ name: hostname, type: "A" }]);
    });
  });
}

function request(hostname, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ?? "";
    const request = https.request(
      {
        hostname,
        port: 47831,
        path: requestPath,
        method: options.method ?? "GET",
        rejectUnauthorized: false,
        headers: {
          ...(options.headers ?? {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {})
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8")
          })
        );
      }
    );
    request.once("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function mockSnapshot() {
  return {
    trackedSessions: [
      {
        id: "codex:source-thread-id",
        agent: "codex",
        source: "codex-app",
        title: "Mobilny smoke test",
        summary: "private summary",
        workingDirectory: "C:\\secret",
        status: "working",
        statusText: "Agent wykonuje zadanie",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trackedAt: new Date().toISOString(),
        threadId: "source-thread-id",
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
        detail: "private",
        executable: "C:\\secret\\codex.exe"
      },
      claude: {
        id: "claude",
        label: "Claude Code",
        available: false,
        source: "missing",
        detail: "private"
      }
    },
    updatedAt: new Date().toISOString()
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

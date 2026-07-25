const {
  ExternalSessionSync
} = require("../dist-electron/electron/services/external-session-sync.js");
const {
  detectProviders
} = require("../dist-electron/electron/services/detector.js");

async function main() {
  const providers = detectProviders();
  let sessions = [];
  let subagents = [];
  const diagnostics = [];
  const inspectedThreadId = process.env.AGENT_SIGNAL_SMOKE_THREAD_ID;

  const sync = new ExternalSessionSync({
    getCodexExecutable: () => providers.codex.executable,
    getTrackedCodexThreadIds: () =>
      inspectedThreadId ? [inspectedThreadId] : [],
    onSessions: (nextSessions, nextSubagents = []) => {
      sessions = nextSessions;
      subagents = nextSubagents;
    },
    onDiagnostic: (message, error) => {
      diagnostics.push(`${message} ${error?.message ?? ""}`.trim());
    }
  });

  try {
    await sync.start();
  } finally {
    await sync.stop();
  }

  const codex = sessions.filter(
    (session) => session.source === "codex-app"
  ).length;
  const claude = sessions.filter(
    (session) => session.source === "claude-code"
  ).length;

  console.log(
    JSON.stringify({
      type: "external-session-sync",
      total: sessions.length,
      codex,
      claude,
      subagents: subagents.length,
      codexExecutable: providers.codex.executable,
      claudeAvailable: providers.claude.available,
      inspectedStatus: inspectedThreadId
        ? sessions.find(
            (session) => session.threadId === inspectedThreadId
          )?.status
        : undefined,
      diagnostics
    })
  );

  if (providers.codex.available && codex === 0) {
    throw new Error(
      "Codex jest dostępny, ale synchronizacja nie odczytała żadnej sesji."
    );
  }
}

main().catch((error) => {
  console.error(`EXTERNAL_SYNC_SMOKE_FAILED: ${error.message}`);
  process.exit(1);
});

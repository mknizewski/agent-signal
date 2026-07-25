import {
  spawn,
  type ChildProcessWithoutNullStreams
} from "node:child_process";
import readline from "node:readline";
import type {
  DiscoveredSession,
  SessionSubagent
} from "../../src/shared/types";
import {
  isCodexSubagentThread,
  mapCodexSubagent,
  mapClaudeSession,
  mapCodexThread,
  type ClaudeExternalSession,
  type CodexExternalThread
} from "../../src/shared/external-sessions";
import { CodexSessionLogTracker } from "./codex-session-log";

type JsonRpcId = string | number;

interface JsonRpcMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string };
}

interface ClaudeSessionSdk {
  listSessions(options?: {
    dir?: string;
    limit?: number;
    offset?: number;
    includeWorktrees?: boolean;
    includeProgrammatic?: boolean;
  }): Promise<ClaudeExternalSession[]>;
}

interface ExternalSessionSyncOptions {
  getCodexExecutable(): string | undefined;
  getTrackedCodexThreadIds(): string[];
  onSessions(
    sessions: DiscoveredSession[],
    subagents: SessionSubagent[]
  ): void;
  onDiagnostic?(message: string, error?: unknown): void;
}

const importClaudeSdk = new Function(
  "return import('@anthropic-ai/claude-agent-sdk')"
) as () => Promise<ClaudeSessionSdk>;

const SYNC_INTERVAL_MS = 5_000;
const EXTERNAL_SESSION_LIMIT = 100;
const CODEX_SOURCE_KINDS = [
  "cli",
  "vscode",
  "exec",
  "appServer",
  "unknown"
];
const CODEX_SUBAGENT_SOURCE_KINDS = ["subAgentThreadSpawn"];

export class ExternalSessionSync {
  private codexClient?: CodexHistoryClient;
  private codexExecutable?: string;
  private codexSessions: DiscoveredSession[] = [];
  private codexSubagents: SessionSubagent[] = [];
  private claudeSessions: DiscoveredSession[] = [];
  private readonly codexLogs = new CodexSessionLogTracker();
  private timer?: NodeJS.Timeout;
  private refreshPromise?: Promise<void>;
  private stopped = false;

  constructor(private readonly options: ExternalSessionSyncOptions) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.stopped = false;
    await this.refreshNow();
    if (this.stopped) return;
    this.timer = setInterval(() => {
      void this.refreshNow();
    }, SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  refreshNow(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.refreshPromise?.catch(() => undefined);
    this.codexClient?.close();
    this.codexClient = undefined;
  }

  private async refresh(): Promise<void> {
    await Promise.all([this.refreshCodex(), this.refreshClaude()]);
    if (this.stopped) return;

    const sessions = [...this.codexSessions, ...this.claudeSessions].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime()
    );
    this.options.onSessions(sessions, this.codexSubagents);
  }

  private async refreshCodex(): Promise<void> {
    const executable = this.options.getCodexExecutable();
    if (!executable) {
      this.codexSessions = [];
      this.codexSubagents = [];
      this.codexClient?.close();
      this.codexClient = undefined;
      this.codexExecutable = undefined;
      return;
    }

    if (!this.codexClient || this.codexExecutable !== executable) {
      this.codexClient?.close();
      this.codexClient = new CodexHistoryClient(executable);
      this.codexExecutable = executable;
    }

    try {
      const [threads, subagentThreads] = await Promise.all([
        this.codexClient.listThreads(CODEX_SOURCE_KINDS),
        this.codexClient.listSubagentThreads()
      ]);
      const enrichedThreads = await this.codexLogs.enrich(
        threads.filter((thread) => !isCodexSubagentThread(thread)),
        this.options.getTrackedCodexThreadIds()
      );
      this.codexSessions = enrichedThreads.map((thread) =>
        mapCodexThread(thread)
      );
      this.codexSubagents = subagentThreads
        .map((thread) => mapCodexSubagent(thread))
        .filter(
          (subagent): subagent is SessionSubagent => Boolean(subagent)
        );
    } catch (error) {
      this.options.onDiagnostic?.(
        "Nie udało się zsynchronizować historii Codexa.",
        error
      );
      this.codexClient.close();
      this.codexClient = undefined;
    }
  }

  private async refreshClaude(): Promise<void> {
    try {
      const sdk = await importClaudeSdk();
      const sessions = await sdk.listSessions({
        limit: EXTERNAL_SESSION_LIMIT,
        includeProgrammatic: true
      });
      this.claudeSessions = sessions
        .filter((session) => session.tag !== "__hidden")
        .map((session) => mapClaudeSession(session));
    } catch (error) {
      this.options.onDiagnostic?.(
        "Nie udało się zsynchronizować historii Claude Code.",
        error
      );
    }
  }
}

class CodexHistoryClient {
  private process?: ChildProcessWithoutNullStreams;
  private lines?: readline.Interface;
  private nextRequestId = 1;
  private ready?: Promise<void>;
  private pending = new Map<
    JsonRpcId,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private readonly executable: string) {}

  async listSubagentThreads(): Promise<CodexExternalThread[]> {
    try {
      return await this.listThreads(CODEX_SUBAGENT_SOURCE_KINDS);
    } catch {
      // Older App Server versions do not recognize subagent source filters.
      return [];
    }
  }

  async listThreads(
    sourceKinds: string[] = CODEX_SOURCE_KINDS
  ): Promise<CodexExternalThread[]> {
    await this.ensureReady();

    const threads: CodexExternalThread[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 4; page += 1) {
      const result = (await this.request("thread/list", {
        cursor,
        limit: EXTERNAL_SESSION_LIMIT,
        sortKey: "updated_at",
        sortDirection: "desc",
        sourceKinds
      })) as {
        data?: CodexExternalThread[];
        nextCursor?: string | null;
      };

      threads.push(...(result.data ?? []));
      cursor = result.nextCursor ?? null;
      if (!cursor) break;
    }

    return threads;
  }

  close(): void {
    const child = this.process;
    this.lines?.close();
    this.lines = undefined;
    this.process = undefined;
    this.ready = undefined;
    this.rejectPending(new Error("Połączenie z historią Codexa zostało zamknięte."));
    if (!child || child.killed) return;
    child.stdin.end();
    setTimeout(() => {
      if (!child.killed) child.kill();
    }, 500).unref();
  }

  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = this.connect().catch((error) => {
      this.ready = undefined;
      throw error;
    });
    return this.ready;
  }

  private async connect(): Promise<void> {
    this.process = spawn(
      this.executable,
      ["app-server", "--listen", "stdio://"],
      {
        env: process.env,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    this.lines = readline.createInterface({ input: this.process.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    this.process.stderr.resume();
    this.process.once("error", (error) => {
      this.rejectPending(error);
    });
    this.process.once("close", (code) => {
      this.ready = undefined;
      this.process = undefined;
      this.rejectPending(
        new Error(
          `Codex app-server zakończył synchronizację (kod ${code ?? "?"}).`
        )
      );
    });

    await this.request("initialize", {
      clientInfo: {
        name: "agent_signal_sync",
        title: "Agent Signal Sync",
        version: "0.6.1"
      },
      capabilities: { experimentalApi: true }
    });
    this.notify("initialized", {});
  }

  private handleLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(
          new Error(message.error.message ?? "Błąd synchronizacji Codexa")
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.write({
        id: message.id,
        error: {
          code: -32601,
          message: `Agent Signal Sync nie obsługuje żądania ${message.method}.`
        }
      });
    }
  }

  private request(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const id = this.nextRequestId++;
    this.write({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Przekroczono czas odpowiedzi Codexa: ${method}`));
      }, 8_000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.write({ method, params });
  }

  private write(message: JsonRpcMessage): void {
    if (!this.process?.stdin.writable) {
      throw new Error("Codex app-server nie jest połączony.");
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

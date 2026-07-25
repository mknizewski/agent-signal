import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ProviderStatus } from "../../src/shared/types";

function executableFromPath(name: string): string | undefined {
  try {
    const command = process.platform === "win32" ? "where.exe" : "which";
    const output = execFileSync(command, [name], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 3_000
    });
    return output
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
  } catch {
    return undefined;
  }
}

function executableVersion(executable: string): string | undefined {
  try {
    const output = execFileSync(executable, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000
    });
    return output.trim().split(/\r?\n/)[0];
  } catch {
    return undefined;
  }
}

export function resolveCodexExecutable(): string | undefined {
  const override = process.env.AGENT_SIGNAL_CODEX_PATH;
  if (override && existsSync(override)) return override;

  const fromCodexApp = resolveCodexAppExecutable();
  if (fromCodexApp) return fromCodexApp;

  const fromPath = executableFromPath("codex");
  if (fromPath) return fromPath;

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const bundled = path.join(
      process.env.LOCALAPPDATA,
      "Programs",
      "OpenAI",
      "Codex",
      "bin",
      "codex.exe"
    );
    if (existsSync(bundled)) return bundled;
  }

  return undefined;
}

export function resolveClaudeExecutable(): string | undefined {
  const override = process.env.AGENT_SIGNAL_CLAUDE_PATH;
  if (override && existsSync(override)) return override;
  return executableFromPath("claude");
}

function resolveCodexAppExecutable(): string | undefined {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) {
    return undefined;
  }

  const binRoot = path.join(
    process.env.LOCALAPPDATA,
    "OpenAI",
    "Codex",
    "bin"
  );
  try {
    const candidates = readdirSync(binRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(binRoot, entry.name, "codex.exe"))
      .filter((candidate) => existsSync(candidate))
      .map((candidate) => ({
        candidate,
        modifiedAt: statSync(candidate).mtimeMs
      }))
      .sort((left, right) => right.modifiedAt - left.modifiedAt);
    return candidates[0]?.candidate;
  } catch {
    return undefined;
  }
}

function hasClaudeSessionStore(): boolean {
  if (!process.env.USERPROFILE) return false;
  const projectsRoot = path.join(
    process.env.USERPROFILE,
    ".claude",
    "projects"
  );

  try {
    return readdirSync(projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .some((project) =>
        readdirSync(path.join(projectsRoot, project.name), {
          withFileTypes: true
        }).some((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      );
  } catch {
    return false;
  }
}

export function detectProviders(): Record<"codex" | "claude", ProviderStatus> {
  const codexExecutable = resolveCodexExecutable();
  const claudeExecutable = resolveClaudeExecutable();
  const claudeSessionsAvailable = hasClaudeSessionStore();
  const claudeAvailable = Boolean(claudeExecutable) || claudeSessionsAvailable;

  return {
    codex: {
      id: "codex",
      label: "Codex",
      available: Boolean(codexExecutable),
      executable: codexExecutable,
      version: codexExecutable ? executableVersion(codexExecutable) : undefined,
      source: codexExecutable ? "cli" : "missing",
      detail: codexExecutable
        ? "Połączono z lokalną historią Codexa"
        : "Nie znaleziono Codex CLI"
    },
    claude: {
      id: "claude",
      label: "Claude Code",
      available: claudeAvailable,
      executable: claudeExecutable,
      version: claudeExecutable
        ? executableVersion(claudeExecutable)
        : undefined,
      source: claudeExecutable
        ? "cli"
        : claudeSessionsAvailable
          ? "sdk"
          : "missing",
      detail: claudeExecutable
        ? "Wykryto Claude Code CLI i lokalne sesje"
        : claudeSessionsAvailable
          ? "Wykryto lokalne sesje Claude Code"
          : "Nie znaleziono Claude Code ani lokalnych sesji"
    }
  };
}

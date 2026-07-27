const CLAUDE_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function claudeCodeSessionUrl(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!CLAUDE_SESSION_ID_PATTERN.test(normalized)) {
    throw new Error("Identyfikator sesji Claude Code jest nieprawidłowy.");
  }
  return `claude://code/${encodeURIComponent(normalized)}`;
}

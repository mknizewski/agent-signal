import { Eye, X } from "lucide-react";
import type {
  AppLanguage,
  DiscoveredSession
} from "../shared/types";
import { copyFor } from "../lib/i18n";
import { AgentMark } from "./AgentMark";

interface NewSessionPromptProps {
  session: DiscoveredSession;
  language: AppLanguage;
  onObserve(sessionId: string): void;
  onDismiss(sessionId: string): void;
}

export function NewSessionPrompt({
  session,
  language,
  onObserve,
  onDismiss
}: NewSessionPromptProps) {
  const copy = copyFor(language);
  return (
    <aside
      className="new-session-prompt"
      role="status"
      aria-live="polite"
    >
      <button
        className="new-session-prompt__close"
        type="button"
        title={copy.prompt.dismiss}
        aria-label={copy.prompt.dismiss}
        onClick={() => onDismiss(session.id)}
      >
        <X size={14} />
      </button>
      <AgentMark agent={session.agent} />
      <div>
        <span className="eyebrow">{copy.prompt.eyebrow}</span>
        <strong>{copy.prompt.title}</strong>
        <p>
          {copy.prompt.description}: <b>{session.title}</b>
        </p>
        <small>
          {session.projectName || copy.common.noProject} ·{" "}
          {session.agent === "codex"
            ? copy.common.codex
            : copy.common.claude}
        </small>
      </div>
      <div className="new-session-prompt__actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => onDismiss(session.id)}
        >
          {copy.prompt.dismiss}
        </button>
        <button
          className="button button--primary"
          type="button"
          onClick={() => onObserve(session.id)}
        >
          <Eye size={14} />
          {copy.prompt.observe}
        </button>
      </div>
    </aside>
  );
}

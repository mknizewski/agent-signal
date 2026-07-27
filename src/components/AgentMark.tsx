import { Asterisk } from "lucide-react";
import type { AgentKind } from "../shared/types";

interface AgentMarkProps {
  agent: AgentKind;
  size?: "small" | "large";
}

export function AgentMark({ agent, size = "small" }: AgentMarkProps) {
  return (
    <span
      className={`agent-mark agent-mark--${agent} agent-mark--${size}`}
      aria-label={agent === "codex" ? "Codex" : "Claude"}
    >
      {agent === "codex" ? (
        <svg
          aria-hidden="true"
          className="agent-mark__codex-symbol"
          viewBox="0 0 24 24"
          width={size === "large" ? 21 : 17}
          height={size === "large" ? 21 : 17}
        >
          <path
            d="M12 3.2a4.7 4.7 0 0 1 4.15 2.5 4.72 4.72 0 0 1 3.93 6.88 4.72 4.72 0 0 1-3.94 6.88A4.72 4.72 0 0 1 8.1 19.4a4.72 4.72 0 0 1-3.94-6.88A4.72 4.72 0 0 1 8.1 5.65 4.7 4.7 0 0 1 12 3.2Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.65"
          />
          <path
            d="m8.2 9.9 3.8-2.2 3.8 2.2v4.3L12 16.4l-3.8-2.2V9.9Zm0 0 3.8 2.2 3.8-2.2M12 12.1v4.3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.45"
          />
        </svg>
      ) : (
        <Asterisk size={size === "large" ? 21 : 17} strokeWidth={1.9} />
      )}
    </span>
  );
}

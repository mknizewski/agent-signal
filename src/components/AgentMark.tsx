import { Asterisk, Terminal } from "lucide-react";
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
        <Terminal size={size === "large" ? 19 : 15} strokeWidth={1.8} />
      ) : (
        <Asterisk size={size === "large" ? 21 : 17} strokeWidth={1.9} />
      )}
    </span>
  );
}

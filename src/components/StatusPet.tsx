import type { AgentKind, SessionStatus } from "../shared/types";
import { statusLabel } from "../shared/status";

interface StatusPetProps {
  agent: AgentKind;
  status: SessionStatus;
  size?: "small" | "large";
}

export function StatusPet({
  agent,
  status,
  size = "small"
}: StatusPetProps) {
  const agentLabel = agent === "codex" ? "Codex" : "Claude";

  return (
    <span
      className={`status-pet status-pet--${agent} status-pet--${status} status-pet--${size}`}
      role="img"
      aria-label={`${agentLabel}: ${statusLabel(status)}`}
    >
      <span className="status-pet__body">
        {agent === "codex" && <i className="status-pet__antenna" />}
        <i className="status-pet__eye status-pet__eye--left" />
        <i className="status-pet__eye status-pet__eye--right" />
        <i className="status-pet__mouth" />
      </span>
      {status === "attention" && (
        <i className="status-pet__wave" aria-hidden="true" />
      )}
      {status === "working" && (
        <span className="status-pet__work" aria-hidden="true">
          <i className="status-pet__work-item status-pet__work-item--laptop">
            <i className="status-pet__laptop" />
          </i>
          <i className="status-pet__work-item status-pet__work-item--screwdriver">
            <i className="status-pet__screwdriver" />
          </i>
          <i className="status-pet__work-item status-pet__work-item--hammer">
            <i className="status-pet__hammer" />
          </i>
        </span>
      )}
      <i className="status-pet__signal" />
    </span>
  );
}

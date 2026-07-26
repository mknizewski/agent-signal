import type {
  AgentKind,
  AppLanguage,
  SessionStatus
} from "../shared/types";
import { statusLabel } from "../shared/status";

interface StatusPetProps {
  agent: AgentKind;
  status: SessionStatus;
  size?: "mini" | "small" | "large";
  sleeping?: boolean;
  manager?: boolean;
  motion?: "dashboard" | "compact";
  language?: AppLanguage;
}

export function StatusPet({
  agent,
  status,
  size = "small",
  sleeping = false,
  manager = false,
  motion = "dashboard",
  language = "pl"
}: StatusPetProps) {
  const agentLabel = agent === "codex" ? "Codex" : "Claude";
  const compactMotion = motion === "compact";

  return (
    <span
      className={`status-pet status-pet--${agent} status-pet--${status} status-pet--${size} ${
        sleeping ? "status-pet--sleeping" : ""
      } ${manager ? "status-pet--manager" : ""} ${
        compactMotion ? "status-pet--compact-motion" : ""
      }`}
      role="img"
      aria-label={`${agentLabel}: ${statusLabel(status, language)}`}
    >
      <span className="status-pet__body">
        {agent === "codex" && <i className="status-pet__antenna" />}
        <i className="status-pet__eye status-pet__eye--left" />
        <i className="status-pet__eye status-pet__eye--right" />
        <i className="status-pet__mouth" />
      </span>
      {sleeping && (
        <span
          className="status-pet__sleep"
          aria-hidden="true"
        >
          <i>z</i>
          <i>z</i>
          <i>z</i>
        </span>
      )}
      {!compactMotion && !sleeping && status === "attention" && (
        <i className="status-pet__wave" aria-hidden="true" />
      )}
      {!compactMotion && !sleeping && manager && (
        <span className="status-pet__manager" aria-hidden="true">
          <i className="status-pet__manager-tie" />
          <i className="status-pet__manager-clipboard" />
          <i className="status-pet__manager-pointer" />
        </span>
      )}
      {!compactMotion && !sleeping && status === "working" && !manager && (
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

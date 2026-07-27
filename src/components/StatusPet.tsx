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
  presenceOnly?: boolean;
  motion?: "dashboard" | "compact";
  language?: AppLanguage;
  ariaLabel?: string;
}

export function StatusPet({
  agent,
  status,
  size = "small",
  sleeping = false,
  presenceOnly = false,
  motion = "dashboard",
  language = "pl",
  ariaLabel
}: StatusPetProps) {
  const agentLabel = agent === "codex" ? "Codex" : "Claude";
  const compactMotion = motion === "compact";
  const isSleeping = sleeping && !presenceOnly;

  return (
    <span
      className={`status-pet status-pet--${agent} status-pet--${status} status-pet--${size} ${
        isSleeping ? "status-pet--sleeping" : ""
      } ${presenceOnly ? "status-pet--presence" : ""} ${
        compactMotion ? "status-pet--compact-motion" : ""
      }`}
      role="img"
      aria-label={
        ariaLabel || `${agentLabel}: ${statusLabel(status, language)}`
      }
    >
      <span className="status-pet__body">
        {agent === "codex" && <i className="status-pet__antenna" />}
        <i className="status-pet__eye status-pet__eye--left" />
        <i className="status-pet__eye status-pet__eye--right" />
        <i className="status-pet__mouth" />
      </span>
      {isSleeping && (
        <span
          className="status-pet__sleep"
          aria-hidden="true"
        >
          <i>z</i>
          <i>z</i>
          <i>z</i>
        </span>
      )}
      {!presenceOnly &&
        !compactMotion &&
        !isSleeping &&
        status === "attention" && (
        <i className="status-pet__wave" aria-hidden="true" />
      )}
      {!presenceOnly &&
        !compactMotion &&
        !isSleeping &&
        status === "working" && (
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

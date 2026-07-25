import { useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ExternalLink
} from "lucide-react";
import type {
  AppLanguage,
  SessionStatus,
  SessionSubagent
} from "../shared/types";
import { copyFor } from "../lib/i18n";
import { StatusPet } from "./StatusPet";

interface SubagentTeamPanelProps {
  subagents: SessionSubagent[];
  language: AppLanguage;
  onOpen(threadId: string): void;
}

const MAX_VISIBLE_SUBAGENTS = 8;

export function SubagentTeamPanel({
  subagents,
  language,
  onOpen
}: SubagentTeamPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const copy = copyFor(language);
  const workingCount = subagents.filter((subagent) =>
    ["working", "attention"].includes(subagent.status)
  ).length;
  const visibleSubagents = subagents.slice(0, MAX_VISIBLE_SUBAGENTS);
  const hiddenCount = Math.max(0, subagents.length - visibleSubagents.length);

  return (
    <section
      className={`subagent-team ${collapsed ? "is-collapsed" : ""}`}
      aria-label={copy.subagents.title}
    >
      <button
        className="subagent-team__header"
        type="button"
        title={
          collapsed ? copy.subagents.expand : copy.subagents.collapse
        }
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="subagent-team__manager">
          <BriefcaseBusiness size={13} />
        </span>
        <span>
          <strong>{copy.subagents.title}</strong>
          <small>
            {copy.subagents.summary(workingCount, subagents.length)}
          </small>
        </span>
        <ChevronDown
          className={collapsed ? "is-collapsed" : ""}
          size={14}
        />
      </button>

      {!collapsed && (
        <div className="subagent-team__list">
          {visibleSubagents.map((subagent) => (
            <button
              className={`subagent-card subagent-card--${subagent.status}`}
              type="button"
              key={subagent.id}
              title={`${copy.subagents.open}: ${subagent.title}`}
              aria-label={`${copy.subagents.open}: ${subagent.title}`}
              onClick={() => onOpen(subagent.threadId)}
            >
              <StatusPet
                agent="codex"
                status={subagent.status}
                size="mini"
                language={language}
              />
              <span className="subagent-card__identity">
                <strong>{subagent.title}</strong>
                <small>
                  {subagent.role || copy.subagents.roleFallback}
                </small>
              </span>
              <span
                className={`subagent-card__status subagent-card__status--${subagent.status}`}
              >
                {subagentStatusLabel(subagent.status, copy.subagents)}
              </span>
              <ExternalLink size={12} />
            </button>
          ))}
          {hiddenCount > 0 && (
            <span className="subagent-team__more">
              {copy.subagents.more(hiddenCount)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function subagentStatusLabel(
  status: SessionStatus,
  copy: ReturnType<typeof copyFor>["subagents"]
): string {
  if (status === "working") return copy.working;
  if (status === "attention") return copy.attention;
  if (status === "idle") return copy.idle;
  if (status === "error") return copy.error;
  return copy.unavailable;
}

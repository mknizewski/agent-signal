import type { AppLanguage, SessionStatus } from "./types";

export const SIGNAL_ORDER: SessionStatus[] = [
  "attention",
  "working",
  "idle",
  "error",
  "unavailable"
];

export function statusLabel(
  status: SessionStatus,
  language: AppLanguage = "pl"
): string {
  const labels: Record<AppLanguage, Record<SessionStatus, string>> = {
    pl: {
      working: "Pracuje",
      attention: "Do zatwierdzenia",
      idle: "Wolny",
      error: "Błąd",
      unavailable: "Niedostępny"
    },
    en: {
      working: "Working",
      attention: "Approval needed",
      idle: "Idle",
      error: "Error",
      unavailable: "Unavailable"
    }
  };
  return labels[language][status];
}

export function statusDescription(
  status: SessionStatus,
  language: AppLanguage = "pl"
): string {
  const descriptions: Record<
    AppLanguage,
    Record<SessionStatus, string>
  > = {
    pl: {
      working: "Agent wykonuje zadanie",
      attention: "Sesja czeka na zatwierdzenie lub odpowiedź",
      idle: "Agent nie wykonuje teraz pracy",
      error: "Sesja zgłosiła problem",
      unavailable: "Sesja nie jest obecnie widoczna"
    },
    en: {
      working: "The agent is working",
      attention: "The session is waiting for approval or input",
      idle: "The agent is not working right now",
      error: "The session reported a problem",
      unavailable: "The session is not currently visible"
    }
  };
  return descriptions[language][status];
}

export function formatRelativeTime(
  value: string,
  now = new Date(),
  language: AppLanguage = "pl"
): string {
  const difference = Math.max(0, now.getTime() - new Date(value).getTime());
  const seconds = Math.floor(difference / 1_000);
  if (seconds < 10) return language === "pl" ? "przed chwilą" : "just now";
  if (seconds < 60) {
    return language === "pl" ? `${seconds} s temu` : `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return language === "pl" ? `${minutes} min temu` : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return language === "pl" ? `${hours} godz. temu` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return language === "pl" ? `${days} d temu` : `${days}d ago`;
  }

  return new Intl.DateTimeFormat(language === "pl" ? "pl-PL" : "en-GB", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

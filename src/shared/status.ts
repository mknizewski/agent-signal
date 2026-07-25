import type { SessionStatus } from "./types";

export const SIGNAL_ORDER: SessionStatus[] = [
  "attention",
  "working",
  "idle",
  "error",
  "unavailable"
];

export function statusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    working: "Pracuje",
    attention: "Wymaga uwagi",
    idle: "Wolny",
    error: "Błąd",
    unavailable: "Niedostępny"
  };
  return labels[status];
}

export function statusDescription(status: SessionStatus): string {
  const descriptions: Record<SessionStatus, string> = {
    working: "Agent wykonuje zadanie",
    attention: "Sesja czeka na Twoją decyzję",
    idle: "Agent nie wykonuje teraz pracy",
    error: "Sesja zgłosiła problem",
    unavailable: "Sesja nie jest obecnie widoczna"
  };
  return descriptions[status];
}

export function formatRelativeTime(value: string, now = new Date()): string {
  const difference = Math.max(0, now.getTime() - new Date(value).getTime());
  const seconds = Math.floor(difference / 1_000);
  if (seconds < 10) return "przed chwilą";
  if (seconds < 60) return `${seconds} s temu`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d temu`;

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

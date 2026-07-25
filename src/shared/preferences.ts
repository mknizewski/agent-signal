import type { AppPreferences } from "./types";

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: "pl",
  groupTrackedByProject: true,
  autoGroupProjects: true,
  groupPickerByProject: true,
  openChatOnDoubleClick: true,
  enablePinning: true,
  watchedSidebarExpanded: true,
  idlePetAnimation: true,
  idleAfterMinutes: 15,
  detectNewSessions: true,
  promptForNewSessions: true,
  systemNotifications: true
};

export function normalizePreferences(
  value: Partial<AppPreferences> | undefined
): AppPreferences {
  const source = value ?? {};
  return {
    ...DEFAULT_PREFERENCES,
    ...source,
    language: source.language === "en" ? "en" : "pl",
    idleAfterMinutes: clampIdleMinutes(source.idleAfterMinutes)
  };
}

export function projectNameFromPath(value: string): string {
  const normalized = value.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? "";
}

export function isSessionSleeping(
  status: "working" | "attention" | "idle" | "error" | "unavailable",
  updatedAt: string,
  now: Date,
  preferences: AppPreferences
): boolean {
  if (!preferences.idlePetAnimation) return false;
  if (status !== "idle" && status !== "unavailable") return false;
  return (
    now.getTime() - new Date(updatedAt).getTime() >=
    preferences.idleAfterMinutes * 60_000
  );
}

function clampIdleMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.idleAfterMinutes;
  }
  return Math.min(120, Math.max(1, Math.round(value)));
}

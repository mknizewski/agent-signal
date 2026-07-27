export const COMPACT_MODE_SHORTCUT = "F9";

export function isCompactModeShortcut(event: Pick<KeyboardEvent, "key" | "repeat">) {
  return event.key === COMPACT_MODE_SHORTCUT && !event.repeat;
}

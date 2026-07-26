export const APPROVAL_NOTIFICATION_DELAY_MS = 10_000;

export class NotificationDebouncer {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly delayMs: number) {}

  schedule(key: string, callback: () => void): void {
    if (this.timers.has(key)) return;
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, this.delayMs);
    timer.unref();
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(key);
  }

  cancelExcept(keys: ReadonlySet<string>): void {
    for (const key of this.timers.keys()) {
      if (!keys.has(key)) this.cancel(key);
    }
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

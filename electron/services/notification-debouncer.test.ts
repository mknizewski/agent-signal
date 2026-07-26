import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationDebouncer } from "./notification-debouncer";

afterEach(() => {
  vi.useRealTimers();
});

describe("NotificationDebouncer", () => {
  it("waits for the configured delay before notifying", () => {
    vi.useFakeTimers();
    const notify = vi.fn();
    const debouncer = new NotificationDebouncer(10_000);

    debouncer.schedule("session-1", notify);
    vi.advanceTimersByTime(9_999);
    expect(notify).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("cancels a notification when the state resolves during the delay", () => {
    vi.useFakeTimers();
    const notify = vi.fn();
    const debouncer = new NotificationDebouncer(10_000);

    debouncer.schedule("session-1", notify);
    debouncer.cancel("session-1");
    vi.advanceTimersByTime(10_000);

    expect(notify).not.toHaveBeenCalled();
  });

  it("keeps only one pending notification per session", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const duplicate = vi.fn();
    const debouncer = new NotificationDebouncer(10_000);

    debouncer.schedule("session-1", first);
    debouncer.schedule("session-1", duplicate);
    vi.advanceTimersByTime(10_000);

    expect(first).toHaveBeenCalledOnce();
    expect(duplicate).not.toHaveBeenCalled();
  });
});

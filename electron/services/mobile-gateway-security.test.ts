import { describe, expect, it } from "vitest";
import { parsePushSubscription } from "./mobile-gateway";

const keys = {
  p256dh: "test-public-key",
  auth: "test-auth-secret"
};

describe("mobile gateway push subscription validation", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/subscription",
    "https://updates.push.services.mozilla.com/wpush/v2/subscription",
    "https://web.push.apple.com/QM/subscription",
    "https://wns2-db5p.notify.windows.com/w/?token=subscription"
  ])("accepts a trusted browser push endpoint: %s", (endpoint) => {
    expect(parsePushSubscription({ endpoint, keys })).toEqual({
      endpoint,
      expirationTime: null,
      keys
    });
  });

  it.each([
    "https://127.0.0.1/internal",
    "https://192.168.1.1/admin",
    "https://example.com/push",
    "https://fcm.googleapis.com.evil.example/push",
    "https://user:secret@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:8443/push",
    "http://fcm.googleapis.com/push",
    "not-a-url"
  ])("rejects an untrusted or unsafe push endpoint: %s", (endpoint) => {
    expect(parsePushSubscription({ endpoint, keys })).toBeUndefined();
  });
});

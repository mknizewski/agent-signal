import { randomBytes } from "node:crypto";

export interface MobilePairingCode {
  secret: string;
  expiresAt: number;
}

export class MobilePairingRegistry {
  private readonly records = new Map<string, number>();

  constructor(private readonly ttlMs = 60_000) {}

  create(now = Date.now()): MobilePairingCode {
    this.prune(now);
    const secret = randomBytes(32).toString("base64url");
    const expiresAt = now + this.ttlMs;
    this.records.set(secret, expiresAt);
    return { secret, expiresAt };
  }

  consume(secret: string, now = Date.now()): boolean {
    const expiresAt = this.records.get(secret);
    this.records.delete(secret);
    return expiresAt !== undefined && expiresAt >= now;
  }

  prune(now = Date.now()): void {
    for (const [secret, expiresAt] of this.records) {
      if (expiresAt < now) this.records.delete(secret);
    }
  }

  clear(): void {
    this.records.clear();
  }
}

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredMobileDevice {
  id: string;
  name: string;
  tokenHash: string;
  pairedAt: string;
  lastSeenAt: string;
  pushSubscription?: StoredPushSubscription;
}

export interface StoredMobileCertificates {
  caCertificatePem: string;
  encryptedCaPrivateKey: string;
  certificatePem: string;
  encryptedPrivateKey: string;
  fingerprint: string;
  hostname: string;
  address: string;
}

export interface StoredVapidKeys {
  publicKey: string;
  encryptedPrivateKey: string;
}

export interface MobileState {
  version: 1;
  enabled: boolean;
  desktopId: string;
  keySalt: string;
  selectedAddress?: string;
  certificates?: StoredMobileCertificates;
  vapid?: StoredVapidKeys;
  devices: StoredMobileDevice[];
}

export class MobileStore {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "agent-signal-mobile.json");
  }

  async load(): Promise<MobileState> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8")
      ) as Partial<MobileState>;
      if (
        parsed.version !== 1 ||
        typeof parsed.desktopId !== "string" ||
        typeof parsed.keySalt !== "string" ||
        !Array.isArray(parsed.devices)
      ) {
        return createEmptyMobileState();
      }
      return {
        version: 1,
        enabled: parsed.enabled === true,
        desktopId: parsed.desktopId,
        keySalt: parsed.keySalt,
        selectedAddress:
          typeof parsed.selectedAddress === "string"
            ? parsed.selectedAddress
            : undefined,
        certificates: validateCertificates(parsed.certificates),
        vapid: validateVapid(parsed.vapid),
        devices: parsed.devices.filter(isStoredMobileDevice)
      };
    } catch {
      return createEmptyMobileState();
    }
  }

  async save(state: MobileState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export function createEmptyMobileState(): MobileState {
  return {
    version: 1,
    enabled: false,
    desktopId: randomUUID(),
    keySalt: randomBytes(32).toString("base64url"),
    devices: []
  };
}

function validateCertificates(
  value: unknown
): StoredMobileCertificates | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<StoredMobileCertificates>;
  const keys: Array<keyof StoredMobileCertificates> = [
    "caCertificatePem",
    "encryptedCaPrivateKey",
    "certificatePem",
    "encryptedPrivateKey",
    "fingerprint",
    "hostname",
    "address"
  ];
  return keys.every((key) => typeof candidate[key] === "string")
    ? (candidate as StoredMobileCertificates)
    : undefined;
}

function validateVapid(value: unknown): StoredVapidKeys | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<StoredVapidKeys>;
  return typeof candidate.publicKey === "string" &&
    typeof candidate.encryptedPrivateKey === "string"
    ? (candidate as StoredVapidKeys)
    : undefined;
}

function isStoredMobileDevice(value: unknown): value is StoredMobileDevice {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredMobileDevice>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.tokenHash === "string" &&
    typeof candidate.pairedAt === "string" &&
    typeof candidate.lastSeenAt === "string"
  );
}

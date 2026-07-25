import forge from "node-forge";
import { describe, expect, it } from "vitest";
import {
  createMobileCertificates,
  rotateMobileServerCertificate,
  type SecretProtector
} from "./mobile-certificates";

const protector: SecretProtector = {
  protect: (value) => Buffer.from(value, "utf8").toString("base64"),
  unprotect: (value) => Buffer.from(value, "base64").toString("utf8")
};

describe("mobile certificates", () => {
  it(
    "creates a CA-signed server certificate for the local host and address",
    { timeout: 20_000 },
    () => {
      const created = createMobileCertificates(
        "agentsignal-test.local",
        "192.168.1.20",
        protector
      );
      const ca = forge.pki.certificateFromPem(created.caCertificatePem);
      const certificate = forge.pki.certificateFromPem(created.certificatePem);
      const altNames = (
        certificate.getExtension("subjectAltName") as
          | { altNames?: Array<{ type?: number; value?: string; ip?: string }> }
          | null
      )?.altNames?.map((item) =>
        parsedAltName(item)
      );

      expect(ca.verify(certificate)).toBe(true);
      expect(altNames).toContain("agentsignal-test.local");
      expect(altNames).toContain("192.168.1.20");
      expect(created.encryptedPrivateKey).not.toContain("PRIVATE KEY");
      expect(created.fingerprint).toMatch(/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
    }
  );

  it(
    "rotates only the server certificate when the LAN address changes",
    { timeout: 20_000 },
    () => {
      const created = createMobileCertificates(
        "agentsignal-test.local",
        "192.168.1.20",
        protector
      );
      const rotated = rotateMobileServerCertificate(
        created,
        "192.168.1.21",
        protector
      );
      const certificate = forge.pki.certificateFromPem(rotated.certificatePem);
      const altNames = (
        certificate.getExtension("subjectAltName") as
          | { altNames?: Array<{ type?: number; value?: string; ip?: string }> }
          | null
      )?.altNames?.map((item) =>
        parsedAltName(item)
      );

      expect(rotated.caCertificatePem).toBe(created.caCertificatePem);
      expect(rotated.fingerprint).toBe(created.fingerprint);
      expect(rotated.certificatePem).not.toBe(created.certificatePem);
      expect(altNames).toContain("192.168.1.21");
    }
  );
});

function parsedAltName(item: {
  type?: number;
  value?: string;
  ip?: string;
}): string | undefined {
  if (item.ip) return item.ip;
  if (item.type === 7 && item.value) {
    return [...item.value].map((character) => character.charCodeAt(0)).join(".");
  }
  return item.value;
}

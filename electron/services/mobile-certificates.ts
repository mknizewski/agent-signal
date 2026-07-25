import { createHash, randomBytes } from "node:crypto";
import forge from "node-forge";
import type { StoredMobileCertificates } from "./mobile-store";

export interface SecretProtector {
  protect(value: string): string;
  unprotect(value: string): string;
}

export function createMobileCertificates(
  hostname: string,
  address: string,
  protector: SecretProtector
): StoredMobileCertificates {
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCertificate = forge.pki.createCertificate();
  caCertificate.publicKey = caKeys.publicKey;
  caCertificate.serialNumber = serialNumber();
  caCertificate.validity.notBefore = new Date(Date.now() - 60_000);
  caCertificate.validity.notAfter = yearsFromNow(10);
  const caAttributes = [
    { name: "commonName", value: `AgentSignal Local CA ${hostname}` },
    { name: "organizationName", value: "AgentSignal" }
  ];
  caCertificate.setSubject(caAttributes);
  caCertificate.setIssuer(caAttributes);
  caCertificate.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    {
      name: "keyUsage",
      keyCertSign: true,
      cRLSign: true,
      critical: true
    },
    { name: "subjectKeyIdentifier" }
  ]);
  caCertificate.sign(caKeys.privateKey, forge.md.sha256.create());

  const serverKeys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = serverKeys.publicKey;
  certificate.serialNumber = serialNumber();
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = yearsFromNow(3);
  certificate.setSubject([
    { name: "commonName", value: hostname },
    { name: "organizationName", value: "AgentSignal" }
  ]);
  certificate.setIssuer(caCertificate.subject.attributes);
  certificate.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
      critical: true
    },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: hostname },
        { type: 7, ip: address }
      ]
    },
    { name: "subjectKeyIdentifier" }
  ]);
  certificate.sign(caKeys.privateKey, forge.md.sha256.create());

  const caCertificatePem = forge.pki.certificateToPem(caCertificate);
  const certificateDer = forge.asn1
    .toDer(forge.pki.certificateToAsn1(caCertificate))
    .getBytes();

  return {
    caCertificatePem,
    encryptedCaPrivateKey: protector.protect(
      forge.pki.privateKeyToPem(caKeys.privateKey)
    ),
    certificatePem: forge.pki.certificateToPem(certificate),
    encryptedPrivateKey: protector.protect(
      forge.pki.privateKeyToPem(serverKeys.privateKey)
    ),
    fingerprint: formatFingerprint(
      createHash("sha256")
        .update(Buffer.from(certificateDer, "binary"))
        .digest("hex")
    ),
    hostname,
    address
  };
}

export function rotateMobileServerCertificate(
  existing: StoredMobileCertificates,
  address: string,
  protector: SecretProtector
): StoredMobileCertificates {
  if (existing.address === address) return existing;

  const caCertificate = forge.pki.certificateFromPem(
    existing.caCertificatePem
  );
  const caPrivateKey = forge.pki.privateKeyFromPem(
    protector.unprotect(existing.encryptedCaPrivateKey)
  );
  const serverKeys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = serverKeys.publicKey;
  certificate.serialNumber = serialNumber();
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = yearsFromNow(3);
  certificate.setSubject([
    { name: "commonName", value: existing.hostname },
    { name: "organizationName", value: "AgentSignal" }
  ]);
  certificate.setIssuer(caCertificate.subject.attributes);
  certificate.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
      critical: true
    },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: existing.hostname },
        { type: 7, ip: address }
      ]
    }
  ]);
  certificate.sign(caPrivateKey, forge.md.sha256.create());

  return {
    ...existing,
    address,
    certificatePem: forge.pki.certificateToPem(certificate),
    encryptedPrivateKey: protector.protect(
      forge.pki.privateKeyToPem(serverKeys.privateKey)
    )
  };
}

function serialNumber(): string {
  return randomBytes(16).toString("hex").replace(/^0/, "1");
}

function yearsFromNow(years: number): Date {
  const next = new Date();
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function formatFingerprint(value: string): string {
  return value
    .toUpperCase()
    .match(/.{1,2}/g)!
    .join(":");
}

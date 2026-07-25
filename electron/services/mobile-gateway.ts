import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import QRCode from "qrcode";
import webPush, { type PushSubscription } from "web-push";
import type {
  AppSnapshot,
  MobileGatewayStatus,
  MobilePairingSession,
  MobileSnapshot,
  PairedMobileDevice,
  SessionStatus
} from "../../src/shared/types";
import { createMobileSnapshot } from "../../src/shared/mobile";
import {
  createMobileCertificates,
  rotateMobileServerCertificate,
  type SecretProtector
} from "./mobile-certificates";
import { MobilePairingRegistry } from "./mobile-pairing";
import { mobileNotificationForTransition } from "./mobile-notifications";
import {
  createEmptyMobileState,
  type MobileState,
  type StoredMobileDevice,
  type StoredPushSubscription,
  MobileStore
} from "./mobile-store";

const HTTPS_PORT = 47_831;
const BOOTSTRAP_PORT = 47_830;
const PAIRING_TTL_MS = 60_000;
const MAX_BODY_BYTES = 64 * 1024;
const COOKIE_NAME = "__Host-agentsignal-device";

interface MobileGatewayOptions {
  store: MobileStore;
  assetRoot: string;
  protector: SecretProtector;
  onStatus(status: MobileGatewayStatus): void;
  onDiagnostic?(message: string, error?: unknown): void;
}

interface NetworkTarget {
  name: string;
  address: string;
  netmask: string;
}

interface EventClient {
  deviceId: string;
  response: ServerResponse;
}

interface PairingFailureWindow {
  count: number;
  resetsAt: number;
}

export class MobileGateway {
  private state: MobileState = createEmptyMobileState();
  private latestSnapshot?: AppSnapshot;
  private currentMobileSnapshot?: MobileSnapshot;
  private currentNetwork?: NetworkTarget;
  private httpsServer?: ReturnType<typeof createHttpsServer>;
  private bootstrapServer?: ReturnType<typeof createHttpServer>;
  private readonly pairingRegistry = new MobilePairingRegistry(PAIRING_TTL_MS);
  private readonly pairingFailures = new Map<string, PairingFailureWindow>();
  private readonly eventClients = new Set<EventClient>();
  private previousStatuses?: Map<string, SessionStatus>;
  private saveQueue = Promise.resolve();
  private heartbeat?: NodeJS.Timeout;
  private error?: string;

  constructor(private readonly options: MobileGatewayOptions) {}

  async initialize(): Promise<void> {
    this.state = await this.options.store.load();
    if (this.state.enabled) {
      await this.start().catch((error) => {
        this.error = errorMessage(error);
        this.options.onDiagnostic?.(
          "Nie udało się uruchomić dostępu mobilnego.",
          error
        );
      });
    }
    this.emitStatus();
  }

  getStatus(): MobileGatewayStatus {
    const connectedIds = new Set(
      [...this.eventClients].map((client) => client.deviceId)
    );
    const certificates = this.state.certificates;
    return {
      enabled: this.state.enabled,
      running: Boolean(this.httpsServer?.listening),
      address: this.currentNetwork?.address,
      hostname: certificates?.hostname,
      origin: certificates
        ? `https://${certificates.hostname}:${HTTPS_PORT}`
        : undefined,
      certificateFingerprint: certificates?.fingerprint,
      error: this.error,
      devices: this.state.devices.map((device) =>
        publicDevice(device, connectedIds.has(device.id))
      )
    };
  }

  async setEnabled(enabled: boolean): Promise<MobileGatewayStatus> {
    this.state.enabled = enabled;
    this.error = undefined;
    await this.persist();
    if (enabled) {
      await this.start();
    } else {
      await this.stopServers();
    }
    this.emitStatus();
    return this.getStatus();
  }

  async createPairing(): Promise<MobilePairingSession> {
    if (!this.state.enabled) {
      await this.setEnabled(true);
    } else if (!this.httpsServer?.listening) {
      await this.start();
    }

    const certificates = this.state.certificates;
    const network = this.currentNetwork;
    if (!certificates || !network) {
      throw new Error("Dostęp mobilny nie ma aktywnego połączenia sieciowego.");
    }

    const { secret, expiresAt } = this.pairingRegistry.create();
    const certificateUrl = `http://${network.address}:${BOOTSTRAP_PORT}/`;
    // The server certificate contains the selected private IPv4 address. Use
    // it directly so pairing neither depends on nor advertises through mDNS.
    const pairingUrl =
      `https://${network.address}:${HTTPS_PORT}/pair#pair=${secret}`;

    return {
      certificateUrl,
      certificateQrDataUrl: await QRCode.toDataURL(certificateUrl, {
        margin: 1,
        width: 280
      }),
      pairingUrl,
      pairingQrDataUrl: await QRCode.toDataURL(pairingUrl, {
        margin: 1,
        width: 280
      }),
      certificateFingerprint: certificates.fingerprint,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  async revokeDevice(deviceId: string): Promise<MobileGatewayStatus> {
    const previousLength = this.state.devices.length;
    this.state.devices = this.state.devices.filter(
      (device) => device.id !== deviceId
    );
    if (this.state.devices.length === previousLength) {
      throw new Error("To urządzenie nie jest już sparowane.");
    }
    for (const client of [...this.eventClients]) {
      if (client.deviceId !== deviceId) continue;
      writeEvent(client.response, "revoked", {});
      client.response.end();
      this.eventClients.delete(client);
    }
    await this.persist();
    this.emitStatus();
    return this.getStatus();
  }

  async reset(): Promise<MobileGatewayStatus> {
    await this.stopServers();
    this.state = createEmptyMobileState();
    this.currentNetwork = undefined;
    this.currentMobileSnapshot = undefined;
    this.previousStatuses = undefined;
    this.error = undefined;
    await this.persist();
    this.emitStatus();
    return this.getStatus();
  }

  publishSnapshot(snapshot: AppSnapshot): void {
    this.latestSnapshot = snapshot;
    this.currentMobileSnapshot = createMobileSnapshot(
      snapshot,
      this.state.keySalt
    );
    this.publishEvent("snapshot", this.currentMobileSnapshot);
    void this.publishStatusNotifications(snapshot);
  }

  async stop(): Promise<void> {
    await this.stopServers();
    await this.saveQueue;
  }

  private async start(): Promise<void> {
    if (this.httpsServer?.listening) return;
    const network = selectNetworkTarget(this.state.selectedAddress);
    if (!network) {
      throw new Error(
        "Nie znaleziono prywatnego połączenia IPv4. Połącz komputer z Wi‑Fi lub siecią LAN."
      );
    }
    this.currentNetwork = network;
    this.state.selectedAddress = network.address;
    const hostname =
      this.state.certificates?.hostname ??
      `agentsignal-${this.state.desktopId.replaceAll("-", "").slice(0, 8)}.local`;
    this.state.certificates = this.state.certificates
      ? rotateMobileServerCertificate(
          this.state.certificates,
          network.address,
          this.options.protector
        )
      : createMobileCertificates(
          hostname,
          network.address,
          this.options.protector
        );
    if (!this.state.vapid) {
      const vapid = webPush.generateVAPIDKeys();
      this.state.vapid = {
        publicKey: vapid.publicKey,
        encryptedPrivateKey: this.options.protector.protect(vapid.privateKey)
      };
    }
    if (this.latestSnapshot) {
      this.currentMobileSnapshot = createMobileSnapshot(
        this.latestSnapshot,
        this.state.keySalt
      );
    }
    await this.persist();

    const privateKey = this.options.protector.unprotect(
      this.state.certificates.encryptedPrivateKey
    );
    this.httpsServer = createHttpsServer(
      {
        cert: this.state.certificates.certificatePem,
        key: privateKey,
        minVersion: "TLSv1.2"
      },
      (request, response) => {
        void this.handleHttpsRequest(request, response).catch((error) => {
          this.options.onDiagnostic?.("Błąd mobilnego API.", error);
          if (!response.headersSent) {
            sendJson(response, 500, { error: "Wewnętrzny błąd gatewaya." });
          } else {
            response.end();
          }
        });
      }
    );
    this.bootstrapServer = createHttpServer((request, response) => {
      void this.handleBootstrapRequest(request, response).catch((error) => {
        this.options.onDiagnostic?.("Błąd instalatora certyfikatu.", error);
        response.statusCode = 500;
        response.end("AgentSignal certificate setup error");
      });
    });

    await Promise.all([
      listen(this.httpsServer, HTTPS_PORT, network.address),
      listen(this.bootstrapServer, BOOTSTRAP_PORT, network.address)
    ]).catch(async (error) => {
      await this.stopServers();
      throw new Error(
        `Nie można uruchomić portów ${BOOTSTRAP_PORT}/${HTTPS_PORT}: ${errorMessage(error)}`
      );
    });

    this.heartbeat = setInterval(() => {
      for (const client of [...this.eventClients]) {
        if (!client.response.writableEnded) {
          client.response.write(`: heartbeat ${Date.now()}\n\n`);
        }
      }
      this.pairingRegistry.prune();
    }, 15_000);
    this.heartbeat.unref();
    this.error = undefined;
    this.emitStatus();
  }

  private async stopServers(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.pairingRegistry.clear();
    this.pairingFailures.clear();
    for (const client of this.eventClients) client.response.end();
    this.eventClients.clear();
    const servers = [this.httpsServer, this.bootstrapServer];
    this.httpsServer = undefined;
    this.bootstrapServer = undefined;
    await Promise.all(servers.map(closeServer));
    this.emitStatus();
  }

  private async handleBootstrapRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (!this.isLocalClient(request)) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }
    const url = new URL(request.url ?? "/", "http://agentsignal.local");
    if (request.method === "GET" && url.pathname === "/agent-signal-ca.crt") {
      const certificate = this.state.certificates?.caCertificatePem;
      if (!certificate) {
        response.statusCode = 503;
        response.end("Certificate unavailable");
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/x-x509-ca-cert",
        "Content-Disposition": 'attachment; filename="AgentSignal-Local-CA.crt"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(certificate);
      return;
    }
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
      });
      response.end(`<!doctype html><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>AgentSignal — certyfikat</title>
        <style>body{font:16px system-ui;max-width:36rem;margin:3rem auto;padding:0 1.25rem;line-height:1.55;color:#222}a{display:inline-block;padding:.8rem 1rem;border-radius:.6rem;background:#20201e;color:#fff;text-decoration:none}code{word-break:break-all;font-size:.78rem}</style>
        <h1>AgentSignal na telefonie</h1>
        <p>Pobierz certyfikat, a następnie zainstaluj go w Androidzie jako certyfikat CA dla sieci VPN i aplikacji.</p>
        <p><a href="/agent-signal-ca.crt">Pobierz certyfikat AgentSignal</a></p>
        <p>Porównaj odcisk z aplikacją na komputerze:</p>
        <code>${escapeHtml(this.state.certificates?.fingerprint ?? "")}</code>`);
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  }

  private async handleHttpsRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    applySecurityHeaders(response);
    if (!this.isLocalClient(request)) {
      sendJson(response, 403, { error: "Połączenie spoza lokalnej sieci." });
      return;
    }
    if (!this.isExpectedHttpsHost(request.headers.host)) {
      sendJson(response, 421, { error: "Nieprawidłowy adres gatewaya." });
      return;
    }
    const url = new URL(request.url ?? "/", "https://agentsignal.local");

    if (request.method === "POST" && url.pathname === "/api/v1/pair") {
      if (!this.isExpectedOrigin(request.headers.origin)) {
        sendJson(response, 403, { error: "Nieprawidłowe źródło parowania." });
        return;
      }
      await this.handlePairing(request, response);
      return;
    }

    const device = this.authenticate(request);
    if (url.pathname.startsWith("/api/") && !device) {
      sendJson(response, 401, { error: "Telefon nie jest sparowany." });
      return;
    }

    if (device) this.touchDevice(device);
    if (request.method === "GET" && url.pathname === "/api/v1/snapshot") {
      sendJson(
        response,
        200,
        this.currentMobileSnapshot ?? emptyMobileSnapshot()
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      this.handleEventStream(request, response, device!);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/vapid-key") {
      sendJson(response, 200, { publicKey: this.state.vapid?.publicKey ?? "" });
      return;
    }
    if (
      request.method === "PUT" &&
      url.pathname === "/api/v1/push-subscription"
    ) {
      if (!this.isExpectedOrigin(request.headers.origin)) {
        sendJson(response, 403, { error: "Nieprawidłowe źródło żądania." });
        return;
      }
      await this.handlePushSubscription(request, response, device!);
      return;
    }
    if (
      request.method === "DELETE" &&
      url.pathname === "/api/v1/push-subscription"
    ) {
      if (!this.isExpectedOrigin(request.headers.origin)) {
        sendJson(response, 403, { error: "Nieprawidłowe źródło żądania." });
        return;
      }
      device!.pushSubscription = undefined;
      await this.persist();
      this.emitStatus();
      response.statusCode = 204;
      response.end();
      return;
    }

    await this.serveMobileAsset(url.pathname, response);
  }

  private async handlePairing(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const body = await readJsonBody(request);
    const secret =
      body && typeof body.secret === "string" ? body.secret : "";
    const remoteAddress = normalizeAddress(request.socket.remoteAddress);
    if (this.isPairingRateLimited(remoteAddress)) {
      sendJson(response, 429, {
        error: "Zbyt wiele nieudanych prób. Spróbuj ponownie za minutę."
      });
      return;
    }
    if (!this.pairingRegistry.consume(secret)) {
      this.recordPairingFailure(remoteAddress);
      sendJson(response, 401, {
        error: "Kod QR wygasł lub został już wykorzystany."
      });
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const requestedName =
      body && typeof body.name === "string" ? body.name.trim() : "";
    const device: StoredMobileDevice = {
      id: randomUUID(),
      name: sanitizeDeviceName(requestedName || "Telefon z Androidem"),
      tokenHash: hashToken(token),
      pairedAt: now,
      lastSeenAt: now
    };
    this.state.devices.push(device);
    await this.persist();
    response.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Strict`
    );
    sendJson(response, 200, {
      snapshot: this.currentMobileSnapshot ?? emptyMobileSnapshot()
    });
    this.emitStatus();
  }

  private handleEventStream(
    request: IncomingMessage,
    response: ServerResponse,
    device: StoredMobileDevice
  ): void {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write("retry: 2000\n\n");
    const client = { deviceId: device.id, response };
    this.eventClients.add(client);
    if (this.currentMobileSnapshot) {
      writeEvent(response, "snapshot", this.currentMobileSnapshot);
    }
    this.emitStatus();
    request.on("close", () => {
      this.eventClients.delete(client);
      this.emitStatus();
    });
  }

  private async handlePushSubscription(
    request: IncomingMessage,
    response: ServerResponse,
    device: StoredMobileDevice
  ): Promise<void> {
    const body = await readJsonBody(request);
    const subscription = parsePushSubscription(body);
    if (!subscription) {
      sendJson(response, 400, { error: "Nieprawidłowa subskrypcja push." });
      return;
    }
    device.pushSubscription = subscription;
    await this.persist();
    this.emitStatus();
    response.statusCode = 204;
    response.end();
  }

  private async serveMobileAsset(
    pathname: string,
    response: ServerResponse
  ): Promise<void> {
    const relative =
      pathname === "/" || pathname === "/pair"
        ? "mobile.html"
        : pathname.replace(/^\/+/, "");
    if (
      relative.includes("..") ||
      (!relative.startsWith("assets/") &&
        ![
          "mobile.html",
          "mobile.webmanifest",
          "mobile-sw.js",
          "mobile-icon-192.png",
          "mobile-icon-512.png"
        ].includes(relative))
    ) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    const filePath = path.join(this.options.assetRoot, relative);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("Not a file");
      const content = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentType(relative),
        "Cache-Control": relative.startsWith("assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache"
      });
      response.end(content);
    } catch {
      response.statusCode = 404;
      response.end("Mobile asset not found. Run pnpm build.");
    }
  }

  private authenticate(request: IncomingMessage): StoredMobileDevice | undefined {
    const cookie = parseCookie(request.headers.cookie ?? "")[COOKIE_NAME];
    if (!cookie) return undefined;
    const hash = hashToken(cookie);
    return this.state.devices.find((device) =>
      equalTokenHashes(device.tokenHash, hash)
    );
  }

  private touchDevice(device: StoredMobileDevice): void {
    const previous = new Date(device.lastSeenAt).getTime();
    if (Date.now() - previous < 30_000) return;
    device.lastSeenAt = new Date().toISOString();
    void this.persist();
  }

  private publishEvent(event: string, data: unknown): void {
    for (const client of [...this.eventClients]) {
      if (client.response.writableEnded) {
        this.eventClients.delete(client);
        continue;
      }
      writeEvent(client.response, event, data);
    }
  }

  private async publishStatusNotifications(snapshot: AppSnapshot): Promise<void> {
    const current = new Map(
      snapshot.trackedSessions.map((session) => [session.id, session.status])
    );
    const previous = this.previousStatuses;
    this.previousStatuses = current;
    if (!previous || !this.state.enabled || !this.state.vapid) return;

    for (const session of snapshot.trackedSessions) {
      const before = previous.get(session.id);
      const payload = mobileNotificationForTransition(
        before,
        session.status,
        session.title
      );
      if (payload) await this.sendPushToDevices(payload);
    }
  }

  private async sendPushToDevices(payload: {
    title: string;
    body: string;
    status: SessionStatus;
  }): Promise<void> {
    const vapid = this.state.vapid;
    if (!vapid) return;
    const privateKey = this.options.protector.unprotect(
      vapid.encryptedPrivateKey
    );
    let changed = false;
    await Promise.all(
      this.state.devices.map(async (device) => {
        if (!device.pushSubscription) return;
        try {
          await webPush.sendNotification(
            device.pushSubscription as PushSubscription,
            JSON.stringify(payload),
            {
              vapidDetails: {
                subject: "https://github.com/mknizewski/agent-signal",
                publicKey: vapid.publicKey,
                privateKey
              },
              TTL: 60
            }
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            device.pushSubscription = undefined;
            changed = true;
          } else {
            this.options.onDiagnostic?.(
              `Nie udało się wysłać powiadomienia do ${device.name}.`,
              error
            );
          }
        }
      })
    );
    if (changed) {
      await this.persist();
      this.emitStatus();
    }
  }

  private isLocalClient(request: IncomingMessage): boolean {
    const target = this.currentNetwork;
    if (!target) return false;
    const remote = normalizeAddress(request.socket.remoteAddress);
    return (
      remote === "127.0.0.1" ||
      remote === target.address ||
      sameIpv4Subnet(remote, target.address, target.netmask)
    );
  }

  private isExpectedHttpsHost(value?: string): boolean {
    const certificates = this.state.certificates;
    const network = this.currentNetwork;
    if (!certificates || !network || !value) return false;
    const normalized = value.toLowerCase();
    return (
      normalized === `${certificates.hostname.toLowerCase()}:${HTTPS_PORT}` ||
      normalized === `${network.address}:${HTTPS_PORT}`
    );
  }

  private isExpectedOrigin(value?: string): boolean {
    const certificates = this.state.certificates;
    const network = this.currentNetwork;
    if (!certificates || !network || !value) return false;
    return (
      value === `https://${certificates.hostname}:${HTTPS_PORT}` ||
      value === `https://${network.address}:${HTTPS_PORT}`
    );
  }

  private isPairingRateLimited(address: string): boolean {
    const window = this.pairingFailures.get(address);
    if (!window) return false;
    if (window.resetsAt <= Date.now()) {
      this.pairingFailures.delete(address);
      return false;
    }
    return window.count >= 5;
  }

  private recordPairingFailure(address: string): void {
    const now = Date.now();
    const current = this.pairingFailures.get(address);
    if (!current || current.resetsAt <= now) {
      this.pairingFailures.set(address, {
        count: 1,
        resetsAt: now + 60_000
      });
      return;
    }
    current.count += 1;
  }

  private persist(): Promise<void> {
    const snapshot = structuredClone(this.state);
    this.saveQueue = this.saveQueue
      .then(() => this.options.store.save(snapshot))
      .catch((error) => {
        this.options.onDiagnostic?.(
          "Nie udało się zapisać ustawień mobilnych.",
          error
        );
      });
    return this.saveQueue;
  }

  private emitStatus(): void {
    this.options.onStatus(this.getStatus());
  }
}

function publicDevice(
  device: StoredMobileDevice,
  connected: boolean
): PairedMobileDevice {
  return {
    id: device.id,
    name: device.name,
    pairedAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt,
    connected,
    notificationsEnabled: Boolean(device.pushSubscription)
  };
}

function selectNetworkTarget(preferred?: string): NetworkTarget | undefined {
  const candidates: NetworkTarget[] = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (
        entry.family !== "IPv4" ||
        entry.internal ||
        !isPrivateIpv4(entry.address)
      ) {
        continue;
      }
      candidates.push({
        name,
        address: entry.address,
        netmask: entry.netmask
      });
    }
  }
  return (
    candidates.find((candidate) => candidate.address === preferred) ??
    candidates.find(
      (candidate) =>
        !/virtual|vmware|hyper-v|vethernet|docker|wsl/i.test(candidate.name)
    ) ??
    candidates[0]
  );
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  return (
    octets.length === 4 &&
    (octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168))
  );
}

function sameIpv4Subnet(
  candidate: string,
  address: string,
  netmask: string
): boolean {
  const candidateValue = ipv4ToNumber(candidate);
  const addressValue = ipv4ToNumber(address);
  const maskValue = ipv4ToNumber(netmask);
  if (
    candidateValue === undefined ||
    addressValue === undefined ||
    maskValue === undefined
  ) {
    return false;
  }
  return (candidateValue & maskValue) === (addressValue & maskValue);
}

function ipv4ToNumber(value: string): number | undefined {
  const parts = value.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return undefined;
  }
  return (
    ((parts[0] << 24) |
      (parts[1] << 16) |
      (parts[2] << 8) |
      parts[3]) >>>
    0
  );
}

function normalizeAddress(value?: string): string {
  return (value ?? "").replace(/^::ffff:/, "");
}

function parseCookie(value: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    if (!key || !raw) continue;
    try {
      cookies[key] = decodeURIComponent(raw);
    } catch {
      // Ignore malformed cookies instead of turning an unauthenticated request
      // into a server error.
    }
  }
  return cookies;
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function equalTokenHashes(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sanitizeDeviceName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
}

function parsePushSubscription(value: unknown): StoredPushSubscription | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<StoredPushSubscription>;
  if (
    typeof candidate.endpoint !== "string" ||
    !candidate.endpoint.startsWith("https://") ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== "string" ||
    typeof candidate.keys.auth !== "string"
  ) {
    return undefined;
  }
  return {
    endpoint: candidate.endpoint.slice(0, 2048),
    expirationTime:
      typeof candidate.expirationTime === "number"
        ? candidate.expirationTime
        : null,
    keys: {
      p256dh: candidate.keys.p256dh.slice(0, 512),
      auth: candidate.keys.auth.slice(0, 512)
    }
  };
}

async function readJsonBody(
  request: IncomingMessage
): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Żądanie jest zbyt duże.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function writeEvent(
  response: ServerResponse,
  event: string,
  data: unknown
): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function emptyMobileSnapshot(): MobileSnapshot {
  return {
    sessions: [],
    providers: {
      codex: { id: "codex", label: "Codex", available: false },
      claude: { id: "claude", label: "Claude Code", available: false }
    },
    counts: {
      working: 0,
      attention: 0,
      idle: 0,
      error: 0,
      unavailable: 0
    },
    updatedAt: new Date().toISOString()
  };
}

function contentType(fileName: string): string {
  if (fileName.endsWith(".html")) return "text/html; charset=utf-8";
  if (fileName.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (fileName.endsWith(".css")) return "text/css; charset=utf-8";
  if (fileName.endsWith(".webmanifest")) {
    return "application/manifest+json; charset=utf-8";
  }
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".svg")) return "image/svg+xml";
  if (fileName.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function listen(
  server: ReturnType<typeof createHttpServer> | ReturnType<typeof createHttpsServer>,
  port: number,
  address: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, address, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(
  server:
    | ReturnType<typeof createHttpServer>
    | ReturnType<typeof createHttpsServer>
    | undefined
): Promise<void> {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

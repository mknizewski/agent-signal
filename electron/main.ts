import path from "node:path";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  safeStorage,
  session,
  Tray
} from "electron";
import type {
  AppSnapshot,
  MobileGatewayStatus,
  SessionStatus,
  TrackSessionsInput
} from "../src/shared/types";
import { DashboardManager } from "./services/dashboard-manager";
import { MobileGateway } from "./services/mobile-gateway";
import { MobileStore } from "./services/mobile-store";
import { TrackingStore } from "./services/store";

let mainWindow: BrowserWindow | null = null;
let dashboardManager: DashboardManager | null = null;
let mobileGateway: MobileGateway | null = null;
let tray: Tray | null = null;
let quitting = false;
let notificationsReady = false;
let normalWindowBounds: Electron.Rectangle | undefined;
const lastStatuses = new Map<string, SessionStatus>();
const smokeMode = process.argv.includes("--smoke-test");

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  createWindow();
  createTray();
  registerIpc();

  const userDataPath = app.getPath("userData");
  mobileGateway = new MobileGateway({
    store: new MobileStore(userDataPath),
    assetRoot: path.join(app.getAppPath(), "dist"),
    protector: {
      protect: (value) => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error(
            "Systemowe szyfrowanie sekretów nie jest obecnie dostępne."
          );
        }
        return safeStorage.encryptString(value).toString("base64");
      },
      unprotect: (value) => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error(
            "Systemowe szyfrowanie sekretów nie jest obecnie dostępne."
          );
        }
        return safeStorage.decryptString(Buffer.from(value, "base64"));
      }
    },
    onStatus: publishMobileGatewayStatus,
    onDiagnostic: (message, error) => console.warn(message, error)
  });
  await mobileGateway.initialize();

  const store = new TrackingStore(userDataPath);
  dashboardManager = new DashboardManager(store, publishSnapshot);
  await dashboardManager.initialize();
  notificationsReady = true;
  publishSnapshot(dashboardManager.getSnapshot());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void Promise.all([
    dashboardManager?.shutdown() ?? Promise.resolve(),
    mobileGateway?.stop() ?? Promise.resolve()
  ]).finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: "#191918",
    icon: path.join(app.getAppPath(), "build", "icon.ico"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#151514",
      symbolColor: "#e9e9e5",
      height: 38
    },
    show: false,
    title: "AgentSignal",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (!smokeMode) mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (quitting || smokeMode) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (!smokeMode) return;
    setTimeout(() => {
      quitting = true;
      app.quit();
    }, 250);
  });

  const developmentUrl = resolveDevelopmentUrl();
  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && url !== current) event.preventDefault();
  });
}

function createTray(): void {
  tray = new Tray(path.join(app.getAppPath(), "build", "icon.ico"));
  tray.setToolTip("AgentSignal");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Otwórz AgentSignal",
        click: showMainWindow
      },
      { type: "separator" },
      {
        label: "Wyjście",
        click: () => app.quit()
      }
    ])
  );
  tray.on("double-click", showMainWindow);
}

function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function registerIpc(): void {
  ipcMain.handle("snapshot:get", () => requireManager().getSnapshot());
  ipcMain.handle("sessions:refresh", () => requireManager().refresh());
  ipcMain.handle(
    "sessions:track",
    (_event, input: unknown) =>
      requireManager().trackSessions(parseTrackSessionsInput(input))
  );
  ipcMain.handle("sessions:archive", (_event, sessionId: unknown) =>
    requireManager().archiveSession(parseSessionId(sessionId))
  );
  ipcMain.handle("sessions:restore", (_event, sessionId: unknown) =>
    requireManager().restoreArchivedSession(parseSessionId(sessionId))
  );
  ipcMain.handle("sessions:delete-archived", (_event, sessionId: unknown) =>
    requireManager().deleteArchivedSession(parseSessionId(sessionId))
  );
  ipcMain.handle("window:compact", (_event, compact: unknown) => {
    if (typeof compact !== "boolean") {
      throw new TypeError("Nieprawidłowa wartość trybu kompaktowego.");
    }
    setCompactWindow(compact);
  });
  ipcMain.handle("window:theme", (_event, theme: unknown) => {
    if (theme !== "light" && theme !== "dark") {
      throw new TypeError("Nieprawidłowy motyw.");
    }
    mainWindow?.setTitleBarOverlay({
      color: theme === "light" ? "#efefec" : "#151514",
      symbolColor: theme === "light" ? "#20201e" : "#e9e9e5",
      height: 38
    });
  });
  ipcMain.handle("app:exit", () => app.quit());
  ipcMain.handle("mobile:status", () => requireMobileGateway().getStatus());
  ipcMain.handle("mobile:set-enabled", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") {
      throw new TypeError("Nieprawidłowy stan dostępu mobilnego.");
    }
    return requireMobileGateway().setEnabled(enabled);
  });
  ipcMain.handle("mobile:create-pairing", () =>
    requireMobileGateway().createPairing()
  );
  ipcMain.handle("mobile:revoke-device", (_event, deviceId: unknown) =>
    requireMobileGateway().revokeDevice(parseDeviceId(deviceId))
  );
  ipcMain.handle("mobile:reset", () => requireMobileGateway().reset());
}

function setCompactWindow(compact: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (compact) {
    if (!normalWindowBounds) normalWindowBounds = mainWindow.getBounds();
    mainWindow.setMinimumSize(344, 430);
    mainWindow.setMaximumSize(420, 620);
    mainWindow.setSize(372, 540, true);
    mainWindow.center();
    return;
  }

  mainWindow.setMaximumSize(0, 0);
  mainWindow.setMinimumSize(920, 620);
  if (normalWindowBounds) {
    mainWindow.setBounds(normalWindowBounds, true);
    normalWindowBounds = undefined;
  } else {
    mainWindow.setSize(1240, 820, true);
    mainWindow.center();
  }
}

function publishSnapshot(snapshot: AppSnapshot): void {
  mainWindow?.webContents.send("snapshot:changed", snapshot);
  mobileGateway?.publishSnapshot(snapshot);

  for (const session of snapshot.trackedSessions) {
    const previous = lastStatuses.get(session.id);
    lastStatuses.set(session.id, session.status);
    if (!notificationsReady || !previous || previous === session.status) {
      continue;
    }

    if (session.status === "attention") {
      showNotification("AgentSignal · wymaga uwagi", session.title);
    } else if (session.status === "idle" && previous === "working") {
      showNotification("AgentSignal · agent jest wolny", session.title);
    }
  }
}

function publishMobileGatewayStatus(status: MobileGatewayStatus): void {
  mainWindow?.webContents.send("mobile:status-changed", status);
}

function showNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body });
  notification.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  notification.show();
}

function requireManager(): DashboardManager {
  if (!dashboardManager) throw new Error("AgentSignal jeszcze się uruchamia.");
  return dashboardManager;
}

function requireMobileGateway(): MobileGateway {
  if (!mobileGateway) {
    throw new Error("Dostęp mobilny jeszcze się uruchamia.");
  }
  return mobileGateway;
}

function resolveDevelopmentUrl(): string | undefined {
  if (app.isPackaged) return undefined;
  const candidate = process.env.VITE_DEV_SERVER_URL;
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    if (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    ) {
      return url.toString();
    }
  } catch {
    // Invalid development URLs fall back to the packaged renderer.
  }
  return undefined;
}

function parseTrackSessionsInput(input: unknown): TrackSessionsInput {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { sessionIds?: unknown }).sessionIds)
  ) {
    throw new TypeError("Nieprawidłowa lista czatów.");
  }

  const sessionIds = (input as { sessionIds: unknown[] }).sessionIds;
  if (sessionIds.length === 0 || sessionIds.length > 100) {
    throw new TypeError("Wybierz od 1 do 100 czatów.");
  }
  return { sessionIds: sessionIds.map(parseSessionId) };
}

function parseSessionId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512
  ) {
    throw new TypeError("Nieprawidłowy identyfikator czatu.");
  }
  return value;
}

function parseDeviceId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128
  ) {
    throw new TypeError("Nieprawidłowy identyfikator urządzenia.");
  }
  return value;
}

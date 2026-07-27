import { spawn } from "node:child_process";
import path from "node:path";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  safeStorage,
  session,
  shell,
  Tray
} from "electron";
import type {
  AppPreferences,
  AppSnapshot,
  MobileGatewayStatus,
  ReorderProjectGroupsInput,
  SetProjectGroupsCollapsedInput,
  SessionStatus,
  TrackSessionsInput,
  UpdateProjectGroupInput,
  UpdateTrackedSessionInput
} from "../src/shared/types";
import { isProjectColor } from "../src/shared/project-groups";
import { DashboardManager } from "./services/dashboard-manager";
import { MobileGateway } from "./services/mobile-gateway";
import { MobileStore } from "./services/mobile-store";
import {
  APPROVAL_NOTIFICATION_DELAY_MS,
  NotificationDebouncer
} from "./services/notification-debouncer";
import { TrackingStore } from "./services/store";
import { resolveClaudeExecutable } from "./services/detector";
import { claudeCodeSessionUrl } from "./services/claude-deep-link";

let mainWindow: BrowserWindow | null = null;
let dashboardManager: DashboardManager | null = null;
let mobileGateway: MobileGateway | null = null;
let tray: Tray | null = null;
let quitting = false;
let notificationsReady = false;
let latestNotificationSnapshot: AppSnapshot | undefined;
let normalWindowBounds: Electron.Rectangle | undefined;
let trayLanguage: AppPreferences["language"] = "pl";
const lastStatuses = new Map<string, SessionStatus>();
const approvalNotificationDebouncer = new NotificationDebouncer(
  APPROVAL_NOTIFICATION_DELAY_MS
);
const smokeMode = process.argv.includes("--smoke-test");

const lock = app.requestSingleInstanceLock();
if (!lock) {
  if (smokeMode) {
    console.error("APP_SMOKE_FAILED: another Agent Signal instance is running.");
    app.exit(2);
  } else {
    app.quit();
  }
}

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
}).catch((error) => {
  console.error("Agent Signal failed during startup", error);
  if (smokeMode) {
    quitting = true;
    app.exit(1);
  }
});

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  approvalNotificationDebouncer.clear();
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
    title: "Agent Signal",
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
      void verifyPackagedRenderer();
    }, 700);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, code, description, url, isMainFrame) => {
      if (!smokeMode || !isMainFrame) return;
      failAppSmoke(
        `main frame failed to load (${code}: ${description}) at ${url}`
      );
    }
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (!smokeMode) return;
    failAppSmoke(`renderer process exited: ${details.reason}`);
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
  tray.setToolTip("Agent Signal");
  updateTrayMenu(trayLanguage);
  tray.on("double-click", showMainWindow);
}

function updateTrayMenu(language: AppPreferences["language"]): void {
  if (!tray) return;
  trayLanguage = language;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: language === "pl" ? "Otwórz Agent Signal" : "Open Agent Signal",
        click: showMainWindow
      },
      { type: "separator" },
      {
        label: language === "pl" ? "Wyjście" : "Exit",
        click: () => app.quit()
      }
    ])
  );
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
  ipcMain.handle("sessions:archive-many", (_event, input: unknown) =>
    requireManager().archiveSessions(parseTrackSessionsInput(input))
  );
  ipcMain.handle("sessions:restore", (_event, sessionId: unknown) =>
    requireManager().restoreArchivedSession(parseSessionId(sessionId))
  );
  ipcMain.handle("sessions:delete-archived", (_event, sessionId: unknown) =>
    requireManager().deleteArchivedSession(parseSessionId(sessionId))
  );
  ipcMain.handle("sessions:delete-archived-many", (_event, input: unknown) =>
    requireManager().deleteArchivedSessions(
      parseArchivedSessionIdsInput(input)
    )
  );
  ipcMain.handle("sessions:update", (_event, input: unknown) =>
    requireManager().updateTrackedSession(
      parseUpdateTrackedSessionInput(input)
    )
  );
  ipcMain.handle("preferences:update", (_event, patch: unknown) =>
    requireManager().updatePreferences(parsePreferencesPatch(patch))
  );
  ipcMain.handle("project-groups:update", (_event, input: unknown) =>
    requireManager().updateProjectGroup(parseUpdateProjectGroupInput(input))
  );
  ipcMain.handle("project-groups:reorder", (_event, input: unknown) =>
    requireManager().reorderProjectGroups(
      parseReorderProjectGroupsInput(input)
    )
  );
  ipcMain.handle("project-groups:set-collapsed", (_event, input: unknown) =>
    requireManager().setProjectGroupsCollapsed(
      parseSetProjectGroupsCollapsedInput(input)
    )
  );
  ipcMain.handle("sessions:dismiss-prompt", (_event, sessionId: unknown) =>
    requireManager().dismissSessionPrompt(parseSessionId(sessionId))
  );
  ipcMain.handle("sessions:open", async (_event, sessionId: unknown) => {
    await openSessionInSource(parseSessionId(sessionId));
  });
  ipcMain.handle("subagents:open", async (_event, threadId: unknown) => {
    await openCodexThreadInSource(parseCodexThreadId(threadId));
  });
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
  latestNotificationSnapshot = snapshot;
  mainWindow?.webContents.send("snapshot:changed", snapshot);
  mobileGateway?.publishSnapshot(snapshot);
  if (trayLanguage !== snapshot.preferences.language) {
    updateTrayMenu(snapshot.preferences.language);
  }

  const trackedSessionIds = new Set(
    snapshot.trackedSessions.map((session) => session.id)
  );
  approvalNotificationDebouncer.cancelExcept(trackedSessionIds);
  for (const session of snapshot.trackedSessions) {
    const previous = lastStatuses.get(session.id);
    lastStatuses.set(session.id, session.status);
    if (
      session.status !== "attention" ||
      !snapshot.preferences.systemNotifications ||
      !snapshot.preferences.approvalNotifications ||
      !notificationsReady
    ) {
      approvalNotificationDebouncer.cancel(session.id);
    }
    if (
      !snapshot.preferences.systemNotifications ||
      !notificationsReady ||
      !previous ||
      previous === session.status
    ) {
      continue;
    }

    if (
      session.status === "attention" &&
      snapshot.preferences.approvalNotifications
    ) {
      approvalNotificationDebouncer.schedule(session.id, () => {
        const currentSnapshot = latestNotificationSnapshot;
        const currentSession = currentSnapshot?.trackedSessions.find(
          (candidate) => candidate.id === session.id
        );
        if (
          !currentSnapshot ||
          currentSession?.status !== "attention" ||
          !currentSnapshot.preferences.systemNotifications ||
          !currentSnapshot.preferences.approvalNotifications
        ) {
          return;
        }
        showNotification(
          currentSnapshot.preferences.language === "pl"
            ? "Agent Signal · do zatwierdzenia"
            : "Agent Signal · approval needed",
          currentSession.title
        );
      });
    } else if (session.status === "idle" && previous === "working") {
      showNotification(
        snapshot.preferences.language === "pl"
          ? "Agent Signal · agent jest wolny"
          : "Agent Signal · agent is idle",
        session.title
      );
    }
  }
  for (const sessionId of lastStatuses.keys()) {
    if (!trackedSessionIds.has(sessionId)) lastStatuses.delete(sessionId);
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
  if (!dashboardManager) throw new Error("Agent Signal jeszcze się uruchamia.");
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

function parseArchivedSessionIdsInput(input: unknown): TrackSessionsInput {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { sessionIds?: unknown }).sessionIds)
  ) {
    throw new TypeError("Nieprawidłowa lista czatów.");
  }
  const sessionIds = (input as { sessionIds: unknown[] }).sessionIds;
  if (sessionIds.length === 0 || sessionIds.length > 10_000) {
    throw new TypeError("Wybierz od 1 do 10000 czatów.");
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

function parseCodexThreadId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(value)
  ) {
    throw new TypeError("Nieprawidłowy identyfikator wątku Codexa.");
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

async function verifyPackagedRenderer(): Promise<void> {
  try {
    const result = (await mainWindow?.webContents.executeJavaScript(`
      (() => ({
        title: document.title,
        shell: document.querySelector(".app-shell")
          ? "dashboard"
          : document.querySelector(".compact-shell")
            ? "compact"
            : null,
        hasPreloadApi: Boolean(window.agentSignal),
        language: document.documentElement.lang
      }))()
    `)) as
      | {
          title: string;
          shell: "dashboard" | "compact" | null;
          hasPreloadApi: boolean;
          language: string;
        }
      | undefined;
    if (!result?.shell) {
      throw new Error("current Agent Signal dashboard was not rendered");
    }
    if (!result.hasPreloadApi) {
      throw new Error("Electron preload API is unavailable");
    }
    console.log(`APP_SMOKE_OK ${JSON.stringify(result)}`);
    quitting = true;
    app.exit(0);
  } catch (error) {
    failAppSmoke(error instanceof Error ? error.message : String(error));
  }
}

function failAppSmoke(message: string): void {
  console.error(`APP_SMOKE_FAILED: ${message}`);
  quitting = true;
  app.exit(1);
}

async function openSessionInSource(sessionId: string): Promise<void> {
  const record = requireManager().getTrackedSessionRecord(sessionId);
  if (record.source === "codex-app" && record.threadId) {
    await openCodexThreadInSource(record.threadId);
    return;
  }

  if (record.source === "claude-code" && record.sessionId) {
    const desktopUrl = claudeCodeSessionUrl(record.sessionId);
    try {
      await shell.openExternal(desktopUrl);
      return;
    } catch {
      // Claude Code CLI remains available when Claude Desktop is not installed.
    }
    const executable = resolveClaudeExecutable();
    if (!executable) {
      throw new Error(
        "Nie znaleziono Claude Desktop ani Claude Code CLI potrzebnego do otwarcia sesji."
      );
    }
    const child =
      process.platform === "win32"
        ? spawn(
            "cmd.exe",
            [
              "/d",
              "/s",
              "/c",
              "start",
              "",
              executable,
              "--resume",
              record.sessionId
            ],
            {
              cwd: record.workingDirectory || undefined,
              detached: true,
              stdio: "ignore",
              windowsHide: true
            }
          )
        : spawn(executable, ["--resume", record.sessionId], {
            cwd: record.workingDirectory || undefined,
            detached: true,
            stdio: "ignore"
          });
    child.unref();
    return;
  }

  throw new Error("Ta sesja nie ma identyfikatora potrzebnego do otwarcia.");
}

async function openCodexThreadInSource(threadId: string): Promise<void> {
  await shell.openExternal(
    `codex://threads/${encodeURIComponent(threadId)}`
  );
}

function parseUpdateTrackedSessionInput(
  input: unknown
): UpdateTrackedSessionInput {
  if (!input || typeof input !== "object") {
    throw new TypeError("Nieprawidłowa aktualizacja czatu.");
  }
  const candidate = input as {
    sessionId?: unknown;
    pinned?: unknown;
    titleOverride?: unknown;
    projectName?: unknown;
    groupOverride?: unknown;
  };
  const result: UpdateTrackedSessionInput = {
    sessionId: parseSessionId(candidate.sessionId)
  };
  if (candidate.pinned !== undefined) {
    if (typeof candidate.pinned !== "boolean") {
      throw new TypeError("Nieprawidłowy stan przypięcia.");
    }
    result.pinned = candidate.pinned;
  }
  if (candidate.titleOverride !== undefined) {
    if (
      candidate.titleOverride !== null &&
      (typeof candidate.titleOverride !== "string" ||
        candidate.titleOverride.length > 120 ||
        /[\u0000-\u001f\u007f]/.test(candidate.titleOverride))
    ) {
      throw new TypeError("Nieprawidłowa własna nazwa czatu.");
    }
    result.titleOverride = candidate.titleOverride;
  }
  if (candidate.projectName !== undefined) {
    if (
      typeof candidate.projectName !== "string" ||
      candidate.projectName.length > 80
    ) {
      throw new TypeError("Nieprawidłowa nazwa projektu.");
    }
    result.projectName = candidate.projectName;
  }
  if (candidate.groupOverride !== undefined) {
    if (
      candidate.groupOverride !== null &&
      (typeof candidate.groupOverride !== "string" ||
        candidate.groupOverride.length > 80)
    ) {
      throw new TypeError("Nieprawidłowe przypisanie grupy.");
    }
    result.groupOverride = candidate.groupOverride;
  }
  return result;
}

function parsePreferencesPatch(input: unknown): Partial<AppPreferences> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Nieprawidłowe preferencje.");
  }
  const candidate = input as Record<string, unknown>;
  const result: Partial<AppPreferences> = {};
  const booleanKeys = [
    "groupTrackedByProject",
    "autoGroupProjects",
    "groupPickerByProject",
    "openChatOnDoubleClick",
    "enablePinning",
    "watchedSidebarExpanded",
    "idlePetAnimation",
    "detectNewSessions",
    "promptForNewSessions",
    "systemNotifications",
    "approvalNotifications",
    "showSubagentTeams"
  ] as const;
  for (const key of booleanKeys) {
    if (candidate[key] === undefined) continue;
    if (typeof candidate[key] !== "boolean") {
      throw new TypeError(`Nieprawidłowa preferencja: ${key}.`);
    }
    result[key] = candidate[key];
  }
  if (candidate.language !== undefined) {
    if (candidate.language !== "pl" && candidate.language !== "en") {
      throw new TypeError("Nieprawidłowy język.");
    }
    result.language = candidate.language;
  }
  if (candidate.idleAfterMinutes !== undefined) {
    if (
      typeof candidate.idleAfterMinutes !== "number" ||
      !Number.isFinite(candidate.idleAfterMinutes)
    ) {
      throw new TypeError("Nieprawidłowy czas bezczynności.");
    }
    result.idleAfterMinutes = candidate.idleAfterMinutes;
  }
  return result;
}

function parseUpdateProjectGroupInput(
  input: unknown
): UpdateProjectGroupInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Nieprawidłowa aktualizacja grupy.");
  }
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.projectKey !== "string" ||
    candidate.projectKey.length > 80
  ) {
    throw new TypeError("Nieprawidłowe dane grupy projektu.");
  }
  if (
    candidate.label !== undefined &&
    (typeof candidate.label !== "string" || candidate.label.length > 80)
  ) {
    throw new TypeError("Nieprawidłowa nazwa grupy projektu.");
  }
  if (
    candidate.symbol !== undefined &&
    (typeof candidate.symbol !== "string" ||
      [...candidate.symbol.trim()].length > 2)
  ) {
    throw new TypeError("Nieprawidłowa litera grupy projektu.");
  }
  if (
    candidate.color !== undefined &&
    (typeof candidate.color !== "string" ||
      (candidate.color !== "" && !isProjectColor(candidate.color)))
  ) {
    throw new TypeError("Nieprawidłowy kolor grupy projektu.");
  }
  if (
    candidate.collapsed !== undefined &&
    typeof candidate.collapsed !== "boolean"
  ) {
    throw new TypeError("Nieprawidłowy stan grupy projektu.");
  }
  if (
    candidate.sidebarCollapsed !== undefined &&
    typeof candidate.sidebarCollapsed !== "boolean"
  ) {
    throw new TypeError("Nieprawidłowy stan grupy projektu w menu bocznym.");
  }
  return {
    projectKey: candidate.projectKey,
    ...(candidate.label === undefined ? {} : { label: candidate.label }),
    ...(candidate.symbol === undefined ? {} : { symbol: candidate.symbol }),
    ...(candidate.color === undefined ? {} : { color: candidate.color }),
    ...(candidate.collapsed === undefined
      ? {}
      : { collapsed: candidate.collapsed }),
    ...(candidate.sidebarCollapsed === undefined
      ? {}
      : { sidebarCollapsed: candidate.sidebarCollapsed })
  };
}

function parseReorderProjectGroupsInput(
  input: unknown
): ReorderProjectGroupsInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Nieprawidłowa kolejność grup.");
  }
  const projectKeys = (input as { projectKeys?: unknown }).projectKeys;
  if (
    !Array.isArray(projectKeys) ||
    projectKeys.length > 200 ||
    projectKeys.some(
      (key) => typeof key !== "string" || key.length > 80
    )
  ) {
    throw new TypeError("Nieprawidłowa kolejność grup.");
  }
  return { projectKeys: [...new Set(projectKeys)] };
}

function parseSetProjectGroupsCollapsedInput(
  input: unknown
): SetProjectGroupsCollapsedInput {
  const parsed = parseReorderProjectGroupsInput(input);
  const collapsed = (input as { collapsed?: unknown }).collapsed;
  if (typeof collapsed !== "boolean") {
    throw new TypeError("Nieprawidłowy stan grup projektów.");
  }
  return { ...parsed, collapsed };
}

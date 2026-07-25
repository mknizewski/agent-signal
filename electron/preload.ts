import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentSignalApi,
  AppPreferences,
  AppSnapshot,
  ReorderProjectGroupsInput,
  TrackSessionsInput,
  UpdateProjectGroupInput,
  UpdateTrackedSessionInput
} from "../src/shared/types";

const api: AgentSignalApi = {
  getSnapshot: () => ipcRenderer.invoke("snapshot:get"),
  trackSessions: (input: TrackSessionsInput) =>
    ipcRenderer.invoke("sessions:track", input),
  archiveSession: (sessionId: string) =>
    ipcRenderer.invoke("sessions:archive", sessionId),
  restoreArchivedSession: (sessionId: string) =>
    ipcRenderer.invoke("sessions:restore", sessionId),
  deleteArchivedSession: (sessionId: string) =>
    ipcRenderer.invoke("sessions:delete-archived", sessionId),
  updateTrackedSession: (input: UpdateTrackedSessionInput) =>
    ipcRenderer.invoke("sessions:update", input),
  updatePreferences: (patch: Partial<AppPreferences>) =>
    ipcRenderer.invoke("preferences:update", patch),
  updateProjectGroup: (input: UpdateProjectGroupInput) =>
    ipcRenderer.invoke("project-groups:update", input),
  reorderProjectGroups: (input: ReorderProjectGroupsInput) =>
    ipcRenderer.invoke("project-groups:reorder", input),
  dismissSessionPrompt: (sessionId: string) =>
    ipcRenderer.invoke("sessions:dismiss-prompt", sessionId),
  openSession: (sessionId: string) =>
    ipcRenderer.invoke("sessions:open", sessionId),
  openCodexThread: (threadId: string) =>
    ipcRenderer.invoke("subagents:open", threadId),
  refresh: () => ipcRenderer.invoke("sessions:refresh"),
  setCompactMode: (compact: boolean) =>
    ipcRenderer.invoke("window:compact", compact),
  setWindowTheme: (theme: "light" | "dark") =>
    ipcRenderer.invoke("window:theme", theme),
  exitApp: () => ipcRenderer.invoke("app:exit"),
  getMobileGatewayStatus: () => ipcRenderer.invoke("mobile:status"),
  setMobileGatewayEnabled: (enabled: boolean) =>
    ipcRenderer.invoke("mobile:set-enabled", enabled),
  createMobilePairing: () => ipcRenderer.invoke("mobile:create-pairing"),
  revokeMobileDevice: (deviceId: string) =>
    ipcRenderer.invoke("mobile:revoke-device", deviceId),
  resetMobileAccess: () => ipcRenderer.invoke("mobile:reset"),
  onSnapshot: (listener: (snapshot: AppSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) =>
      listener(snapshot);
    ipcRenderer.on("snapshot:changed", handler);
    return () => ipcRenderer.removeListener("snapshot:changed", handler);
  },
  onMobileGatewayStatus: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: Parameters<typeof listener>[0]
    ) => listener(status);
    ipcRenderer.on("mobile:status-changed", handler);
    return () => ipcRenderer.removeListener("mobile:status-changed", handler);
  }
};

contextBridge.exposeInMainWorld("agentSignal", api);

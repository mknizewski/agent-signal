import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentSignalApi,
  AppSnapshot,
  TrackSessionsInput
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

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
  untrackSession: (sessionId: string) =>
    ipcRenderer.invoke("sessions:untrack", sessionId),
  refresh: () => ipcRenderer.invoke("sessions:refresh"),
  setCompactMode: (compact: boolean) =>
    ipcRenderer.invoke("window:compact", compact),
  setWindowTheme: (theme: "light" | "dark") =>
    ipcRenderer.invoke("window:theme", theme),
  exitApp: () => ipcRenderer.invoke("app:exit"),
  onSnapshot: (listener: (snapshot: AppSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) =>
      listener(snapshot);
    ipcRenderer.on("snapshot:changed", handler);
    return () => ipcRenderer.removeListener("snapshot:changed", handler);
  }
};

contextBridge.exposeInMainWorld("agentSignal", api);

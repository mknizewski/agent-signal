import type { AgentSignalApi } from "./shared/types";

declare global {
  interface Window {
    agentSignal?: AgentSignalApi;
  }
}

export {};

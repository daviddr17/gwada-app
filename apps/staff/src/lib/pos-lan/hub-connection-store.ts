import { create } from "zustand";
import type { PosLanHubSnapshot } from "@gwada/pos-lan";

export type PosHubConnectionStatus =
  | "idle"
  | "searching"
  | "connecting"
  | "connected"
  | "error";

type HubConnectionState = {
  status: PosHubConnectionStatus;
  hubBaseUrl: string | null;
  snapshot: PosLanHubSnapshot | null;
  lastError: string | null;
  lastFetchedAt: string | null;
  setSearching: () => void;
  setConnecting: (hubBaseUrl: string) => void;
  setConnected: (hubBaseUrl: string, snapshot: PosLanHubSnapshot) => void;
  setError: (message: string) => void;
  clear: () => void;
};

export const usePosHubConnectionStore = create<HubConnectionState>((set) => ({
  status: "idle",
  hubBaseUrl: null,
  snapshot: null,
  lastError: null,
  lastFetchedAt: null,

  setSearching: () =>
    set({ status: "searching", lastError: null }),

  setConnecting: (hubBaseUrl) =>
    set({ status: "connecting", hubBaseUrl, lastError: null }),

  setConnected: (hubBaseUrl, snapshot) =>
    set({
      status: "connected",
      hubBaseUrl,
      snapshot,
      lastError: null,
      lastFetchedAt: snapshot.generatedAt,
    }),

  setError: (message) =>
    set({ status: "error", lastError: message }),

  clear: () =>
    set({
      status: "idle",
      hubBaseUrl: null,
      snapshot: null,
      lastError: null,
      lastFetchedAt: null,
    }),
}));
